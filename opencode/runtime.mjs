import os from 'node:os';
import path from 'node:path';

export function resolveDataDir(options) {
  if (typeof options.dataDir === 'string' && options.dataDir) return options.dataDir;
  const root = process.platform === 'win32'
    ? process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
    : process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(root, 'opencode', 'engineering-scope');
}

// The parser, rather than a mention inside a quote, owns contract changes.
export function mentionsDirective(text) {
  return /\$engineering-scope\b/i.test(String(text || ''));
}

export function directiveErrorText(error) {
  return `Engineering Scope directive rejected (${error.code}): ${error.message} `
    + 'The previous contract is unchanged. Tools are paused until you submit a corrected instruction.';
}
