import type { CommandDefinition, BisonClient } from './types.js';

// Body fields that the EmailBison API expects as JSON arrays/objects, but which arrive
// from the CLI as JSON *strings* (commander) or from MCP as strings. Parse them so the
// request body carries real arrays/objects instead of `"[1,2]"`. Without this, commands
// like attach-leads / remove-leads / bulk-delete / tags / blacklist 422 on the server.
const JSON_BODY_FIELDS = new Set([
  'lead_ids', 'sender_email_ids', 'leads', 'sequence_steps', 'emails', 'to_emails',
  'tag_ids', 'campaign_ids', 'custom_variables', 'columnsToMap', 'settings',
]);

function maybeParseJson(field: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (!JSON_BODY_FIELDS.has(field)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value; // not valid JSON (e.g. spintax) — leave as-is
  }
}

export async function executeCommand(
  cmdDef: CommandDefinition,
  input: Record<string, unknown>,
  client: BisonClient,
): Promise<unknown> {
  let path = cmdDef.endpoint.path;
  const query: Record<string, unknown> = {};
  let body: Record<string, unknown> = {};

  for (const [field, location] of Object.entries(cmdDef.fieldMappings)) {
    const value = input[field];
    if (value === undefined || value === null) continue;

    switch (location) {
      case 'path':
        path = path.replace(`{${field}}`, encodeURIComponent(String(value)));
        break;
      case 'query':
        query[field] = value;
        break;
      case 'body':
        body[field] = maybeParseJson(field, value);
        break;
    }
  }

  if (cmdDef.transformBody) body = cmdDef.transformBody(body);

  return client.request({
    method: cmdDef.endpoint.method,
    path,
    query: Object.keys(query).length > 0 ? query : undefined,
    body: Object.keys(body).length > 0 ? body : undefined,
  });
}
