import { z } from 'zod';
import { readFileSync } from 'node:fs';
import type { CommandDefinition, BisonClient } from '../../core/types.js';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
    return row;
  });
}

// LeadGrow-parity: bulk upsert leads from a CSV in 500/req batches, patch-preserving
// (create-or-update updates existing leads without clobbering other fields), with optional
// attach to a campaign. Uses the validated /leads/create-or-update/multiple path.
export const leadsUpsertCommand: CommandDefinition = {
  name: 'leads_upsert',
  group: 'leads',
  subcommand: 'upsert',
  description: 'Bulk upsert leads from a CSV file (patch-preserving); optionally attach to a campaign.',
  examples: ['bison leads upsert --file leads.csv --campaign-id 18 --batch-size 200'],
  inputSchema: z.object({
    file: z.string().describe('CSV path (header: email,first_name,last_name,...)'),
    campaign_id: z.string().optional().describe('Attach upserted leads to this campaign'),
    batch_size: z.coerce.number().optional().default(200).describe('Leads per request (<=500)'),
  }),
  cliMappings: {
    options: [
      { field: 'file', flags: '--file <path>', description: 'CSV file path' },
      { field: 'campaign_id', flags: '--campaign-id <id>', description: 'Attach to campaign' },
      { field: 'batch_size', flags: '--batch-size <n>', description: 'Leads per request (<=500)' },
    ],
  },
  endpoint: { method: 'POST', path: '/api/leads/create-or-update/multiple' },
  fieldMappings: {},
  handler: async (input: Record<string, unknown>, client: BisonClient) => {
    const rows = parseCsv(readFileSync(String(input.file), 'utf8'));
    const leads = rows
      .filter((r) => r.email)
      .map((r) => ({ ...r, first_name: r.first_name || 'there', last_name: r.last_name || 'there' }));
    const batch = Math.min(Number(input.batch_size) || 200, 500);
    const ids: number[] = [];
    for (let i = 0; i < leads.length; i += batch) {
      const res = (await client.request({
        method: 'POST',
        path: '/api/leads/create-or-update/multiple',
        body: { leads: leads.slice(i, i + batch) },
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
      upserted_ids_returned: ids.length,
      attached_to_campaign: input.campaign_id ? attached : null,
      note: 'Patch-preserving upsert. create-or-update returns ids only for NEW/changed leads, so attach covers those; pre-existing unchanged leads return no id (re-pull the campaign to confirm totals).',
    };
  },
};
