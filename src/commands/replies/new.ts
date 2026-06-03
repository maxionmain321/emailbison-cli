import { z } from 'zod';
import type { CommandDefinition } from '../../core/types.js';
import { executeCommand } from '../../core/handler.js';

// FIXED for self-hosted EmailBison: server wants `message` / `sender_email_id` /
// `to_emails[]` / `content_type`, not body_text / from_sender_email_id / to_email.
export const repliesNewCommand: CommandDefinition = {
  name: 'replies_new',
  group: 'replies',
  subcommand: 'new',
  description: 'Send a fresh email (new thread) to any recipient.',
  examples: [
    'bison replies new --to-email user@example.com --sender-email-id 216 --subject "Hello" --message "Hi there"',
  ],
  inputSchema: z.object({
    to_email: z.string().describe('Recipient email address'),
    sender_email_id: z.coerce.number().describe('Sender inbox id'),
    subject: z.string().optional().describe('Email subject'),
    message: z.string().optional().describe('Body (HTML or text)'),
    body_text: z.string().optional().describe('Alias for --message'),
    body_html: z.string().optional().describe('Alias for --message (HTML)'),
    content_type: z.string().optional().describe('html | text (default html)'),
  }),
  cliMappings: {
    options: [
      { field: 'to_email', flags: '--to-email <email>', description: 'Recipient email address' },
      { field: 'sender_email_id', flags: '--sender-email-id <id>', description: 'Sender inbox id' },
      { field: 'subject', flags: '--subject <text>', description: 'Email subject' },
      { field: 'message', flags: '--message <text>', description: 'Body' },
      { field: 'body_text', flags: '--body-text <text>', description: 'Alias for --message' },
      { field: 'body_html', flags: '--body-html <html>', description: 'Alias for --message (HTML)' },
      { field: 'content_type', flags: '--content-type <type>', description: 'html | text' },
    ],
  },
  endpoint: { method: 'POST', path: '/api/replies/new' },
  fieldMappings: {
    to_email: 'body', sender_email_id: 'body', subject: 'body',
    message: 'body', body_text: 'body', body_html: 'body', content_type: 'body',
  },
  transformBody: (body) => {
    body.message = body.message ?? body.body_html ?? body.body_text;
    if (body.content_type == null) body.content_type = 'html';
    delete body.body_text; delete body.body_html;
    if (body.to_email) { body.to_emails = [{ email_address: body.to_email }]; delete body.to_email; }
    return body;
  },
  handler: (input, client) => executeCommand(repliesNewCommand, input, client),
};
