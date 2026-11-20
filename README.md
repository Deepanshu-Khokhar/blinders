<p align="center"><img src="assets/icon.png" alt="" width="96"></p>

<h1 align="center">Blinders</h1>

<p align="center"><b>Your coding agent, with blinders on. It sees the task, not the tempting detour.</b></p>

<p align="center">
  <img alt="Claude Code and OpenCode" src="https://img.shields.io/badge/hosts-Claude%20Code%20%7C%20OpenCode-2ea44f">
  <img alt="Node 18 or newer" src="https://img.shields.io/badge/node-%E2%89%A518-2ea44f">
  <img alt="No telemetry" src="https://img.shields.io/badge/telemetry-none-2ea44f">
</p>

Coding agents are good at doing more than you asked: a one-line fix arrives with a new dependency, a refactor of a file nothing needed, and a verification run that repeats a check that already passed. A written contract for the turn — the mode, the files, the dependency policy, the subagent budget — gives the agent a boundary, and every tool call is held to it while the work happens.

Two layers, one idea:

- **The skill** tells the agent how to decide what belongs in the change. It works alone, in any host that supports skills.
- **The guard** enforces the contract at the host's tool boundary, locally, on every tool call. It works in **Claude Code** and **OpenCode**.

No account, no service, no telemetry. State and audit logs stay on your machine.

```
$blinders change files=src/auth/** -- fix the token refresh race
```

---

## Quick start

**Claude Code**

```sh
/plugin marketplace add Deepanshu-Khokhar/blinders
/plugin install blinders@blinders
```

**OpenCode**

```sh
opencode plugin add github:Deepanshu-Khokhar/blinders
```

Then, in the first message of the task, write the contract:

```
$blinders change files=src/parser.js|test/parser.test.js -- reject empty keys and cover it
```

Full setup, pinning, and project-level install in [INSTALL.md](INSTALL.md).

---

## The problem it targets

| What happens | What it costs |
| --- | --- |
| The agent adds an abstraction, retry loop, or validation layer nobody asked for | Review time, more surface to maintain, a diff that hides the actual fix |
| The fix spreads into unrelated files | Conflicts, harder revert, unclear ownership |
| A dependency appears mid-task | Supply chain, license, and build changes that were never approved |
| The same check runs three times, or a weaker one replaces a real safeguard | Wasted turns, or a false sense of coverage |
| A review turn starts editing files | Changes made without an explicit decision to change anything |
| Subagents multiply and duplicate each other's work | Token spend, contradictory edits, merge noise |

Blinders does not try to make the agent smarter. It makes the boundary explicit and makes crossing it visible.

---

## How it works

```
 your message                     every host tool call
      |                                    |
      v                                    v
 directive parser  ->  contract state  ->  decision  ->  allow / ask / deny
      |                    |                 |
      +-> skill context     +-> local audit log <--+
```

The contract lives in the conversation, not in a config file: each turn states what it may touch, so a read-only review turn and an implementation turn are visibly different.

### 1. A directive sets the contract

The directive is a normal message. It starts the first non-empty line, names the mode, optionally sets boundaries, then `--` and the task.

```
$blinders <mode> [files=…] [deps=deny|ask|allow] [hash=deny|ask|allow] [agents=N] -- <task>
```

| Mode | What the agent may do |
| --- | --- |
| `answer` | Read, explain, and answer. No repository mutation. |
| `review` | Inspect and report findings. No repository mutation. |
| `change` | Mutate only inside the declared boundary. |
| `monitor` | Watch and report. No repository mutation. |
| `open` | No file boundary for this turn. Dependency and hash policies still apply. |

| Boundary | Meaning | Default |
| --- | --- | --- |
| `files=` | Paths the turn may write, separated by `|`. A `dir/**` entry covers the subtree; `**` covers the workspace. | unbounded in `change`, none in read-only modes |
| `deps=deny\|ask\|allow` | Whether the turn may add or change dependencies. | `ask` |
| `hash=deny\|ask\|allow` | Whether the turn may write to location-bound or pinned content. | `deny` |
| `agents=N` | Maximum concurrently active subagents. | host limit |

