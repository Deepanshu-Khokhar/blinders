'use strict';

const MODES = new Set(['answer', 'review', 'change', 'monitor', 'open']);
const LEVELS = new Set(['watch', 'guard', 'lock', 'off']);
const HASH_POLICIES = new Set(['deny', 'ask', 'allow']);
const SCOPE_POLICIES = new Set(['deny', 'ask', 'allow']);
const DEFAULT_AGENT_LIMIT = Number.MAX_SAFE_INTEGER;

function defaultContract() {
  return {
    mode: 'unconfirmed',
    level: 'watch',
    agentBudget: DEFAULT_AGENT_LIMIT,
    hashPolicy: 'deny',
    allowedPaths: null,
    dependencyPolicy: 'ask',
    source: 'default'
  };
}

function directiveHead(prompt, matchEnd) {
  const tail = prompt.slice(matchEnd).replace(/^[ \t]+/, '');
  const boundaries = [tail.indexOf('--'), tail.search(/:(?=\s|$)/), tail.indexOf('\n')]
    .filter((index) => index >= 0);
  const end = boundaries.length ? Math.min(...boundaries) : tail.length;
  return tail.slice(0, end).trim();
}

function parseDirective(prompt) {
  // A directive starts the first non-empty line, outside quoted/code content.
  // Four spaces or a tab denote an indented code example, not an invocation.
  const mention = /^(?:[ \t]*\r?\n)* {0,3}\$blinders(?=$|[\s,:])/i.exec(prompt);
  if (!mention) return null;

  const head = directiveHead(prompt, mention.index + mention[0].length);
  const tokens = head.split(/[\s,]+/).map((token) => token.trim()).filter(Boolean);
  const parsed = { mentioned: true, error: null, warning: null };

  function setField(field, value, token) {
    if (Object.hasOwn(parsed, field) && JSON.stringify(parsed[field]) !== JSON.stringify(value)) {
      parsed.error = {
        code: 'CONFLICTING_DIRECTIVE', token,
        message: `Conflicting values for ${field}. Submit one value per directive field.`
      };
    } else {
      parsed[field] = value;
    }
  }

  for (const rawToken of tokens) {
    if (parsed.error) break;
    const token = rawToken.toLowerCase();
    if (MODES.has(token)) {
      setField('mode', token, rawToken);
      continue;
    }
    if (LEVELS.has(token)) {
      setField('level', token, rawToken);
      continue;
    }
    const agents = /^agents=(.*)$/i.exec(rawToken);
    if (agents) {
      const value = parseAgentLimit(agents[1]);
      if (value === null) {
        parsed.error = invalidAgentLimit(rawToken);
        break;
      }
      setField('agentBudget', value, rawToken);
      continue;
    }
    if (/^agents$/i.test(rawToken)) {
      parsed.error = {
        code: 'INVALID_AGENT_LIMIT',
        token: rawToken,
        message: `${rawToken} must be a non-negative safe integer.`
      };
      break;
    }
    if (/^(?:total-agents|concurrent-agents)(?:=|$)/i.test(rawToken)) {
      parsed.error = {
        code: 'UNSUPPORTED_AGENT_DIRECTIVE',
        token: rawToken,
        message: 'Use agents=N to set the maximum number of concurrently active subagents.'
      };
      break;
    }
    const hash = /^hash=(deny|ask|allow)$/.exec(token);
    if (hash && HASH_POLICIES.has(hash[1])) {
      setField('hashPolicy', hash[1], rawToken);
      continue;
    }
    const files = /^files=(.*)$/i.exec(rawToken);
    if (files) {
      setField('allowedPaths', files[1].split('|').map((value) => value.replace(/\\/g, '/')).filter(Boolean), rawToken);
      continue;
    }
    const dependencies = /^deps=(deny|ask|allow)$/.exec(token);
    if (dependencies && SCOPE_POLICIES.has(dependencies[1])) {
      setField('dependencyPolicy', dependencies[1], rawToken);
      continue;
    }
    parsed.error = {
      code: 'INVALID_DIRECTIVE_TOKEN', token: rawToken,
      message: 'Unknown directive field. Put task text after -- or on the next line.'
    };
  }

  return parsed;
}

