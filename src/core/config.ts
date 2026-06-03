import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { BisonConfig } from './types.js';

const CONFIG_DIR = join(homedir(), '.emailbison');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function ensureDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): BisonConfig {
  try {
    if (!existsSync(CONFIG_FILE)) return {};
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw) as BisonConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: BisonConfig): void {
  ensureDir();
  const existing = loadConfig();
  const merged = { ...existing, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
}

export function deleteConfig(): void {
  try {
    if (existsSync(CONFIG_FILE)) unlinkSync(CONFIG_FILE);
  } catch {
    // ignore
  }
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

const WORKSPACES_FILE = join(CONFIG_DIR, 'workspaces.json');

export interface WorkspaceEntry {
  api_key: string;
  base_url: string;
}

// ~/.emailbison/workspaces.json  ->  { "bluesteps": {api_key, base_url}, "clearspider": {...} }
// Enables `bison --workspace <name> ...` to switch workspaces without re-auth.
export function loadWorkspaces(): Record<string, WorkspaceEntry> {
  try {
    if (!existsSync(WORKSPACES_FILE)) return {};
    return JSON.parse(readFileSync(WORKSPACES_FILE, 'utf-8')) as Record<string, WorkspaceEntry>;
  } catch {
    return {};
  }
}