### 2. The skill shapes the decision

Inside the contract, the agent follows the **Scope Ladder** — a short decision procedure, not a checklist:

1. **Understand the responsibility.** Requested result, boundaries, and guarantees the change must preserve. Trace callers and failure paths before choosing a fix.
2. **Start with a direct solution.** Look at existing code, platform features, and installed dependencies first.
3. **Expand only to close a concrete gap.** Hypothetical future flexibility is not a gap.
4. **Judge defenses by effect.** Keep what detects or prevents a real failure; drop what only looks careful.
5. **Verify the result and finish.** Run the check that distinguishes broken from fixed; repeat only when the code or hypothesis changed. Stop when it passes, and report the evidence and anything left out of scope.

### 3. The guard holds the line

On every tool call, the guard maps the host's tool name and arguments to an action (`read`, `write`, `control`, or `delegate`), compares it with the active contract, and returns one of three decisions: allow, ask, or deny, with a machine-readable reason. Denials go back to the agent as guidance it can act on, not as a dead end.

| Reason code | Trigger |
| --- | --- |
| `I/MODE_FORBIDS_MUTATION` | A write in `answer`, `review`, or `monitor` mode |
| `I/MUTABILITY_UNPROVEN` | An action that cannot be proven read-only in a read-only mode |
| `S/PATH_OUTSIDE_CONTRACT` | A write to a path outside `files=` |
| `S/WRITE_PATH_UNPROVEN` | A tool that may write, but whose target cannot be proven inside the boundary |
| `S/DEPENDENCY_NOT_AUTHORIZED` | A dependency change while `deps=ask` or `deps=deny` |
| `H/HASH_NOT_AUTHORIZED` | A write to location-bound content while `hash=deny` or `hash=ask` |
| `S/UNBOUNDED_DELEGATION` | Delegation without a finite `agents=N` limit |
| `S/AGENT_BUDGET_EXHAUSTED` | A new subagent past `agents=N` |
| `S/UNAPPROVED_SCOPE_EXPANSION` | A scope change the active contract does not authorize |

Each decision is appended to a local JSONL audit log with the event ID, mode, action, and reason.

---

## Where it helps

| Area | What the contract changes | What improves |
| --- | --- | --- |
| **Bug fixes** | One failing path, one boundary, one regression check that distinguishes broken from fixed behavior. | Fewer drive-by edits; a fix you can revert alone. |
| **Feature work** | Existing code and installed dependencies before new abstractions; affected callers finished inside the same boundary. | Smaller diffs that still complete the flow; fewer surprise dependencies. |
| **Code review** | `review` mode is read-only at the tool boundary, so findings stay findings. | No accidental edits during review; findings tied to a real input or failure. |
| **Reliability and security** | Existing safeguards are inspected before removal; the contract can pin content with `hash=deny`. | Less redundant machinery without weakening validation, access control, or recovery. |
| **Verification** | The check that proves the result is named up front; repeats need a reason. | Fewer identical runs, required and failure-path checks still covered. |
| **Delegation** | `agents=N` caps concurrent subagents; the contract follows the parent session. | Less duplicated exploration and fewer conflicting edits. |
| **Multi-step refactors** | The boundary can name a directory subtree and stay stable across turns. | Progress that stays inside the agreed surface. |

The effect depends on the model and the task. This repository ships no benchmark claims; the mechanism is inspectable, and the audit log shows what actually happened in your session.

---

## What it does not do

