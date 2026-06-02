---
name: swe-audit
description: Run a structured audit on any SWE artifact — PRDs, planning docs, data models, API design, architecture decisions, tech stack choices, code/implementation plans, and testing/validation strategies. Use this skill whenever the user wants to stress test an idea, verify a plan, catch gaps before building, or sanity check a decision. Trigger on phrases like "audit this", "review this", "what am I missing", "is this solid", "stress test this", "does this hold up", "any gaps", "evaluate this plan", or any time the user shares a technical artifact and seems to want critical feedback. Also trigger proactively when a user has just finished planning something and is about to start building — they likely benefit from an audit even if they don't ask for one.
---
 
# SWE Audit Skill
 
A structured audit skill for verifying and stress-testing software engineering artifacts before or during a build. Stack-agnostic. Neutral in tone — surfaces issues and trade-offs without prescribing solutions. Interactive — works through findings collaboratively after the audit.
 
---
 
## Behavior Overview
 
1. **Identify the artifact type** from context (PRD, data model, API design, etc.)
2. **Run the audit** using the relevant checklist(s) below
3. **Output findings** in categorized sections with priority callouts
4. **Open collaboration** — invite the user to work through issues one at a time
---
 
## Audit Output Format
 
Always structure output as:
 
```
## Audit: [Artifact Name or Type]
 
### Gaps & Missing Decisions
1. [Finding]
2. [Finding]
 
### Risks & Red Flags
3. [Finding]
4. [Finding]
 
### Convention & Best Practice Issues
5. [Finding]
 
### Minor Notes
6. [Finding]
 
---
**Priority callouts** (resolve before building): 1, 3, 5
 
What would you like to work through first?
```
 
- Number findings globally and continuously across all sections — never restart numbering per section
- Priority callouts reference item numbers, not prose descriptions
- Keep findings specific — vague observations aren't useful
- If a finding is uncertain, flag it as a question rather than a statement
- Omit empty sections rather than writing "None"
- Priority callouts = items where proceeding without resolution carries meaningful risk
---
 
## Audit Checklists by Artifact Type
 
Identify the artifact type(s) from context and apply all relevant checklists. Multiple checklists may apply to a single artifact.
 
---
 
### PRD / Planning Doc
 
**Scope & Goals**
- [ ] Problem statement is clear and specific
- [ ] Goals are distinguishable from features
- [ ] Non-goals are explicitly listed
- [ ] Success criteria are defined (even informally)
- [ ] Timeline and team size are realistic given scope
**Requirements**
- [ ] Functional requirements are concrete, not vague
- [ ] Edge cases and error states are addressed
- [ ] User roles and permissions are defined
- [ ] All user-facing flows have a described happy path
**Open Questions**
- [ ] Open questions are listed
- [ ] Each open question has an owner or resolution plan
- [ ] No critical decisions are silently deferred
**Risks**
- [ ] Technical risks are identified
- [ ] External dependencies are named
- [ ] Unknowns that could invalidate the plan are surfaced
---
 
### Data Model / Schema
 
**Correctness**
- [ ] All entities and relationships are named and typed
- [ ] Foreign key directions are correct
- [ ] Nullable vs non-nullable fields are intentional
- [ ] Required fields are present on all entities
- [ ] Money/decimal fields have explicit precision defined
- [ ] Timestamps are present where needed (`created_at`, `updated_at`)
**Normalization & Integrity**
- [ ] No unintentional data duplication
- [ ] Denormalized fields are justified and documented
- [ ] Computed/derived fields are not stored unless justified
- [ ] Cascade behavior on deletes is defined
**Conventions**
- [ ] Consistent naming convention (snake_case, camelCase, etc.)
- [ ] Primary key strategy is intentional (auto-int vs UUID)
- [ ] `related_name` or equivalent is defined for reverse relations
- [ ] Default ordering is defined where relevant
**Performance**
- [ ] Fields used in filters/sorts are candidates for indexing
- [ ] N+1 query risks are identified in list views
- [ ] Large text or blob fields are flagged
---
 
