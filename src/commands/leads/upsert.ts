import { z } from 'zod';
import { readFileSync } from 'node:fs';
import type { CommandDefinition, BisonClient } from '../../core/types.js';

// RFC-4180-ish field splitter: respects double-quoted fields (which may contain commas
// and escaped "" quotes). A naive split(',') corrupts any value with a comma — e.g. a
// greeting custom var "Hey," shifts every downstream column.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
    return row;
  });
}

// Standard lead fields EmailBison accepts at the top level. Everything else in the CSV is
// either ignored or (for custom columns) mapped into custom_variables.
const STANDARD = new Set(['email', 'first_name', 'last_name', 'company', 'title', 'notes', 'status']);

// LeadGrow-parity + custom-variable mapping. Bulk upsert leads from a CSV in batches via the
// validated /leads/create-or-update/multiple path (patch-preserving), with optional campaign attach.
// CSV columns prefixed `custom_` (or named via --custom-cols) are mapped to EmailBison custom
// variables ([{name,value}]) and the variables are auto-created — EB's bulk endpoint silently
// drops unknown top-level columns, so this is the only way to load per-lead personalization vars.
export const leadsUpsertCommand: CommandDefinition = {
  name: 'leads_upsert',
  group: 'leads',
  subcommand: 'upsert',
  description: 'Bulk upsert leads from a CSV file (patch-preserving); maps custom_ columns to custom variables; optionally attach to a campaign.',
  examples: [
    'bison leads upsert --file leads.csv --campaign-id 18 --batch-size 200',
    'bison leads upsert --file leads.csv --custom-cols greeting,subject',
  ],
  inputSchema: z.object({
    file: z.string().describe('CSV path (header: email,first_name,...,custom_*)'),
    campaign_id: z.string().optional().describe('Attach upserted leads to this campaign'),
    batch_size: z.coerce.number().optional().default(200).describe('Leads per request (<=500)'),
    custom_cols: z.string().optional().describe('Comma-separated extra columns to treat as custom variables'),
    existing: z.enum(['patch', 'put']).optional().default('patch').describe('Behavior for existing leads (patch=merge, put=replace)'),
  }),
  cliMappings: {
    options: [
      { field: 'file', flags: '--file <path>', description: 'CSV file path' },
      { field: 'campaign_id', flags: '--campaign-id <id>', description: 'Attach to campaign' },
      { field: 'batch_size', flags: '--batch-size <n>', description: 'Leads per request (<=500)' },
      { field: 'custom_cols', flags: '--custom-cols <list>', description: 'Extra columns to treat as custom variables (comma-separated)' },
      { field: 'existing', flags: '--existing <mode>', description: 'patch (merge, default) or put (replace)' },
    ],
  },
  endpoint: { method: 'POST', path: '/api/leads/create-or-update/multiple' },
  fieldMappings: {},
  handler: async (input: Record<string, unknown>, client: BisonClient) => {
    const rows = parseCsv(readFileSync(String(input.file), 'utf8')).filter((r) => r.email);
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const extra = String(input.custom_cols ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    // custom columns = anything prefixed custom_ OR named in --custom-cols (excluding standard fields)
    const customCols = headers.filter(
      (h) => !STANDARD.has(h) && (h.startsWith('custom_') || extra.includes(h)),
    );

    // pre-create custom variables (idempotent — ignore already-exists errors)
    for (const name of customCols) {
      try {
        await client.request({ method: 'POST', path: '/api/custom-variables', body: { name } });
      } catch {
        /* already exists — fine */
      }
    }

    const leads = rows.map((r) => {
      const lead: Record<string, unknown> = {
        email: r.email.toLowerCase(),
        first_name: r.first_name || 'there',
        last_name: r.last_name || '',
        company: r.company || r.company_name || '',
      };
      if (r.title) lead.title = r.title;
      const cvars = customCols
        .filter((c) => r[c])
        .map((c) => ({ name: c, value: r[c] }));
      if (cvars.length) lead.custom_variables = cvars;
      return lead;
    });

    const behavior = String(input.existing ?? 'patch');
    const batch = Math.min(Number(input.batch_size) || 200, 500);
    const ids: number[] = [];
    for (let i = 0; i < leads.length; i += batch) {
      const res = (await client.request({
        method: 'POST',
        path: '/api/leads/create-or-update/multiple',
        body: { existing_lead_behavior: behavior, leads: leads.slice(i, i + batch) },
      })) as { data?: Array<{ id?: number }> };
      for (const d of res?.data ?? []) if (d?.id) ids.push(d.id);
    }

    let attached = 0;
    if (input.campaign_id && ids.length) {
      for (let i = 0; i < ids.length; i += 500) {
        await client.request({
          method: 'POST',
          path: `/api/campaigns/${String(input.campaign_id)}/leads/attach-leads`,
          body: { lead_ids: ids.slice(i, i + 500) },
        });
        attached += ids.slice(i, i + 500).length;
      }
    }

    return {
      csv_rows: leads.length,
      custom_variables_mapped: customCols,
      upserted_ids_returned: ids.length,
      attached_to_campaign: input.campaign_id ? attached : null,
      note: 'Custom_ columns mapped to EmailBison custom variables (auto-created). Reference them in copy as {UPPERCASE} single-brace. Patch-preserving: ids return only for NEW/changed leads.',
    };
  },
};