- **It is not a sandbox.** The guard decides on tool-call metadata. A determined agent, a malicious plugin, or a shell command that writes indirectly is not contained by it. Use host permissions, containers, and CI for that.
- **It fails open.** If the guard cannot evaluate an event, it logs the failure and lets the host continue. Scope control is not a security boundary.
- **It does not grade the result.** It can keep a change small and inside the boundary; it cannot tell you the change is correct. Run your tests.
- **It does not replace project instructions, linters, or review.** It adds a turn-level contract on top of them.

---

## Install

### Claude Code

```sh
/plugin marketplace add Deepanshu-Khokhar/blinders
/plugin install blinders@blinders
```

The plugin registers the hooks and both skills. Check it:

```sh
/blinders status
```

### OpenCode

```sh
opencode plugin add github:Deepanshu-Khokhar/blinders
```

To pin a revision or install into a project, see [INSTALL.md](INSTALL.md).

### Skills only

The guard is optional. Both skills are plain directories with a `SKILL.md`:

- `skills/blinders` — the full decision procedure for implementation work.
- `skills/scope-lite` — a compact companion for reader-facing prose that strips defensive hedging without removing real limits.

Copy a directory into `.claude/skills/` or `.opencode/skills/`, or point the `skills` config array at it. Claude Code's plugin install already includes both.

### Verify the guard

The `blinders` CLI is part of the package. It is on your `PATH` after a global
install; from a checkout, run it through npm:

```sh
npm run blinders -- doctor
npm run blinders -- runtime
```

`blinders doctor` reports the plugin version, data directory, and log state. `blinders runtime` lists recent decisions.

---

## Daily use

**A review that cannot edit:**

```
$blinders review -- find the cause of the duplicate order submission
```

**A change with a narrow surface:**

```
$blinders change files=src/orders/** -- fix it and add the regression test
```

**A change that may add one dependency:**

```
$blinders change deps=allow files=package.json|src/pdf/** -- generate the invoice PDF
```

**Correcting course mid-turn:**

> That is outside the scope. Keep the change to the retry boundary.

A plain-language correction replaces the previous instruction. The guard reads the correction as the new contract instead of continuing the old one, and a repeated confirmation loop is answered with the recorded state.

**Status:**

```
$blinders status
$blinders runtime
$blinders explain evt_…
```

---

## Audit trail

Every decision is local, metadata-only, and readable:

```sh
npm run blinders -- runtime                     # recent events for the active data directory
npm run blinders -- explain <eventId>           # one decision with its annotations
npm run blinders -- label <eventId> correct     # mark an outcome for later review
```

From a global install, drop the `npm run` prefix and call `blinders` directly.

The log records the tool name, mutability class, mode, decision, reason code, and event ID. It does not record prompts, file paths, file contents, or command output. See [PRIVACY.md](PRIVACY.md).

---

## Repository layout

```
skills/blinders/   the decision procedure (SKILL.md)
skills/scope-lite/          compact prose companion
src/                        contract parsing, decisions, state, audit
hooks/                      Claude Code hook entry and registration
opencode/                   OpenCode V1 and V2 plugin entries
scripts/blinders.cjs             doctor, runtime, explain, label, case tools
.claude-plugin/             plugin and marketplace manifests
```

---

## Design rules

1. **The contract is text you can read.** The directive is in the conversation, and the decision is in the log.
2. **Allow by default inside the boundary.** The guard narrows scope; it does not make the agent ask permission for ordinary work.
3. **Deny with a next step.** Every refusal names the rule and what would satisfy it.
4. **Local first.** No account, no server, no telemetry. The only outbound call is an optional release check in `blinders doctor --check-update`.
5. **Fail open and say so.** A guard bug must not block your work; it must be visible in the log.

---

## Status

Version 1.0.0. Supports Claude Code and OpenCode (V1 and V2 plugin APIs) on Node.js 18 or newer. The skill layer is host-agnostic and works without the guard.

Issues and concrete reproductions are welcome: [github.com/Deepanshu-Khokhar/blinders/issues](https://github.com/Deepanshu-Khokhar/blinders/issues).