### API Design
 
**Completeness**
- [ ] All required endpoints are listed
- [ ] Request/response shapes are defined for each endpoint
- [ ] Error response shapes are defined
- [ ] Auth requirements per endpoint are stated
**Correctness**
- [ ] HTTP methods are semantically correct (GET/POST/PUT/PATCH/DELETE)
- [ ] Status codes are appropriate
- [ ] Side effects are only on mutating methods (POST/PUT/PATCH/DELETE)
- [ ] Idempotency is considered for PUT/PATCH
**Security**
- [ ] Auth/permission enforcement is described per endpoint
- [ ] No sensitive data exposed in URL parameters
- [ ] CSRF considerations addressed for session-based auth
**Conventions**
- [ ] URL structure is consistent and RESTful (or GraphQL conventions if applicable)
- [ ] Versioning strategy is defined (even if "none in v1")
- [ ] Pagination strategy defined for list endpoints
---
 
### Architecture Decisions
 
**Justification**
- [ ] Each major decision has a stated rationale
- [ ] Alternatives considered are noted (even briefly)
- [ ] Trade-offs are acknowledged
**Boundaries**
- [ ] Service/module boundaries are clear
- [ ] Responsibilities are not duplicated across layers
- [ ] Data flow between components is described
**Risks**
- [ ] Single points of failure are identified
- [ ] External service dependencies are named and failure modes considered
- [ ] Irreversible decisions are flagged
**Scalability**
- [ ] Current scale requirements are stated
- [ ] Known bottlenecks are identified
- [ ] Caching, queuing, or async needs are addressed (or explicitly deferred)
---
 
### Tech Stack Choices
 
**Fit**
- [ ] Each technology choice maps to a concrete requirement
- [ ] No technology is included without a stated purpose
- [ ] Overlapping tools (two things doing the same job) are flagged
**Risk**
- [ ] Unfamiliar technologies are flagged as learning risk
- [ ] Dependency maturity and maintenance status considered
- [ ] Hosting/environment compatibility verified (especially for native dependencies)
**Conventions**
- [ ] Stack choices follow established patterns for the domain
- [ ] Deviations from convention are justified
---
 
### Code / Implementation Plan
 
**Correctness**
- [ ] Business logic edge cases are handled
- [ ] Validation happens at the right layer (form, model, API)
- [ ] Error handling is described for failure paths
- [ ] Concurrency/race conditions are considered where relevant
**Structure**
- [ ] Responsibilities are in the right layer (not business logic in views, etc.)
- [ ] No obvious duplication across modules
- [ ] Naming is consistent and intention-revealing
**Maintainability**
- [ ] No magic numbers or hardcoded values without explanation
- [ ] Complex logic has comments or documentation planned
- [ ] Dependencies between modules are explicit
---
 
### Testing & Validation Strategy
 
**Coverage**
- [ ] Critical business logic has planned tests
- [ ] Happy path and failure path are both covered
- [ ] Permission/auth enforcement is tested
- [ ] Edge cases identified in the plan have corresponding tests
**Approach**
- [ ] Test types are appropriate (unit vs integration vs e2e)
- [ ] Test boundaries are defined (what is mocked, what is real)
- [ ] Test data strategy is defined
**Gaps**
- [ ] No critical paths are untested by design without justification
- [ ] Performance or load testing needs are addressed (or explicitly deferred)
---
 
## Collaboration Mode (Post-Audit)
 
After delivering findings, always end with: **"What would you like to work through first?"**
 
Then:
- The user can respond with a number (e.g. "3") or a range ("1-3") or multiple ("2, 5")
- Take issues one at a time in the order the user chooses
- For each issue: describe the problem clearly, present the trade-offs, and let the user decide
- After resolution, update any related planning doc if one exists in context
- When all priority items are resolved, do a final check: "Are there any findings you want to revisit before moving on?"
Do not push solutions. Surface options and trade-offs. The user decides.