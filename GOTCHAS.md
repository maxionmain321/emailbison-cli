# EmailBison API / CLI — Common Gotchas

Platform + CLI behaviors that **look like bugs but aren't.** Save yourself the debugging.

## Leads

- **A lead can be in only ONE campaign/sequence at a time.** Attaching a lead that's already in another sequence returns `422 — "No leads were added because they are either in other sequences, have previously bounced..."`.
  - **Re-engagement:** remove the lead from its old campaign first, or it silently won't attach.
  - `leads upsert --campaign-id` reports `attached_to_campaign` — if it's **less than your CSV row count**, some leads were already in other sequences (not lost — just not re-attached).
  - **Multi-campaign test harnesses:** use a **unique email per campaign**, or only the first campaign gets the lead and the rest 422.
- **`leads upsert` maps `custom_*` CSV columns to custom variables** (auto-created). Non-`custom_`, non-standard columns are **silently dropped** by EB's bulk endpoint — `custom_*` (or `--custom-cols`) is the only way to load per-lead personalization.
- **`create-or-update/multiple` returns the lead id even for unchanged existing leads** — so the upsert *does* know the id; the 422 above is the platform refusing the cross-sequence attach, not a missing id.

## Tags

- **Tag commands are workspace-scoped → always pass `--workspace <name>`.** Without it the *default* workspace's API key is used against another workspace's tag → `AUTH_ERROR "api key does not match the workspace the record is on"`. With the right `--workspace`, create / attach / remove / delete all work.

## Campaigns

- **Settings `PATCH /api/campaigns/{id}/update` is NON-partial** — it resets every omitted field to defaults. Always send the full settings object, even to change one value.
- **Schedule `POST` requires `save_as_template: false`** (or `422`) and `H:i` time format (no seconds), even though `GET` returns `HH:MM:SS`.
- **Editing a sequence step is unsupported** (`PATCH` → 405, `PUT` → 404). To change copy: POST the new step, then DELETE the old one. You **cannot delete the last remaining step** (400) → always add-before-delete. `order` auto-renumbers after a delete.
- **Send order is RANDOMIZED** within the new-leads pool — CSV/attach order does not control send order. For a provider-staggered ramp, use separate campaigns or `max_new_leads_per_day`, not CSV ordering.
- **Launch = `resume`** (`PATCH /api/campaigns/{id}/resume`). An "incomplete" error means a missing piece: sequence, schedule, senders, or ≥1 lead.

## Pagination

- **`per_page` is LOCKED at 15 and ignored** on every list endpoint (`/api/sender-emails`, `/api/leads`, `/api/replies`, …). Read `meta.last_page` / `meta.total` and loop — a hard-coded page range silently truncates (e.g. 715 senders = 48 pages; stopping at 39 looks like "accounts dropped off").

## Render / QA

- **`test-email` is lead-less** — only sender variables + spintax resolve; custom/lead variables render **literal** even when correct. Don't trust it for custom-var QA. Use the Bison UI **"Preview email"** (it merges a real lead).
- **Subject-line spintax can't be verified before launch** (no draft render endpoint; `scheduled-emails` is empty until activation). Prefer a per-lead `{CUSTOM_SUBJECT}` variable over `{a|b|c}` spintax in subjects — the per-lead variable is proven; subject-spintax rendering is unconfirmed.

## Copy syntax

- **Custom variables = single-brace UPPERCASE**: `{CUSTOM_GREETING}`. **Lowercase renders LITERAL** (silent fail) — EB uppercases the token to match the lowercase field name.
- **Spintax = `{a|b|c}`** (single brace, pipe). NOT `{{RANDOM|...}}`.
- `{SENDER_LAST_NAME}` is usually empty → drop it from signatures.

## The "Interested" tile counts EVENTS per SEQUENCE STEP, not unique leads (found 2026-08-27)

A lead marked interested after step 1 and again after step 2 **counts twice**. The campaign-level
`interested` is exactly the sum of `sequence_step_stats[].interested` (verified: 57 = 57 across all
10 Tendify campaigns). Camp 270's steps were `[16, 5, 1]` = 22 while only **19 unique leads** carried
the flag. Workspace-wide: **tile 57, unique leads 48, a 19% overstatement.**

For a true unique count, use `replies list --status interested` and dedupe by lead email. That
filter is accurate (known-answer test: 34 = 34 against the raw `interested` boolean, and
`--folder all` returns identical rows).

## Stats endpoints

One GET reproduces the whole dashboard (sent, contacted, replies, bounced, interested):
```
bison --workspace <c> workspaces-v1.1 stats --start-date 2026-06-28 --end-date 2026-08-27
```

`campaigns stats` is a **POST with the dates in the BODY**, not a GET with query params. They were
missing from the command definition until 2026-08-27, so it always failed with "The start date field
is required" and looked broken. Now defaults to the last 30 days. Its `sequence_step_stats` array is
what exposes the double count above.

## `/api/leads` silently ignores every filter param

`tags[]`, `tag_ids[]`, `tag_id`, `filter[tags]`, `interested`, `status` all return the same
unfiltered rows, so a filtered query looks like it worked and did nothing. `per_page` is hard-locked
to 15 on every endpoint. Interest is stored as a lead-level `Interested` tag (id 51, a global default
tag a client workspace key cannot read) and per campaign-lead in `lead_campaign_data[].interested`.

## Replies: the mark-* endpoints use bare field names, and `/replies` ignores `is_read` (found 2026-09-02)

- **`PATCH /replies/{id}/mark-as-read-or-unread` wants `{"read": true}`, NOT `is_read`.**
  Sending `is_read` returns `422 {"errors":{"read":["The read field is required."]}}`.
- **`PATCH /replies/{id}/mark-as-automated-or-not-automated` wants `{"automated": true}`, NOT `is_automated`**
  (`422 "The automated field is required."`).
  Both are now handled by a `transformBody` in the CLI, so `--is-read` / `--is-automated` work as documented.
- **`GET /replies?is_read=true|false` is IGNORED by the server.** Both values return the identical
  `meta.total` (2,236 on the BlueSteps inbox) and a page containing a mix of read and unread rows.
  Same class as `/api/leads` below. **Filter read status client-side; do not trust the flag.**
- ⚠️ **`z.coerce.boolean()` is the wrong parser for any CLI boolean flag** and this bit all of the above.
  It runs JS `Boolean(value)`, and every non-empty string is truthy, so `"false"` and `"0"` both parse
  as **TRUE**. `--is-read false` was therefore a request to mark the reply READ. Use `booleanFlag`
  (`src/core/schema.ts`), which parses true/false/1/0/yes/no/on/off and REJECTS anything else instead
  of defaulting to true.
