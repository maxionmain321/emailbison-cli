# Fork changes — Maxionlabs (self-hosted EmailBison)

This is a fork of [`bcharleson/emailbison-cli`](https://github.com/bcharleson/emailbison-cli), patched to work
against the self-hosted instance at `https://send.maxionlabs.com` and extended with the two features
LeadGrow's (unavailable) Bison CLI advertised. Forked + verified end-to-end 2026-06-04.

## Why a fork
Upstream's command shapes don't match this self-hosted server, so several commands 422'd. These are
server-quirk fixes, not upstream bugs — hence a maintained fork.

## Fixes
1. **Array/JSON body args now work** (`src/core/handler.ts`) — array fields arrived as JSON *strings*
   (`"[1,2]"`) and were sent as-is → `422 "must be an array"`. Handler now JSON-parses a whitelist of
   array/object body fields (`lead_ids`, `sender_email_ids`, `leads`, `sequence_steps`, `to_emails`,
   `tag_ids`, `campaign_ids`, `custom_variables`, `columnsToMap`, `settings`). Fixes: `campaigns
   attach-leads / remove-leads / attach-sender-emails / remove-sender-emails / move-leads /
   stop-future-emails / sequence-steps-create`, `leads bulk-delete / bulk-update-status /
   create-multiple / create-or-update-multiple`, `tags attach/remove-*`, `email-blacklist bulk`.
2. **`replies reply` + `replies new` send correctly** — server wants `message` / `sender_email_id` /
   `to_emails[{email_address}]` / `content_type`, not `body_text` / `from_sender_email_id` / `to_email`.
   Both reshaped via a new `transformBody` hook (`src/core/types.ts`, `handler.ts`). Use `--message`.

5. **`replies mark-read-unread` + `replies mark-automated` now actually work** (2026-09-02) — the
   server's body fields are `read` / `automated`, but the CLI sent `is_read` / `is_automated`, so both
   commands `422`'d on every call (`"The read field is required."`). Both now reshape via `transformBody`.
   **Second bug in the same commands:** `z.coerce.boolean()` runs JS `Boolean(value)`, so the strings
   `"false"` and `"0"` both parsed as **true** and `--is-read false` asked the server to mark the reply
   READ. Replaced with `booleanFlag` (`src/core/schema.ts`), which parses true/false/1/0/yes/no/on/off
   and rejects anything else rather than silently defaulting to true. `replies list --is-read` uses the
   same parser now, though the server ignores that filter entirely (see GOTCHAS).
   Verified live end-to-end against `send.maxionlabs.com`, asserting on the reply object's own
   `read` / `automated_reply` field after each call, not on the response.

## Added (LeadGrow parity)
3. **`--workspace <name>`** global flag (`src/index.ts`, `core/auth.ts`, `core/config.ts`) — switch
   workspace without re-auth, reading `~/.emailbison/workspaces.json` (`{ name: {api_key, base_url} }`).
   `bison --workspace clearspider campaigns list`.
4. **`leads upsert --file <csv> [--campaign-id] [--batch-size]`** (`src/commands/leads/upsert.ts`) —
   bulk CSV upsert in batches via the validated `/leads/create-or-update/multiple` (patch-preserving),
   with optional campaign attach. CSV header: `email,first_name,last_name,...`.

## More (2026-06-04)
5. **`--fields` works on single-object gets** (`src/core/output.ts`) — `bison replies get <id>
   --fields x` returned `{}` because it projected the `{data:{...}}` wrapper, not the inner object.
   Now projects the inner object.
6. **`replies list --folder <inbox|sent|spam|bounced|all>`** + `--status`/`--search`/`--lead-id`
   (`src/commands/replies/list.ts`) — needed to pull the *sent* folder for timestamp-based reply
   triage (find leads whose latest inbound is newer than our latest outbound = awaiting reply).

## More (2026-06-08)
7. **`leads upsert` now maps custom variables** (`src/commands/leads/upsert.ts`) — EB's bulk
   `/leads/create-or-update/multiple` silently drops unknown top-level CSV columns, so per-lead
   personalization vars never loaded. Upsert now treats `custom_*` columns (or `--custom-cols a,b`)
   as custom variables: auto-creates each via `POST /api/custom-variables`, sends them nested as
   `custom_variables:[{name,value}]`, and sets `existing_lead_behavior` (`--existing patch|put`,
   default patch). Reference them in copy as `{UPPERCASE}` single-brace (EB Liquid). Verified on the
   Tendify Construction load (5,357 leads). NB: `warmup list/get/enable/disable` already existed in
   source — just needed a rebuild (`npm run build`) to go live.

## More (2026-07-24)
8. **`replies reply --cc <emails> --bcc <emails>`** (`src/commands/replies/reply.ts`) — reply into a
   thread while copying additional recipients. Comma-separated; `transformBody` maps them to the
   server's `cc_emails[{email_address}]` / `bcc_emails[{email_address}]` arrays (parallel to
   `to_emails`). **Verified end-to-end 2026-07-24**: the reply-response object echoes the `cc` field
   populated with the address (it is `null` when unset), so acceptance is confirmable from the send
   response, not just a 200. Use: `bison replies reply <id> --sender-email-id <sid> --to-email <lead>
   --cc support@example.com --message "<html>"`. (Built for the BlueSteps customer-support handoff:
   introduce a real support contact by cc onto a lead thread.)

## Build / install
```
npm install        # deps
npm run build      # tsup -> dist/
npm install -g .   # install this fork as the global `bison`
```

## Not fixed
`leads bulk-csv` (server wants multipart, not JSON) — use `leads upsert --file` instead. Note
`create-or-update` returns ids only for NEW/changed leads, so `upsert --campaign-id` attaches those;
re-pull the campaign to confirm totals for a pre-existing pool.

## Added (GTM CLI shape standard, 2026-06-04)
5. **`--agent` global flag** (`src/index.ts`, `core/types.ts`, `commands/index.ts`) — agent mode:
   forces compact JSON (overrides `--pretty`), non-interactive. Conforms bison to the GTM CLI shape
   standard shared with spider + trigger-dev-pp-cli. See `knowledge_base/technical/GTM_CLI_SHAPE_STANDARD.md`.
6. **Typed exit codes** (`core/errors.ts` `exitCodeFor()`, `core/output.ts`) — `outputError` now exits
   with a typed code instead of hardcoded 1: 0 ok | 3 not-found | 4 auth | 20 server/http | 22 validation |
   29 rate-limit | 1 generic. Lets shell loops + agents branch on failure type without parsing prose.
