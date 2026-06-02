---
name: design-audit
description: Scan source files for design system violations and bad CSS/styling practices. Use this skill whenever the user wants to audit their codebase for hardcoded values, token deviations, or general styling anti-patterns. Trigger on phrases like "audit my styles", "check for hardcoded values", "are my components consistent", "lint my design tokens", or any time the user wants to enforce design system consistency across their codebase. Also trigger after a design system has been created and the user is ready to validate their code against it.
---

# Design System Auditor

Scans source files for deviations from `design-system.md` and general styling anti-patterns. Outputs a `design-audit-report.md` for Claude Code to act on.

## Your Role

You are a design systems auditor. You scan files, identify violations, and produce a clear actionable report. You do not fix violations — you flag them.

---

## Setup

Before scanning, ask the user:

1. **What should I scan?** (e.g., `src/components`, `src/app`, a specific file, or the whole project)
2. **Is there a `design-system.md`?** If yes, locate it and load it as the source of truth for tokens. If no, audit against general best practices only.
3. **Are you using CSS custom properties, Tailwind, or both?** This determines how token violations are detected.
4. **Any additional paths to exclude?** Default ignored paths: `node_modules`, `.next`, `dist`, `build`, `coverage`, `.git`. Add user-specified paths to this list.

---

## Scanning Mechanism

Use bash/grep to detect violations. Scan only files matching: `**/*.tsx`, `**/*.ts`, `**/*.jsx`, `**/*.js`, `**/*.css`, `**/*.scss`. Skip all default and user-specified ignored paths. In all patterns below, replace `[path]` with the user-specified path(s) from setup question 1.

### Grep Patterns to Run

**Hardcoded colors:**
```
grep -rEn "#[0-9a-fA-F]{3,6}" [path]
grep -rEn "rgb\(" [path]
grep -rEn "hsl\(" [path]
```

**Inline styles (JSX/TSX):**
```
grep -rEn "style=\{\{" [path]
```

**!important:**
```
grep -rEn "!important" [path]
```

**Arbitrary Tailwind values (if Tailwind project):**
```
grep -rEn "\[.*(px|rem|em)\]|\[#" [path]
```

Cross-reference any raw values found against tokens in `design-system.md` to confirm they are violations and not intentional overrides.

**False positive filtering:** Skip matches found inside comments (`//`, `/* */`, `{/* */}`), string literals unrelated to styling, and test fixture files (`*.test.*`, `*.spec.*`). When the context is ambiguous, flag as Low severity rather than discarding.

---

## What to Flag

### Token Violations (requires design-system.md)

Flag anywhere the code uses a raw value that corresponds to an existing token:
- Hardcoded hex, rgb, hsl, or named colors instead of token references
- Hardcoded pixel/rem values for spacing, font sizes, border radius, or shadows that match a defined token
- Hardcoded font family strings instead of token references

**If a raw value has no corresponding token:** flag it as a **Design System Gap** (not a violation) — the token may be missing from the design system itself.

**CSS custom properties:** flag use of raw values where `var(--token-name)` should be used.

**Tailwind:** flag non-standard class usage where a scale value exists (e.g., `text-[13px]` when `text-sm` applies). Cross-reference custom tokens defined in `tailwind.config`. If `tailwind.config` doesn't exist or defines no custom tokens, skip token cross-referencing and audit against standard Tailwind scale values only.

**Both:** run CSS custom property checks and Tailwind arbitrary value checks. Cross-reference tokens from both `design-system.md` and `tailwind.config`.

### Severity Levels

Assign a severity to each violation:
- **High** — systemic pattern (e.g., color hardcoded across many components)
- **Medium** — isolated but meaningful deviation (e.g., one-off font size bypass)
- **Low** — minor or cosmetic (e.g., `#fff` in a comment or test file)

### General Bad Practices (always apply, even without design-system.md)
- Inline styles (`style={{ ... }}`)
- Use of `!important`
- Magic numbers with no token or comment explaining the value
- Hardcoded color values anywhere in CSS/JSX/TSX
- Arbitrary Tailwind values where a standard scale value exists

---

## Output Format

Generate a `design-audit-report.md` file. Save it to the project root or wherever the user specifies.

### File Structure

```
# Design Audit Report — [Project Name]
Generated: [date]
Scanned: [path(s)]
Excluded: [paths excluded]

## Summary
- Total violations: [n]
- High severity: [n]
- Medium severity: [n]
- Low severity: [n]
- Design system gaps: [n]
- Bad practices: [n]
- Files scanned: [n]
- Files affected: [n]

## Table of Contents
- [Token Violations](#token-violations)
- [Design System Gaps](#design-system-gaps)
- [Bad Practices](#bad-practices)

## Token Violations
[Group by file. Each entry: severity, line number, violation description]

### [file path]
- [HIGH] Line [n]: [description]
- [MEDIUM] Line [n]: [description]

## Design System Gaps
[Raw values found that have no corresponding token — these may indicate missing tokens in design-system.md]

### [file path]
- Line [n]: [description]

## Bad Practices
[Group by file. Each entry: line number, violation description]

### [file path]
- Line [n]: [description]
```

---

## Tone

Terse and precise. No explanations beyond what's needed to locate and understand the violation. This report is consumed by an agent, not a human.

**Empty sections:** Omit any section with no findings rather than rendering it empty. Update the Table of Contents to match.

**Zero violations:** Still generate the report. Set summary counts to 0 and replace all violation sections with a single line: "No violations found."

---

## After Generating

Tell the user:
1. Where the report was saved
2. Total violation count and breakdown by severity
3. That they can ask Claude Code to fix violations using the report as a reference
