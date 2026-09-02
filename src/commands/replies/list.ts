import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { executeCommand } from '../../core/handler.js';
import { booleanFlag } from '../../core/schema.js';

export const repliesListCommand: CommandDefinition = {
  name: 'replies_list',
  group: 'replies',
  subcommand: 'list',
  description: 'List replies. Defaults to the Inbox; use --folder for sent/bounced/all.',
  examples: [
    'bison replies list',
    'bison replies list --folder sent --page 2',
    'bison replies list --folder bounced',
    'bison replies list --campaign-id 18 --status interested',
  ],
  inputSchema: z.object({
    page: z.coerce.number().optional().describe('Page number for pagination'),
    campaign_id: z.string().optional().describe('Filter by campaign ID'),
    is_read: booleanFlag.optional().describe('Filter by read status (⚠ the API currently IGNORES this filter, see GOTCHAS)'),
    folder: z.string().optional().describe('inbox | sent | spam | bounced | all'),
    status: z.string().optional().describe('interested | automated_reply | not_automated_reply'),
    search: z.string().optional().describe('Search by email/subject/body'),
    lead_id: z.string().optional().describe('Filter to one lead'),
  }),
  cliMappings: {
    options: [
      { field: 'page', flags: '--page <number>', description: 'Page number' },
      { field: 'campaign_id', flags: '--campaign-id <id>', description: 'Filter by campaign ID' },
      { field: 'is_read', flags: '--is-read <boolean>', description: 'Filter by read status' },
      { field: 'folder', flags: '--folder <folder>', description: 'inbox|sent|spam|bounced|all' },
      { field: 'status', flags: '--status <status>', description: 'interested|automated_reply|not_automated_reply' },
      { field: 'search', flags: '--search <text>', description: 'Search email/subject/body' },
      { field: 'lead_id', flags: '--lead-id <id>', description: 'Filter to one lead' },
    ],
  },
  endpoint: { method: 'GET', path: '/api/replies' },
  fieldMappings: {
    page: 'query', campaign_id: 'query', is_read: 'query',
    folder: 'query', status: 'query', search: 'query', lead_id: 'query',
  },
  handler: (input, client) => executeCommand(repliesListCommand, input, client),
};
