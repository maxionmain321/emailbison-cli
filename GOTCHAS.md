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
