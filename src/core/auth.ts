import { loadConfig, loadWorkspaces } from './config.js';
import { AuthError } from './errors.js';

export interface AuthContext {
  apiKey: string;
  baseUrl: string;
}

export function resolveAuth(opts?: { apiKey?: string; baseUrl?: string; workspace?: string }): AuthContext {
  const config = loadConfig();

  // --workspace <name> resolves api_key + base_url from ~/.emailbison/workspaces.json,
  // so you can switch workspaces without re-auth. --api-key flag still wins if both given.
  let wsKey: string | undefined;
  let wsBase: string | undefined;
  if (opts?.workspace) {
    const ws = loadWorkspaces()[opts.workspace.toLowerCase()];
    if (!ws) {
      throw new AuthError(`Unknown workspace "${opts.workspace}". Add it to ~/.emailbison/workspaces.json.`);
    }
    wsKey = ws.api_key;
    wsBase = ws.base_url;
  }

  const apiKey = opts?.apiKey ?? wsKey ?? process.env.EMAILBISON_API_KEY ?? config.api_key;

  if (!apiKey) {
    throw new AuthError('No API key found. Run "bison login", use --workspace, or set EMAILBISON_API_KEY.');
  }

  const baseUrl = opts?.baseUrl ?? wsBase ?? process.env.EMAILBISON_BASE_URL ?? config.base_url;

  if (!baseUrl) {
    throw new AuthError('No base URL found. Run "bison login", use --workspace, or set EMAILBISON_BASE_URL.');
  }

  return { apiKey, baseUrl: baseUrl.replace(/\/+$/, '') };
}
