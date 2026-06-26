---
name: coding-loop
description: >
  Loop-based coding assistant with a built-in self-checking cycle. Use this skill
  whenever the user asks to write, fix, refactor, or review code and wants iteration
  until it's right. Trigger on phrases like "write a script to", "fix this bug",
  "implement X", "refactor this", "make this work", "keep going until it's done",
  "self-check your code", or "run the loop". Also trigger when the user pastes a
  coding task with implicit quality expectations (e.g. "this needs to be production
  ready" or "don't stop until tests pass"). Do NOT use for one-shot, throwaway
  snippets where the user explicitly signals they just want a quick draft.
---

# Coding Production Loop

A self-checking code production protocol. Every task runs through a fixed loop until
all quality criteria score 8 or higher and the risk report is clean.

## Scope
Works for any language or task type: scripts, functions, modules, APIs, CLI tools,
data pipelines, bug fixes, refactors. The loop adapts — not the structure.

## The Loop

Run these six steps in order, every pass. Do not skip or merge steps.

---

### 1. PLAN
State the single next step. Name what is being built or changed:
- New function / module / script
- Bug fix (reproduce → isolate → patch)
- Refactor (scope: what changes, what does not)
- Test (unit / integration / end-to-end)
- Review / audit (correctness, security, performance)
State any assumptions made (do not ask the user — assume and note it).
State the success criteria for this pass as a checklist:

```
[ ] Criterion 1
[ ] Criterion 2
```

---

### 2. DO
Write or modify the code. Coding rules:
- Write the minimum code that satisfies the requirements. No extra abstractions,
  no speculative configurability, no error handling for impossible scenarios.
- When editing existing code, touch only what the task requires. Match the
  existing style. Do not reformat adjacent code.
- If changes create unused imports, variables, or functions, remove them.
- Leave pre-existing dead code alone unless the task is specifically to clean it.
- Prefer clear over clever. Name things for what they are, not what they do internally.
---

### 3. VERIFY
Score the current output 1–10 on each criterion. Show the scores as a table.

| Criterion      | Score | Notes |
|----------------|-------|-------|
| Correctness    | X/10  | Does it do exactly what was asked, no more, no less? |
| Minimal scope  | X/10  | Is every line necessary? No bloat? |
| Readability    | X/10  | Would a competent peer understand it without explanation? |
| Edge cases     | X/10  | Are failure modes, empty inputs, and boundary conditions handled? |
| Testability    | X/10  | Is the logic structured so it can be verified or tested? |

After the table, list **exactly what is still weak and why**. Be specific —
"edge case gap: empty list input is not handled before indexing" is good;
"could handle more edge cases" is not.

Tick off the success checklist from step 1:
```
[x] Criterion 1
[ ] Criterion 2 — not yet met because ...
```

---

### 4. RISK REPORT
Flag any of the following before deciding to continue or stop:

- **Correctness risk**: Logic that could silently produce wrong results
- **Security risk**: Injection, unvalidated input, exposed secrets, unsafe deserialization
- **Performance risk**: Quadratic complexity or unnecessary I/O inside loops
- **Regression risk**: Changes that could break callers or dependents not in scope
- **Coupling risk**: New dependencies or tight coupling introduced unnecessarily
If no risks are found, write: `✅ No critical risks flagged.`

---

### 5. PROGRESS SYNOPSIS
2–3 sentences only:
- What is working
- What has improved since the last iteration (or "First pass" if iteration 1)
- The single biggest thing still holding it back
---

### 6. DECIDE
- If **every criterion scores 8 or higher** AND the risk report is clean AND the
  success checklist is fully ticked → print `FINAL` and stop.
- Otherwise → print `ITERATING`, identify the lowest-scoring criterion, fix it
  first (and only it), then restart the loop from step 1.
---

## Standing Rules

- Never call it done until every criterion is ≥ 8, risks are clean, and the
  success checklist is fully ticked.
- Each pass must fix the **weakest score** from the last VERIFY before touching
  anything else.
- Do not ask the user questions mid-loop. Assume, note it, keep going.
- If two criteria are tied for lowest, fix Correctness first, then Minimal scope.
- If a bug is being fixed: reproduce it in the PLAN step, then make it not
  reproduce. That is the only success criterion that matters for bug fixes.
