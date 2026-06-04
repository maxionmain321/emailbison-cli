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
