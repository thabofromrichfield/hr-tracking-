# Mandatory Agent Operating Contract

Every thought, investigation, design decision, code change, security review, and chat response in this repository MUST pass through the installed skill libraries under `.agents/`. No work may bypass this pipeline.

## Installed Skill Sources

| Layer | Upstream Source | Local Path | Role |
| --- | --- | --- | --- |
| Voice & Execution Discipline | `JuliusBrussee/caveman` | `.agents/skills/caveman/` | Terse output (`caveman/SKILL.md`) and lean engineering workflows (`native/native-core.md`, `investigate-first`, `lean-build`, `surgical-patch`, `safe-refactor`, `migration`, `verify-and-stop`, `caveman-review`, `caveman-commit`). |
| ADHD Output Shaping | `ayghri/i-have-adhd` | `.agents/skills/i-have-adhd/SKILL.md` | 10 mandatory output rules for working-memory clarity, numbered steps, visible wins, concrete time estimates, and single next actions. |
| Engineering Division (66 specialists) | `msitarzewski/agency-agents/engineering` | `.agents/agency/engineering/` | Domain architecture, backend, frontend, database, IAM, privacy, HR/ATS/OrgScript, accessibility, minimal change, and code review specialists. |
| Design Division (10 specialists) | `msitarzewski/agency-agents/design` | `.agents/agency/design/` | UX research, UX architecture, UI systems, inclusive visuals, persona walkthroughs, and the hard pre-ship `design-ui-finish-gate-reviewer.md`. |
| Security Division (12 specialists) | `msitarzewski/agency-agents/security` | `.agents/agency/security/` | Threat modeling, AppSec, secrets/credentials, compliance, cloud security, and mandatory scan-fix-rescan via `security-ai-generated-code-auditor.md`. |

## Mandatory 5-Gate Pipeline (Every Turn, No Exceptions)

1. **Gate 1 — Workflow & Specialist Selection (`caveman` + `agency-agents`)**
   - Pick the matching `caveman` execution workflow (`investigate-first`, `lean-build`, `surgical-patch`, `safe-refactor`, `migration`, or `verify-and-stop`) governed by `.agents/skills/caveman/native/native-core.md`.
   - Read the exact `.agents/agency/{engineering,design,security}/*.md` specialist files that own the task's domain before making design or code decisions.
2. **Gate 2 — Architecture & Design Contract (`engineering` + `design`)**
   - Trace invariants and ownership boundaries first (`native-core.md`, `engineering-software-architect.md`).
   - Before building or changing any UI, define a written Design Contract (`design-ux-architect.md`, `design-ui-designer.md`, `design-ui-finish-gate-reviewer.md`) covering user job, primary workflow, density, hierarchy, responsive states, accessibility (`engineering-section-508-specialist.md`), and prohibited generic defaults.
3. **Gate 3 — Security-by-Design & Implementation (`engineering` + `security`)**
   - Enforce trust boundaries, server-side authorization, least privilege, PII/HR data privacy (`engineering-privacy-engineer.md`, `engineering-identity-access-engineer.md`, `security-architect.md`, `security-appsec-engineer.md`), and safe database access (verified RLS policies, `app_metadata` rather than client-editable `user_metadata`, zero client-exposed secrets).
4. **Gate 4 — Hard Verification, Security Audit & UI Finish Gate**
   - Run the smallest sufficient automated proof (`verify-and-stop`).
   - Audit every diff against `security-ai-generated-code-auditor.md` (secrets, auth/RLS, untrusted input sinks; scan -> fix -> rescan) and `engineering-code-reviewer.md` / `caveman-review`.
   - Gate every UI change against `design-ui-finish-gate-reviewer.md` at desktop and mobile viewports (must earn **PASS**, never ship on **HOLD**).
5. **Gate 5 — Output Shaping (`caveman` + `i-have-adhd`)**
   - Every chat reply obeys `.agents/skills/caveman/caveman/SKILL.md` AND `.agents/skills/i-have-adhd/SKILL.md`:
     1. **Lead with action or answer** on line 1. Zero preamble, greeting, recap, or closing pleasantries.
     2. **Caveman brevity, exact payload**: drop filler and optional articles when readable in one pass; ≤20 words per sentence; active voice; never invent abbreviations or performative caveman grammar; keep all code, commands, paths, negations (`not`/`never`/`no`/`only`/`except`), numbers, and errors verbatim.
     3. **Number multi-step tasks** (one bounded action per step, fewest steps).
     4. **Cap visible lists to ≤5 items** per group (retain full analysis internally).
     5. **Restate state every turn** (`Step X of Y done: ...`).
     6. **Specific time estimates** in minutes/hours, never vague phrases.
     7. **Make wins visible** with concrete proof/commands.
     8. **Matter-of-fact errors** (`path:line`: cause + fix).
     9. **Suppress tangents** (handle inline or surface as one line at the end).
     10. **End with one `<2 min` concrete next action** (`Next: ...`).
   - Persisted artifacts outside chat (code, comments, docs, commits via `caveman-commit`, PRs) use clear plain prose.