function parseAgentLimit(value) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function invalidAgentLimit(token) {
  return {
    code: 'INVALID_AGENT_LIMIT',
    token,
    message: `${token} must be a non-negative safe integer.`
  };
}

function correctionProse(prompt) {
  let fence = null;
  // Keep a separator: removing an example must not join words into a new
  // instruction, or expose a quoted "fix" as the start of the user's prompt.
  const omitted = '\uFFFC';
  return prompt.split(/\r?\n/).map((line) => {
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === fence[0] && close[1].length >= fence.length) fence = null;
      return omitted;
    }
    if (/^(?: {0,3}>| {4}|\t)/.test(line)) return omitted;
    const open = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (open && (open[1][0] !== '`' || !line.slice(open[0].length).includes('`'))) {
      fence = open[1];
      return omitted;
    }
    return line;
  }).join('\n')
    .replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, omitted)
    .replace(/"(?:\\.|[^"\\])*"|(?<![\p{L}\p{N}\\])'[\s\S]*?(?<!\\)'(?![\p{L}\p{N}])|“[^”]*”|‘[^’]*’|「[^」]*」|『[^』]*』/gu, omitted)
    .trim();
}

function naturalCorrection(prompt, previous) {
  const text = correctionProse(prompt);

  if (/^(?:stop|stop now|停止|停下来)[.!。！\s]*$/i.test(text)) {
    return { mode: 'answer', source: 'explicit-stop' };
  }
  if (/\breview only\b|\b(?:do not|don't) (?:edit|change|fix) (?:anything|the (?:repo|repository|files?|code))\b|只审查|只看不改|不要修改(?:任何|代码|文件)/i.test(text)) {
    return { mode: 'review', source: 'natural-explicit' };
  }
  if (/\banswer only\b|只回答/i.test(text)) {
    return { mode: 'answer', source: 'natural-explicit' };
  }
  // A standalone observation instruction changes authority. An object such as
  // "只观察实际定时轮次" limits what to inspect, not what the task may change.
  if (/\bmonitor only\b/i.test(text)
      || /(?:^|[\n，,。.!！；;：:])[ \t]*(?:(?:请|继续|这次|本次|现在|接下来|先)[ \t]*)*只(?:监控|观察)(?:[ \t]*(?:即可|就好|就行|一下))?[ \t]*(?=$|[\n，,。.!！；;])/u.test(text)) {
    return { mode: 'monitor', source: 'natural-explicit' };
  }

  const wasNonMutating = ['answer', 'review', 'monitor'].includes(previous.mode);
  const explicitChange = /^(?:please\s+)?(?:fix|implement|change|apply|patch)\b|^(?:请)?(?:修复|修改|实现|应用补丁)|^把.+(?:修复|修改|改掉)/i.test(text);
  if (wasNonMutating && explicitChange) {
    return { mode: 'change', source: 'natural-explicit' };
  }

  return null;
}

// Ambient scope: no directive is typed, so the request itself is read for a
// task shape. Only mode and dependency authority are inferred; a path boundary
// is never guessed from prose. Explicit directives always win.
const CHANGE_REQUEST = /\b(?:fix|add|implement|build|create|change|update|adjust|tweak|refactor|rename|remove|delete|replace|move|extract|split|merge|wire|migrate|upgrade|bump|install|patch|apply|convert|optimi[sz]e|improve|rewrite|set\s+up|clean\s+up)\b/i;
const READ_REQUEST = /^(?:please\s+)?(?:(?:now|then|next|ok|okay|alright|so|and|also)\s+)*(?:(?:can|could|would)\s+you\s+|let's\s+|lets\s+)?(?:review|audit|analy[sz]e|explain|inspect|investigate|diagnose|summari[sz]e|compare|trace|check|read|look\s+(?:at|into)|tell\s+me|show\s+me|walk\s+me|find\s+(?:the\s+)?(?:cause|problem|issue))\b/i;
const DEPENDENCY_REQUEST = /\b(?:npm|pnpm|yarn|bun)\s+(?:i|add|install)\b|\b(?:pip3?|uv|poetry)\s+(?:add|install)\b|\bcargo\s+add\b|\bgo\s+get\b|\b(?:upgrade|bump)\s+[a-z@][\w@/.-]*\s+to\b|\b(?:add|install|introduce|bring\s+in|pull\s+in|upgrade|bump|update)\b[^.\n]{0,48}\b(?:dependenc(?:y|ies)|packages?|librar(?:y|ies)|modules?)\b/i;
const INSTALL_TARGET = /\b(?:install|add)\s+(@?[a-z][\w@/.-]{1,60})/gi;
const NOT_A_PACKAGE = new Set(['it', 'them', 'this', 'that', 'these', 'those', 'everything', 'all', 'something', 'the', 'a', 'an', 'and', 'then', 'now', 'first', 'again', 'locally', 'globally', 'properly', 'correctly', 'one', 'two', 'some', 'more', 'tests', 'test', 'code', 'docs', 'support', 'handling', 'logging', 'caching', 'metrics', 'retries', 'validation', 'comments']);

function mentionsDependency(prose) {
  if (DEPENDENCY_REQUEST.test(prose)) return true;
  for (const match of prose.matchAll(INSTALL_TARGET)) {
    if (!NOT_A_PACKAGE.has(match[1].toLowerCase())) return true;
  }
  return false;
}
const NEGATED_CLAUSE = /\b(?:do not|don't|dont|never)\b[^,.;\n]{0,60}/gi;
const PROHIBITS_EDITS = /\b(?:do not|don't|dont|never)\b[^,.;\n]{0,40}\b(?:change|edit|modify|touch|write)\b|\bno\s+(?:code\s+|file\s+)?(?:changes?|edits?|modifications?|rewrites?)\b|\bread[- ]only\b|\bwithout\s+(?:changing|editing|modifying|touching)\b/i;
const NEGATED_DEPS = /\b(?:do not|don't|dont|never|no|without)\b[^,.;\n]{0,40}\b(?:dependenc(?:y|ies)|new\s+(?:deps|packages?|librar(?:y|ies)))\b/i;

function inferAmbientMode(prompt) {
  const prose = correctionProse(prompt).replace(/<([a-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  if (!prose) return null;
  // Drop a prohibition clause so "don't change the API, fix the parser" still
  // reads as implementation work. A bare prohibition then falls to review.
  const active = prose.replace(NEGATED_CLAUSE, ' ').replace(/\uFFFC+/g, ' ').trim();
  if (!active) return null;
  if (CHANGE_REQUEST.test(active)) return 'change';
  if (READ_REQUEST.test(active)) return 'review';
  if (PROHIBITS_EDITS.test(prose)) return 'review';
  if (/\?\s*$/.test(active)) return 'review';
  return null;
}

function ambientContract(contract, prompt) {
  // A typed directive, a natural correction, recovery, or an explicit off all
  // outrank inference. Ambience is a starting point, not an override.
  if (contract.level === 'off') return null;
  if (contract.source && contract.source !== 'default' && !/^ambient/.test(contract.source)) return null;
  if (!String(prompt || '').trim()) return null;
  const inferred = inferAmbientMode(prompt);
  // A first request with no readable shape still arms open authority, so the
  // agent is never left shadowing the turn. Later turns keep the shape they have.
  const mode = inferred || (contract.mode === 'unconfirmed' ? 'open' : null);
  if (!mode) return null;
  const prose = correctionProse(prompt).replace(/<([a-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  const dependency = mode === 'change'
    && mentionsDependency(prose)
    && !NEGATED_DEPS.test(prose);
  const changedMode = mode !== contract.mode;
  if (!changedMode && !(dependency && contract.dependencyPolicy !== 'allow')) return null;
  return { mode, dependency };
}

function unarmedDirectiveWarning(prompt) {
  // Report an unquoted standalone directive without treating it as authority.
  // Host-generated prefixes and user introductions cannot be distinguished
  // from this text alone, so neither is removed to make a directive eligible.
  const prose = correctionProse(prompt);
  if (!/^ {0,3}\$blinders(?=$|[\s,:])/im.test(prose)) return null;
  return {
    code: 'DIRECTIVE_NOT_ARMED',
    message: 'DIRECTIVE_NOT_ARMED: a Blinders directive was not applied because it does not start the first non-empty line of the received prompt. Send the directive first in a separate message and check $blinders status before continuing.'
  };
}

function validAgentBudget(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeContract(previousContract) {
  const supplied = previousContract && typeof previousContract === 'object' ? previousContract : {};
  const previous = { ...defaultContract(), ...supplied };
  const suppliedAgentBudget = validAgentBudget(supplied.agentBudget);
  const concurrentAgentBudget = validAgentBudget(supplied.concurrentAgentBudget);
  const totalAgentBudget = validAgentBudget(supplied.totalAgentBudget);
  previous.agentBudget = suppliedAgentBudget
    ?? (concurrentAgentBudget !== null && concurrentAgentBudget !== DEFAULT_AGENT_LIMIT
      ? concurrentAgentBudget
      : totalAgentBudget !== null && totalAgentBudget !== DEFAULT_AGENT_LIMIT
        ? totalAgentBudget
        : DEFAULT_AGENT_LIMIT);
  delete previous.totalAgentBudget;
  delete previous.concurrentAgentBudget;
  delete previous.agentsUsed;
  return previous;
}

function parseContractPrompt(prompt, previousContract = defaultContract()) {
  const previous = normalizeContract(previousContract);
  const text = String(prompt || '');
  const directive = parseDirective(text);
  const correction = naturalCorrection(text, previous);
  const next = { ...previous };
  let changed = false;
  let ambientApplied = false;

  if (directive) {
    if (directive.error) {
      return {
        contract: previous,
        changed: false,
        directive: true,
        correction: Boolean(correction),
        warning: null,
        error: directive.error
      };
    }
    if (directive.mode && directive.mode !== next.mode) {
      next.mode = directive.mode;
      changed = true;
    }
    if (directive.level && directive.level !== next.level) {
      next.level = directive.level;
      changed = true;
    }
    if (Number.isInteger(directive.agentBudget) && directive.agentBudget !== next.agentBudget) {
      next.agentBudget = directive.agentBudget;
      changed = true;
    }
    if (directive.hashPolicy && directive.hashPolicy !== next.hashPolicy) {
      next.hashPolicy = directive.hashPolicy;
      changed = true;
    }
    if (Array.isArray(directive.allowedPaths)) {
      next.allowedPaths = directive.allowedPaths;
      changed = true;
    }
    if (directive.dependencyPolicy && directive.dependencyPolicy !== next.dependencyPolicy) {
      next.dependencyPolicy = directive.dependencyPolicy;
      changed = true;
    }
    if (directive.mode && !directive.level && next.level === 'watch') {
      next.level = 'guard';
      changed = true;
    }
    if (directive.level === 'off') {
      next.level = 'off';
    }
    next.source = 'directive';
  } else if (correction) {
    if (correction.mode !== next.mode) {
      next.mode = correction.mode;
      changed = true;
    }
    if (next.level === 'watch') {
      next.level = 'guard';
      changed = true;
    }
    next.source = correction.source;
  } else {
    const ambient = ambientContract(next, text);
    if (ambient) {
      if (ambient.mode !== next.mode) {
        next.mode = ambient.mode;
        changed = true;
      }
      if (ambient.dependency && next.dependencyPolicy !== 'allow') {
        next.dependencyPolicy = 'allow';
        changed = true;
      }
      if (next.level === 'watch') {
        next.level = 'guard';
        changed = true;
      }
      next.source = 'ambient';
      ambientApplied = true;
    }
  }

  if (next.mode === 'unconfirmed' && next.level !== 'off') {
    next.level = 'watch';
  }

  return {
    contract: next,
    changed,
    directive: Boolean(directive),
    correction: Boolean(correction),
    ambient: ambientApplied,
    warning: directive ? directive.warning : unarmedDirectiveWarning(text),
    error: null
  };
}

module.exports = {
  HASH_POLICIES,
  SCOPE_POLICIES,
  LEVELS,
  MODES,
  DEFAULT_AGENT_LIMIT,
  defaultContract,
  inferAmbientMode,
  normalizeContract,
  parseContractPrompt
};
