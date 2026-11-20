# Install Blinders

These instructions target version 1.0.0. For local checkout validation, use the
flow under [Verify the source](#verify-the-source).

## Claude Code: Skill + Guard

The Guard requires Node.js 18 or newer. Install from GitHub:

```bash
/plugin marketplace add Deepanshu-Khokhar/blinders
/plugin install blinders@blinders
```

From a local checkout, register the checkout itself as a marketplace:

```bash
claude plugin validate .
claude plugin marketplace add ./
claude plugin install blinders@blinders
```

Restart Claude Code after installation. The packaged manifest registers:

- `SessionStart` — injects the current contract into a new session;
- `UserPromptSubmit` — reads host-neutral `$blinders ...` directives,
  natural explicit corrections, and the direct namespaced slash form
  (`/blinders:blinders ...`). Handling the slash form here
  keeps direct Skill invocation armed even on hosts that do not expose the
  `UserPromptExpansion` event;
- `PreToolUse` — classifies covered actions and can return permission deny;
- `SubagentStart` — injects the current contract into a started subagent. Agent
  budget enforcement happens earlier on `PreToolUse` for the `Agent` tool;
- `PostToolUse` — reads available delegation results;
- `PostToolUseFailure` — preserves capacity when completion is unproven;
- `PermissionDenied` — releases a reservation for a call confirmed not started;
- `SessionEnd` — preserves unresolved activity rather than assuming completion.

Hosts that expose `UserPromptExpansion` may register it for earlier,
pre-expansion arming; the adapter keeps that handler, but the packaged
`hooks/hooks.json` stays limited to events every supported host accepts.

## OpenCode: install from GitHub

OpenCode V1 1.18.18 or newer can install this repository directly from GitHub
without a checkout or npm publication:

```bash
opencode plugin add github:Deepanshu-Khokhar/blinders
```

The command installs the package into OpenCode's cache and adds the GitHub spec
to the global OpenCode configuration. Package lifecycle scripts are not run.
Restart OpenCode, then set a contract with the host-neutral form:

```text
$blinders review -- Review this diff; do not edit.
```

The plugin installs the executable Guard. It does not automatically
register the bundled Skill or an `/blinders` alias. To add only the optional alias,
put this entry in your OpenCode configuration:

```json
{
  "command": {
    "blinders": {
      "description": "Set the Blinders task contract",
      "template": "$blinders $ARGUMENTS"
    }
  }
}
```

OpenCode V1 denies covered actions by throwing before tool execution. `deps=ask`
and `hash=ask` therefore stop the action and ask you to submit a new explicit
`allow` contract; they do not open a second interactive permission prompt.

Contract state and runtime metadata use `blinders/` below `opencode/`
in the OpenCode state directory: `XDG_STATE_HOME` or `~/.local/state` on Unix,
and `LOCALAPPDATA` on Windows. A plugin `dataDir` option overrides this.
OpenCode V1 currently has no external-plugin uninstall subcommand; remove
`github:Deepanshu-Khokhar/blinders` from the global configuration's
`plugin` list, then restart OpenCode.

### OpenCode V2

The V2 adapter in this checkout targets OpenCode **2.0.18**. It shares the same
package and policy core with V1; V1's minimum remains **1.18.18**.

For local acceptance, install this checkout's dependencies with
`npm install --ignore-scripts`, then configure its **package directory**:

```json
{
  "plugins": [
    { "package": "/absolute/path/to/blinders" }
  ]
}
```

On Windows, use a path such as `C:/projects/blinders`. OpenCode 2.0.18
ignores explicitly configured single-file paths; point at the directory that
contains `package.json`. A packed local artifact can instead be installed with
`npm install --ignore-scripts /path/to/blinders.tgz`; configure the
installed `node_modules/blinders` directory. This does not require
lifecycle scripts.

The V2 CLI command is
`opencode plugin add github:Deepanshu-Khokhar/blinders`. V2 `plugin add`
accepts npm and Git sources, not local `.tgz` files. Local packed-host acceptance
does not establish GitHub-source installation; use the directory route for a
local checkout.

Restart OpenCode and use the same `$blinders review` / `change`
commands. For noninteractive `opencode run`, pass the directive through stdin:
these tested CLI versions quote positional messages containing spaces, which
makes the directive quoted text instead of an instruction.
V2 uses a typed tool error for a Guard denial, allowing the session to continue
with permitted actions. `deps=ask` and `hash=ask` still require an explicit new
contract. The optional `/blinders` alias above is a V1 configuration example.

V2 reads delivered root-session user messages, ignores synthetic and child
instructions as authority, and injects context before model requests. Native
`shell`, `patch`, `write`, `edit`, and `subagent` calls use the shared policy.
Finite `agents=N` contracts reject `subagent` continuation via `sessionID`;
start a new child instead. Unknown child outcomes retain reserved capacity.
Code Mode's direct JavaScript/network effects are not fully covered by tool
hooks. In review mode its unknown outer `execute` action is denied by the
existing policy; permitting it in change mode does not establish full coverage.

To remove the V2 plugin, remove its entry from `plugins` and restart. Keep the
same `dataDir` if one was configured. V2 plugin storage holds processed message
IDs and pending status/runtime query replies until delivery or session deletion.
Contract state and runtime evidence retain their existing format.

## Verify the source

Inspect these executable surfaces before trusting them:

- `hooks/hooks.json` and `hooks/blinders-claude.cjs` for Claude Code;
- `opencode/blinders.mjs`, `opencode/v2.mjs`, and `opencode/runtime.mjs`
  for OpenCode;
- `src/adapters/`;
- `src/`

From a local checkout, install the declared dependencies without running
package lifecycle scripts:

```bash
npm install --ignore-scripts
```

The `blinders` CLI reads local runtime evidence:

```bash
npm run blinders -- doctor
npm run blinders -- runtime
```

`blinders doctor` reports the resolved data directory and the number of runtime log
files. `blinders runtime` returns the stored metadata-only events. `blinders explain
<eventId>` shows one event with its labels, and `blinders label <eventId>
correct|incorrect|inconclusive` records a manual label.

## Directive entry

Submit one `$blinders` directive on the first non-empty line, outside
quotes and code blocks. Up to three leading spaces are accepted; four spaces
or a tab indicate a code example. Put task text after `--`, `: `, or a newline.
Do not put an introduction before the directive. Embedded examples do not set
directive fields. Unknown fields and conflicting values return an error and
preserve the previous contract; submit a corrected directive before continuing.

A standalone directive on a later line produces `DIRECTIVE_NOT_ARMED` context.
The directive does not set contract fields. Send it first in a separate message,
then query `$blinders status`. Quoted and fenced examples remain
context. The Hook does not remove prompt prefixes because its string input does
not identify whether they came from the host or supplied content.

For attachment inspection, `review` permits recognized read operations. An
arbitrary Python script or code-execution tool remains unproven, including
PDF/XLSX extraction. Creating extraction files needs explicit write authority
and a verifiable output boundary. `change files=...` still asks when a tool's
affected paths are unknown. A parser name or Skill description does not prove
that arbitrary code is read-only.

Natural-language mode corrections also skip code examples, explicit Markdown
quote lines, and quoted text. For example, adding a `review only` example to
README does not switch an active edit task to review.

XML fragments and other embedded text do not establish a trusted directive
source. To restore an authorized change, send `$blinders change -- ...`
as a direct message with the directive on the first non-empty line. Use the host
plugin manager directly to disable or uninstall the plugin when needed.

Claude Code returns a prompt-block response for an invalid directive. OpenCode
adds error context and pauses tool calls until a corrected instruction clears
the error. A valid directive also clears that pause. This input rejection does
not change the previous contract or the shared enforcement policy.

## Upgrade

Update the plugin or standalone Skill through its host installation flow, then
restart or reload. Checking a version is not an update.

`agents=N` means reserved concurrent capacity, not cumulative calls. New
sessions default to unlimited; migration preserves valid existing limits,
including `0`. Schema 4 retains unresolved legacy activity. A finite Guard
needs matching terminal evidence or a new host session; an upgrade or session
end does not clear that activity.

### Delegation capacity and uncertain completion

`agents=N` reserves concurrent capacity; `0` denies new delegation. A parallel
batch is checked as a whole. Confirmed completion releases the associated
reservation; a stop request, session end, or unknown result does not prove
completion. Under a finite limit, Claude `SendMessage` and OpenCode `task_id`
resume calls are denied because the hosts do not supply a run generation that
would make later completion safe to attribute. Calls allowed while enforcement
was inactive or with an unlimited budget may leave unresolved capacity when
switching back to a finite Guard. Start a new host session if that activity
cannot be resolved. Valid legacy budgets, including `0`, survive schema
migration. See `src/adapters/` for the host-specific evidence and lifecycle
rules.

### Recover a damaged legacy session lock

`BLINDERS_LOCK_DAMAGED` means an old lock file has no valid owner PID. The Guard
preserves that file and the saved session state. Read-only recovery remains
available, but new directives cannot be saved while the lock is damaged.

Prefer a new host session and submit the required `$blinders` directive
again. To recover the original session:

1. Stop every host process and child process that shares the Guard's data
   directory.
2. Find the exact `.json.lock` filename shown in the error under that data
   directory's `sessions/` folder. Move only that damaged file aside and keep it
   for inspection. Preserve the matching `.json` file, which holds the contract
   and delegation records.
3. Restart the host and submit the required directive again. Confirm its response
   before continuing the task.

These steps apply only to the damaged legacy lock file named in the error.
Do not force-unlock a lock directory or a file with a valid, live owner PID.
File age alone does not prove that its owner has stopped.

## Run a smoke test in Claude Code

Use a disposable repository. First arm read-only review:

```text
/blinders:blinders review -- Review this repository. Report findings; do not edit.
```

A covered `Write`, `Edit`, `NotebookEdit`, `EnterWorktree`, mutating
`Bash`/`PowerShell`/`Monitor` command, or unknown shell command must not run
under the armed non-mutating contract. Then switch:

```text
/blinders:blinders change -- Create scratch/blinders-smoke.txt containing the word pass.
```

That narrow write should proceed. For a file-lock test:

```text
/blinders:blinders lock change files=scratch/blinders-smoke.txt -- Change only this file.
```

A covered write to a different path should be denied.

## Optional: Skill only

If you do not want command Hooks, install only the advisory Skill. For Claude
Code, copy the Skill into the user skills directory:

```bash
mkdir -p ~/.claude/skills/blinders
cp skills/blinders/SKILL.md ~/.claude/skills/blinders/SKILL.md
```

OpenCode discovers project Skills in `.claude/skills/`; `.opencode/skills/`
also works for OpenCode only. To install only the compact prose Skill, copy it
with its reference file:

```bash
mkdir -p ~/.claude/skills/scope-lite
cp -R skills/scope-lite/. ~/.claude/skills/scope-lite/
```

Start a new task so the host discovers it. Skill only needs no Hook
installation and has no runtime enforcement. It is advisory, model behavior can
vary, and your existing sandbox and approval settings still apply.

## Check for updates

With the package executable installed:

```bash
blinders doctor --check-update
```

From a source checkout:

```bash
npm run blinders -- doctor --check-update
```

Only this explicit command queries GitHub Releases. It returns `installed`,
`latest`, `releaseUrl`, and `releasePublished`. When the repository has no
published release, `latest` and `releaseUrl` are `null` and the command still
succeeds. It does not install updates or display reminders during startup or
tasks. Standalone `scope-lite` installations update through
the host or Skill Installer flow.

## Disable or uninstall

Claude Code plugins are removed with the host's plugin controls:

```bash
claude plugin uninstall blinders
```

Claude Code cleans up `CLAUDE_PLUGIN_DATA` when the plugin is uninstalled from
its last scope unless you uninstall with `--keep-data`.

For OpenCode, remove the plugin spec or entry from your configuration and
restart: V1 has no external-plugin uninstall subcommand, and V2 removes the
`plugins` entry. Keep the same `dataDir` if one was configured.

The Guard stores per-session contracts and delegation state, metadata-only
runtime events, and manual labels in the host-provided data directory
(`CLAUDE_PLUGIN_DATA` for Claude Code, and the OpenCode state directory
described above). Review that directory separately if you uninstall. See
[PRIVACY.md](PRIVACY.md) for the distinction between session state and runtime
events.

For a Skill-only installation, remove its exact installed directory
(`~/.claude/skills/blinders` for the Claude Code copy), then start a
new task.
