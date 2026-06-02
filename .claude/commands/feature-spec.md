---
name: feature-spec
description: >
  Write a feature spec markdown file before building. Trigger when the user
  wants to spec a feature, needs a doc for Claude Code to execute from, or
  invokes /feature-spec. Outputs a feature-spec.md.
---

# Feature Spec Skill

You are running a conversational feature spec interview. Your goal is to gather
enough detail to produce a spec that is both human-readable and actionable by
Claude Code.

## Process

Ask questions **one at a time**. Wait for the user's answer before moving on.
Once you've covered all sections, write the spec to `feature-spec.md` in the
current working directory (or a path the user specifies).

---

## Interview Sections

Work through these in order. Skip questions already answered, and don't ask
redundant follow-ups if the user gave a thorough answer.

### 1. Feature Overview
**Primary:** What's the feature, and what problem does it solve for the user?

Follow-ups if needed:
- Is this a new feature or a change to an existing one?
- Any related features or systems it touches?

### 2. User Stories & Acceptance Criteria
**Primary:** Who uses this feature and what do they need to be able to do?

Follow-ups if needed:
- Walk me through the happy path — what does success look like end to end?
- Any edge cases or error states the user might hit?
- How will you know this feature is done? What are the acceptance criteria?

### 3. Scope & Boundaries
**Primary:** What's explicitly in scope, and what are you intentionally leaving out?

Follow-ups if needed:
- Any related work that's tempting but should be deferred?
- Dependencies on other features or teams?

### 4. Implementation Detail
**Primary:** How should this be built — what's the approach at a high level?

Follow-ups if needed:
- Any specific data shapes, API contracts, or interfaces to define?
- DB schema changes? New endpoints? UI components?
- What files or components will need to be created or modified?
- Any pseudocode or logic worth capturing before coding starts?
- Any known tricky parts or risks?

### 5. Coding Standards
**Primary:** Is there a `coding-standards.md` or similar file this spec should reference?

Follow-ups if needed:
- What path is it at?
- Anything standard-specific worth calling out for this feature?

### 6. Testing
**Primary:** What should be tested, and at what level — unit, integration, e2e?

Follow-ups if needed:
- Any specific scenarios that must have test coverage?
- Existing test patterns to follow?

### 7. Open Questions
**Primary:** Anything unresolved that could block implementation or cause a wrong turn?

---

## Output: feature-spec.md

Write the spec as a markdown file. Use this structure:

```markdown
# Feature Spec: [Feature Name]
_[date]_

## Overview
[What the feature is and what problem it solves. 2-4 sentences.]

## User Stories
- As a [user], I want to [action] so that [outcome].
- ...

## Acceptance Criteria
- [ ] [Criterion]
- [ ] [Criterion]
- ...

## Scope
### In Scope
- ...

### Out of Scope
- ...

## Implementation Notes
### Approach
[High-level approach and rationale]

### Files & Components
[Files to create, files to modify — specific paths where known]

### Data Shapes / API Contracts
[Interfaces, request/response shapes, schema changes — as specific as decided]

### Logic / Pseudocode
[Any non-obvious logic worth capturing before coding]

### Risks & Known Complexity
[Anything likely to be tricky]

## Coding Standards
See [coding-standards.md](<path>) for project-wide conventions.

[Any feature-specific callouts from the standards worth highlighting]

## Testing Plan
[What to test, at what level, and any specific scenarios that must be covered]

## Open Questions
- [ ] [Question]
- ...
```

**Honest spec principle:** If something wasn't decided, put it in Open Questions
rather than inventing an answer. The spec should reflect what was actually
decided, not what sounds good.

After writing the file, tell the user the path and confirm it's ready to hand
off to Claude Code.
