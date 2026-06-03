import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { executeCommand } from '../../core/handler.js';

// FIXED for self-hosted EmailBison: the server wants `message` / `sender_email_id` /
// `content_type` / `to_emails[]`, not body_text/body_html. transformBody reshapes to that.
export const repliesReplyCommand: CommandDefinition = {
  name: 'replies_reply',
  group: 'replies',
  subcommand: 'reply',
  description: 'Reply into an existing thread.',
  examples: ['bison replies reply <reply-id> --message "Thanks!" --sender-email-id 216'],
  inputSchema: z.object({
    reply_id: z.string().describe('Reply ID to respond to'),
    message: z.string().optional().describe('Reply body (HTML or text)'),
    body_text: z.string().optional().describe('Alias for --message'),
    body_html: z.string().optional().describe('Alias for --message (HTML)'),
    sender_email_id: z.coerce.number().optional().describe('Sender inbox id (defaults to thread inbox)'),
    content_type: z.string().optional().describe('html | text (default html)'),
    to_email: z.string().optional().describe('Recipient email (optional)'),
  }),
  cliMappings: {
    args: [{ field: 'reply_id', name: 'reply-id', required: true }],
    options: [
      { field: 'message', flags: '--message <text>', description: 'Reply body' },
      { field: 'body_text', flags: '--body-text <text>', description: 'Alias for --message' },
      { field: 'body_html', flags: '--body-html <html>', description: 'Alias for --message (HTML)' },
      { field: 'sender_email_id', flags: '--sender-email-id <id>', description: 'Sender inbox id' },
      { field: 'content_type', flags: '--content-type <type>', description: 'html | text' },
      { field: 'to_email', flags: '--to-email <email>', description: 'Recipient email' },
    ],
  },
  endpoint: { method: 'POST', path: '/api/replies/{reply_id}/reply' },
  fieldMappings: {
    reply_id: 'path', message: 'body', body_text: 'body', body_html: 'body',
    sender_email_id: 'body', content_type: 'body', to_email: 'body',
  },
  transformBody: (body) => {
    body.message = body.message ?? body.body_html ?? body.body_text;
    if (body.content_type == null) body.content_type = body.body_html ? 'html' : 'html';
    delete body.body_text; delete body.body_html;
    if (body.inject_previous_email_body === undefined) body.inject_previous_email_body = true;
    body.reply_all = body.reply_all ?? false;
    if (body.to_email) { body.to_emails = [{ email_address: body.to_email }]; delete body.to_email; }
    return body;
  },
  handler: (input, client) => executeCommand(repliesReplyCommand, input, client),
};
