# Design System — Filaments

> **v1 is iOS-only.** All tokens, type, and components below are unchanged — they're the visual language regardless of platform. The only v1 scope change is that the **web port is v1.1**; cross-platform notes are retained as v1.1 guidance and marked as such.

## Table of Contents
- [Overview](#overview)
- [Color Tokens](#color-tokens)
- [Typography](#typography)
- [Spacing Scale](#spacing-scale)
- [Border Radius](#border-radius)
- [Shadows](#shadows)
- [Breakpoints](#breakpoints)
- [Motion](#motion)
- [Components](#components)
- [Usage Notes](#usage-notes)

## Overview

Calm, warm, editorial. A personal knowledge archive that feels like a well-designed journal — content-forward, spacious, quiet. AI features work in the background; the UI never feels "techy." Day One is the design backbone. Light mode only.

## Color Tokens

All colors defined in `tailwind.config` and consumed via NativeWind on iOS (and on web in v1.1).

### Brand
| Token | Value | Usage |
|---|---|---|
| `brand-50` | `#faf8f6` | Subtle background tint |
| `brand-100` | `#f3efe9` | Card backgrounds, hover states |
| `brand-200` | `#e6ddd3` | Borders, dividers |
| `brand-300` | `#d4c5b5` | Inactive/muted elements |
| `brand-400` | `#b8a48e` | Placeholder text |
| `brand-500` | `#9c8368` | Secondary text, icons |
| `brand-600` | `#7d6750` | Primary accent, interactive elements |
| `brand-700` | `#5e4d3b` | Strong emphasis |
| `brand-800` | `#3f3328` | Headings |
| `brand-900` | `#231c16` | Primary text |

### Neutral
| Token | Value | Usage |
|---|---|---|
| `neutral-0` | `#ffffff` | Page background |
| `neutral-50` | `#fafaf9` | Raised surface background |
| `neutral-100` | `#f5f5f4` | Input backgrounds |
| `neutral-200` | `#e7e5e4` | Borders |
| `neutral-300` | `#d6d3d1` | Disabled states |
| `neutral-400` | `#a8a29e` | Placeholder text |
| `neutral-500` | `#78716c` | Secondary text |
| `neutral-600` | `#57534e` | Body text |
| `neutral-700` | `#44403c` | Strong body text |
| `neutral-800` | `#292524` | Headings |
| `neutral-900` | `#1c1917` | Primary text |

### Semantic
| Token | Value | Usage |
|---|---|---|
| `error` | `#dc2626` | Error states, destructive actions |
| `error-light` | `#fef2f2` | Error background |
| `success` | `#16a34a` | Success states, completed processing |
| `success-light` | `#f0fdf4` | Success background |
| `warning` | `#d97706` | Warning states, processing |
| `warning-light` | `#fffbeb` | Warning background |
| `info` | `#2563eb` | Info states, links |
| `info-light` | `#eff6ff` | Info background |

### Surface
| Token | Value | Usage |
|---|---|---|
| `surface-page` | `#ffffff` | Page background |
| `surface-raised` | `#fafaf9` | Cards, panels |
| `surface-overlay` | `#ffffff` | Modals, dropdowns |
| `surface-input` | `#f5f5f4` | Input fields |

### Filament Type Colors
| Token | Value | Usage |
|---|---|---|
| `type-voice` | `#7c3aed` | Voice filament indicators |
| `type-document` | `#2563eb` | Document filament indicators |
| `type-text` | `#0d9488` | Text note indicators |

## Typography

### Font Families
| Token | Family | Usage |
|---|---|---|
| `font-serif` | Lora | Headings, filament titles, editorial moments |
| `font-sans` | Inter | Body text, UI elements, labels |
| `font-mono` | JetBrains Mono | Timestamps, transcript segments, metadata |

### Type Scale
| Token | Size | Line Height | Weight | Font |
|---|---|---|---|---|
| `text-xs` | 12px | 16px | 400 | Inter |
| `text-sm` | 14px | 20px | 400 | Inter |
| `text-base` | 16px | 24px | 400 | Inter |
| `text-lg` | 18px | 28px | 400 | Inter |
| `text-xl` | 20px | 28px | 600 | Lora |
| `text-2xl` | 24px | 32px | 600 | Lora |
| `text-3xl` | 30px | 36px | 700 | Lora |

### Weight Tokens
| Token | Value |
|---|---|
| `font-normal` | 400 |
| `font-medium` | 500 |
| `font-semibold` | 600 |
| `font-bold` | 700 |

## Spacing Scale

4px base grid.

| Token | Value |
|---|---|
| `spacing-0` | 0px |
| `spacing-1` | 4px |
| `spacing-2` | 8px |
| `spacing-3` | 12px |
| `spacing-4` | 16px |
| `spacing-5` | 20px |
| `spacing-6` | 24px |
| `spacing-8` | 32px |
| `spacing-10` | 40px |
| `spacing-12` | 48px |
| `spacing-16` | 64px |
| `spacing-20` | 80px |

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-none` | 0px | — |
| `radius-sm` | 4px | Small elements, badges |
| `radius-md` | 8px | Default — cards, inputs, buttons |
| `radius-lg` | 12px | Modals, larger containers |
| `radius-xl` | 16px | Feature panels |
| `radius-full` | 9999px | Avatars, pills, circular elements |

## Shadows

Minimal. Used sparingly for elevation, not decoration.

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift — tags, small cards |
| `shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Cards, raised surfaces |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |

## Breakpoints

v1 is iOS-only and single-column. The reading max-width still matters on larger iPhones / iPad:

- **Max content width:** `720px` for reading content (filament detail, Ask AI).
- **App body column:** ~`480–600px`, comfortable on any device width. No full-width or full-bleed layouts.

**Authoring principle — mobile-first:** base (unprefixed) styles target the phone; any size adaptation is a progressive enhancement via `sm:` / `md:` prefixes (NativeWind convention). Never write desktop-first and override downward.

**v1.1 (web port):** the same single-column layout carries to web — breakpoints only govern how much the content column breathes (more side margin, centered column on wider viewports), never a structural change. No sidebar or multi-pane layout at any size.

## Motion

Minimal. Transitions only — no entrance/exit animations, no bouncing.

| Token | Value | Usage |
|---|---|---|
| `duration-fast` | 100ms | Hover states, toggles |
| `duration-default` | 150ms | Most transitions |
| `duration-slow` | 250ms | Panel open/close, modals |
| `easing-default` | `ease-in-out` | All transitions |

## Components

All components built as custom React Native / NativeWind components. No external component library. Keep components minimal and composable.

### Button
- **Variants:** primary (brand-600 bg, white text), secondary (brand-100 bg, brand-700 text), ghost (transparent bg, brand-600 text), destructive (error bg, white text)
- **Sizes:** sm (h-8, text-sm), md (h-10, text-base), lg (h-12, text-lg)
- **States:** default, pressed (darken 15%), disabled (neutral-300 bg, neutral-400 text, no pointer events). (Hover applies on web in v1.1.)
- **Radius:** radius-md
- **Font:** Inter, font-medium

### Input / Textarea
- **Background:** surface-input
- **Border:** 1px neutral-200, on focus 1px brand-500
- **Radius:** radius-md
- **Font:** Inter text-base
- **Placeholder:** neutral-400
- **States:** default, focus (brand-500 ring), error (error border + error-light bg), disabled (neutral-100 bg)
- **Textarea:** auto-grow, min 3 rows

### Card
- **Background:** surface-raised
- **Border:** 1px neutral-200
- **Radius:** radius-md
- **Shadow:** shadow-sm (shadow-md on hover, web v1.1)
- **Padding:** spacing-4
- **Used for:** filament cards in timeline, source cards in Ask AI, linked filament previews

### Badge / Tag
- **Default:** brand-100 bg, brand-700 text, radius-full, text-xs, font-medium
- **Type badges:** use filament type colors (type-voice, type-document, type-text) at 10% opacity bg with full color text
- **Processing status badges:** warning-light bg + warning text (processing), success-light bg + success text (done), error-light bg + error text (failed)
- **Padding:** spacing-1 vertical, spacing-2 horizontal

### Nav / Header
- **Background:** surface-page with 1px neutral-200 bottom border
- **Height:** 56px
- **Font:** Inter font-medium text-sm for nav items
- **Active state:** brand-600 text, brand-100 bg pill
- **App title:** Lora font-bold
- Bottom tab bar is the primary nav (Timeline / Record / Detail / Ask AI / Search). (Carried over to web in v1.1 — same pattern, keeps the clients identical.)

### Toast
- **Position:** bottom center
- **Background:** neutral-800 bg, white text
- **Radius:** radius-md
- **Shadow:** shadow-lg
- **Auto-dismiss:** 4 seconds
- **Used for:** processing status updates ("Filament ready"), error notifications, action confirmations

### Modal / Dialog
- **Overlay:** neutral-900 at 40% opacity
- **Background:** surface-overlay
- **Radius:** radius-lg
- **Shadow:** shadow-lg
- **Max width:** 480px
- **Padding:** spacing-6
- **Header:** Lora text-xl
- **Actions:** right-aligned, primary + secondary buttons

### ~~Audio Player~~ — removed (2026-06-13)
Voice is capture-only: recordings are transcribed then discarded, so there's no
audio to play back. No audio-player component on detail or timeline cards.

## Usage Notes

### Styling Approach
- NativeWind (Tailwind for React Native) is the styling system for iOS (and web in v1.1)
- All tokens defined in `tailwind.config.js`, consumed via className
- No external component library. Components are custom-built, kept minimal
- Prefer composition over configuration — small building blocks over complex multi-prop components

### Design Language
- Day One is the primary design reference: clean, spacious, content-forward, editorial
- Plaud for capture/processing flow: clean recording UI, processing status indicators
- Obsidian for linking: lightweight backlinks panel, linked references with context
- Perplexity for Ask AI: cited answers with numbered source references linking back to filaments

### Platform Consistency (v1.1)
When web arrives, it shares this one design language — same screens, same single-column layout, centered in a max-width column on wider viewports. No sidebar, multi-pane, or desktop-only views — just the iOS UI with room to breathe. iOS leans slightly toward the Plaud aesthetic for recording and processing states.

### Anti-Patterns
- No gradients, no glassmorphism, no heavy decoration
- No dark mode (v1)
- No skeleton loaders that feel busy — use simple "processing" status badges instead
- Never let AI features feel prominent in the UI — they work quietly in the background
- No dense data tables or dashboard-style layouts — this is a journal, not an admin panel
