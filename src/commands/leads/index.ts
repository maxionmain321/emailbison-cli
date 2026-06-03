import { leadsListCommand } from './list.js';
import { leadsGetCommand } from './get.js';
import { leadsCreateCommand } from './create.js';
import { leadsCreateMultipleCommand } from './create-multiple.js';
import { leadsCreateOrUpdateCommand } from './create-or-update.js';
import { leadsCreateOrUpdateMultipleCommand } from './create-or-update-multiple.js';
import { leadsUpdateCommand } from './update.js';
import { leadsReplaceCommand } from './replace.js';
import { leadsDeleteCommand } from './delete.js';
import { leadsBulkDeleteCommand } from './bulk-delete.js';
import { leadsBulkCsvCommand } from './bulk-csv.js';
import { leadsUpdateStatusCommand } from './update-status.js';
import { leadsBulkUpdateStatusCommand } from './bulk-update-status.js';
import { leadsUnsubscribeCommand } from './unsubscribe.js';
import { leadsBlacklistCommand } from './blacklist.js';
import { leadsRepliesCommand } from './replies.js';
import { leadsSentEmailsCommand } from './sent-emails.js';
import { leadsScheduledEmailsCommand } from './scheduled-emails.js';
import { leadsUpsertCommand } from './upsert.js';

export const leadCommands = [
  leadsUpsertCommand,
  leadsListCommand,
  leadsGetCommand,
  leadsCreateCommand,
  leadsCreateMultipleCommand,
  leadsCreateOrUpdateCommand,
  leadsCreateOrUpdateMultipleCommand,
  leadsUpdateCommand,
  leadsReplaceCommand,
  leadsDeleteCommand,
  leadsBulkDeleteCommand,
  leadsBulkCsvCommand,
  leadsUpdateStatusCommand,
  leadsBulkUpdateStatusCommand,
  leadsUnsubscribeCommand,
  leadsBlacklistCommand,
  leadsRepliesCommand,
  leadsSentEmailsCommand,
  leadsScheduledEmailsCommand,
];
