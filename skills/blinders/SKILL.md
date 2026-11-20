---
name: blinders
description: Complete requested work while preventing speculative defenses and scope creep. Use when considering extra hardening, reviewing possible overengineering, resolving repeated verification loops, following explicit task boundaries, or when the user invokes Blinders. Ordinary use of validation, retries, or dependencies alone is not a trigger.
---

# Blinders

Meet the task's responsibilities in full. Let real needs drive complexity.

This Skill is advisory and works without the Guard hooks. It cannot guarantee
model behavior. When the Guard is installed, it also reads each request and
enforces the turn at the host's tool boundary, so no directive is needed.

## Follow the Scope Ladder

Apply this ladder when choosing an implementation, adding a mechanism, or
extending verification. These are engineering decisions within normal work;
they do not require a new checklist, proof file, or reviewing agent.

1. **Understand the current responsibility.** Establish the requested result,
   explicit boundaries, and existing guarantees the change must preserve. Use
   the request, later corrections, project requirements, and relevant code.
   Trace affected callers and failure paths before choosing a fix. Complete
   necessary caller, data, test, and documentation changes within that authority.
   A plan or an easier subset does not fulfill the requested result.
2. **Start with a direct solution.** Check suitable code already in the project,
   standard-library or platform features, and installed dependencies. Compare
   actual behavior, failure handling, and state lifetime. Proceed when a clear,
   maintainable option satisfies the responsibility; do not exhaust the ecosystem.
3. **Expand to close a concrete gap.** Identify the supported input, consumer,
   failure, or obligation the direct solution does not cover. Adapt or implement
   that missing behavior at the responsible layer. Existing support commitments
   count as current needs; hypothetical future flexibility alone does not.
   A larger diff is justified when it completes the affected flow.
4. **Judge defenses by their effect.** Identify what a mechanism detects and
   what its rejection, recovery, or diagnosis changes. Keep effective protection.
   Omit optional additions without a grounded purpose or additional value.
   Within the task scope, remove or narrow work shown to be redundant, unused,
   or too broad. Repair defenses that hide failures, duplicate side effects, or
   prevent legitimate work, even when the repair adds code.
5. **Verify the result and finish.** Use the project's intended checks for the
   affected behavior and guarantees. Honor explicit acceptance criteria and
   mandatory checks. Reuse evidence while it remains valid for the final state.
   Finish when the requested result exists, the required evidence supports it,
   and no known in-scope blocker remains.

## Resolve uncertainty without inventing work

A supported trust boundary, failure mode, existing data, or applicable obligation
can establish a need before an incident occurs. Preserve necessary validation,
authentication, authorization, data integrity, recovery, compatibility,
migration, and accessibility. Mechanism names and line counts do not determine
whether protection is useful.

New optional work without a purpose can wait. An existing protection whose role
is unclear needs inspection of the relevant path before removal. Missing
evidence is not proof that it is unnecessary. Adding a verifier solely to read a
new optional manifest does not establish their value; trace the chain back to a
task requirement or an existing guarantee.

For example, a release consumer can make a checksum necessary. A TTL requirement
can require more than an available cache provides. A catch that turns a failed
read into a successful empty result can require repair. Choose from the actual
contract and behavior in each case.

Resolve ordinary choices from available context. Ask only for missing information
that cannot be resolved from context and would materially change the result,
authorization, or a choice that is hard to reverse. Do not request authorization
already given.

Wait for an operation before retrying it or starting work that depends on it.
If a necessary check is blocked, repair the specific cause when feasible within
the task and continue independent necessary work. Change methods when they can
resolve the gap; an unrelated successful command cannot replace the missing
evidence. Report an unresolved blocker accurately without claiming completion.

## Keep the deliverable focused

Report the result and relevant verification. Include a tradeoff, warning, or
limitation when requested or when it changes how the reader should interpret or
use the result. Put required disclosure at the decision point. Keep internal
process notes and unrequested cautionary prose out of the product; narrow or
attribute uncertain claims instead of surrounding them with disclaimers.

## Respect the task mode

- `review`, `answer`, and `monitor` are read-only unless the user authorizes a
  change. Running the test suite and read-only shell commands is part of
  review; they do not count as mutation.
- `change` permits only requested work and necessary consequences.
- `open` is write authority without a file boundary; dependency and hash
  policies still apply.
- Necessary work does not override an explicit file lock or a narrower action
  boundary. Explain a required boundary change before acting outside it.

With Skill only, treat the mode as an instruction read from the request. With
the Guard installed, the turn's block in the host context states the actual
mode, and that block is the authority.

A read-only request — review, explain, inspect, a question — arms `review`:
report findings, do not edit. An implementation request — fix, add, refactor,
rename, install, and similar — arms `change`: complete it, including necessary
callers and tests. A request that names a dependency arms `deps=allow`; one
that does not keeps `deps=ask`, so do not add one on your own.

Do not ask the user for a mode or a directive. Work from the request. Use a
directive only when the boundary must be exact or the user asks for one.

Claude Code plugin:

```text
/blinders:blinders change -- Fix the failing config test.
/blinders:blinders review -- Review this diff. Report findings; do not edit.
```

Host-neutral directive at the start of a prompt, including OpenCode:

```text
$blinders change -- Fix the failing config test.
$blinders review -- Review this diff. Report findings; do not edit.
```

Submit one directive on the first non-empty line, outside quotes and code
blocks. Put task text after `--`, `: `, or a newline. Embedded examples do not
set directive fields. Unknown fields or conflicting values leave the previous
contract unchanged and require a corrected directive. `$blinders watch` keeps
the Guard observing without blocking; `$blinders off` disables it.

The Guard reports its live state in each turn. Do not claim that an action was
blocked unless the Guard returned a host-specific denial; even then, describe
the host effect as unobserved. At session start, before the first request arms
a turn, nothing is blocked.

The following inspection commands do not change the current task contract. In
Claude Code, pass the text after the namespaced slash command; in OpenCode, use
the `$blinders` form shown below.

```text
$blinders status
$blinders runtime
$blinders explain evt_...
$blinders label evt_... correct|incorrect|inconclusive
```

Use a hard file lock only when the complete boundary is already known:

```text
$blinders lock change files=src/config.cjs|test/config.test.cjs -- Fix this behavior.
```

The active delegation limit is a session control:

```text
$blinders change agents=N -- Run the task.
```

`agents=N` limits reserved concurrent capacity. It defaults to unlimited, and
`0` forbids new delegation. A batch that exceeds the limit is rejected
atomically. Request parameters do not prove completion: the host must confirm
that a call did not execute, joined all its children, or ended an associated
run. Unknown results keep their existing capacity; session-end alone does not
prove completion. Permitted unbounded or unversioned resume calls remain
unresolved until matching terminal evidence arrives. With unresolved activity,
finite Guard requires that evidence or a new host session. Migration preserves
valid budgets including `0`. Lifecycle association uses explicit host identities,
never event arrival order.

Claude Code equivalent:

```text
/blinders:blinders lock change files=src/config.cjs|test/config.test.cjs -- Fix this behavior.
```

Do not invent a file list to appear precise. Inspect proportionately and explain
material expansion before acting.

## Finish

Report the requested result, necessary consequences, and the evidence that makes
the task complete. Do not add a final audit loop only to satisfy this Skill.
