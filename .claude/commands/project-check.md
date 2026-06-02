---
name: project-check
description: >
  Guides the user through the conventional sequence of software project stages,
  either at kickoff or mid-project as a check-in. Use this skill whenever the
  user invokes /project-check, says "where do I start", "what comes next",
  "am I missing anything", "how do I start a project", "what stage am I at",
  "help me stay on track", or any time they seem to be starting or resuming a
  project and need orientation. Also trigger when a user has just finished a
  planning artifact (PRD, spec, architecture doc) and hasn't yet started
  building — they likely need a kickoff nudge even if they don't ask for one.
---

# Project Check Skill

Orients the user within the conventional software project lifecycle — either
at the start (kickoff mode) or mid-build (check-in mode). Language and
framework agnostic.

---

## Workflow

### Step 1 — Determine mode

Ask the user one question:

> "Are you just starting this project, or are you already mid-build and want
> to check where you are?"

- **Starting** → Kickoff mode (gather context, then present the full sequence)
- **Mid-build** → Check-in mode (present the full sequence, ask where they are)

---

### Step 2 — Kickoff mode: gather context

If kickoff, ask these questions conversationally (not all at once):

1. **Language / framework** — What's your primary stack?
2. **Solo or team?**
3. **Timeline** — Rough deadline or pace?
4. **Do you have a PRD or written spec?** — If not, suggest running `/prd` first before continuing.

Then present the full sequence (Step 3) with notes tailored to their answers.

---

### Step 3 — Present the full project sequence

Always show the complete sequence so the user is informed. Present it as a
numbered checklist. Mark the user's current stage clearly if known.

```
Project Lifecycle — Conventional Sequence

1. Requirements & Scoping
   Define what you're building and why. Written PRD or spec.
   Common skip: starting to code before scope is locked.

2. Technical Design & Architecture
   Decide app/folder structure, routing strategy, service boundaries,
   how auth is wired up. For framework-based projects: agree on your
   app/module split before writing any code.
   Common skip: skipping this and refactoring later at high cost.

3. Data Modeling / Schema Design
   Finalize your entities, relationships, and field types. Review for
   normalization issues. Run migrations or scaffold DB before building views.
   Common skip: treating the schema as something to figure out later.

4. Project Scaffolding
   Initialize the project, install dependencies, connect the database,
   configure environments (local vs. staging vs. production), set up git
   and CI if applicable.
   Common skip: postponing environment config until "later" and then
   scrambling at deploy time.

5. Auth & Permissions
   Wire up login/logout and role/permission checks early. Every subsequent
   feature should be built with auth already in place.
   Common skip: building features first and bolting on auth at the end —
   this causes permission logic to be scattered and inconsistent.

6. Core Feature Buildout
   Build in vertical slices: one complete workflow end-to-end before
   moving to the next. Prefer depth over breadth.
   Common skip: building all models, then all views, then all templates
   in separate passes — leads to integration bugs discovered late.

7. Admin / Internal Tooling
   Any back-office, CMS, or staff-facing interface. Usually done alongside
   or just after the models are stable.

8. Frontend Polish
   Templates, styles, component refinement, responsive behavior.
   Common skip: polishing UI before core workflows are stable.

9. Testing
   Unit tests for business logic, integration tests for key workflows.
   Common skip: leaving testing entirely to the end or skipping it.

10. Deployment & Environment Hardening
    Production environment setup, environment variables, secrets management,
    database migrations in production, domain/SSL config.
    Common skip: assuming "it works locally" = "it will work in prod".

11. Documentation & Cleanup
    README, inline comments on non-obvious logic, architecture notes.
    Common skip: shipping without a README that explains how to run the project.
```

---

### Step 4 — Check-in mode: locate the user

If mid-build, after presenting the sequence ask:

> "Which stage are you currently on? You can pick a number or describe where
> you are."

Then:
- Confirm what they've completed
- Surface the most common mistake or skipped step for their **current** stage
- Name what comes next and flag any common pitfalls there
- Ask: "Is there anything from the earlier stages you skipped or want to
  revisit?"

---

### Step 5 — Offer next action

Close with a concrete offer:

- If they haven't started: "Want to run `/prd` to lock in scope before we proceed?"
- If they're between stages: "Want to work through [next stage] together?"
- If they seem stuck: "What's blocking you right now?"

---

## Tone & Style

- Language agnostic — never assume a framework unless the user has specified one
- Direct and practical — this is a navigation tool, not a lecture
- Don't pad stages with obvious advice; surface the non-obvious skips
- Keep check-ins concise — the user is mid-build and wants orientation, not a course
