---
name: Emerald Chrome
colors:
  surface: '#f8faf8'
  surface-dim: '#d8dad9'
  surface-bright: '#f8faf8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f2'
  surface-container: '#eceeec'
  surface-container-high: '#e6e9e7'
  surface-container-highest: '#e1e3e1'
  on-surface: '#191c1b'
  on-surface-variant: '#404940'
  inverse-surface: '#2e3130'
  inverse-on-surface: '#eff1ef'
  outline: '#707a6f'
  outline-variant: '#bfc9bd'
  surface-tint: '#1f6c3a'
  primary: '#004c22'
  on-primary: '#ffffff'
  primary-container: '#166534'
  on-primary-container: '#93e0a2'
  inverse-primary: '#8bd79b'
  secondary: '#006e2d'
  on-secondary: '#ffffff'
  secondary-container: '#7cf994'
  on-secondary-container: '#007230'
  tertiary: '#394156'
  on-tertiary: '#ffffff'
  tertiary-container: '#50586e'
  on-tertiary-container: '#c7cee9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a6f4b5'
  primary-fixed-dim: '#8bd79b'
  on-primary-fixed: '#00210b'
  on-primary-fixed-variant: '#005226'
  secondary-fixed: '#7ffc97'
  secondary-fixed-dim: '#62df7d'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005320'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#f8faf8'
  on-background: '#191c1b'
  surface-variant: '#e1e3e1'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  title-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system expresses authoritative precision, operational clarity, and executive maturity tailored for mission-critical enterprise analytics and data intelligence platforms. It bridges the architectural rigor of classical desktop tools with the fluid responsiveness of modern web software.

The aesthetic follows an **Architectural Hybrid / Modern Enterprise** framework: deep, saturated dark green chrome grounds the system's persistent controls and navigation, while the central canvas operates in an expansive, high-clarity light mode optimized for dense telemetry, reporting grids, and interactive visualizations. High informational contrast, surgical typography, and controlled emerald active states eliminate visual ambiguity without resorting to aggressive visual noise.

## Colors

The palette operates via a two-zone contextual architecture:

- **Chrome Canvas (Navigation & Top Bar):** Grounded in `#14532D` (Primary 900) and `#166534` (Primary 800). Navigation anchors use `#FFFFFF` for primary text and `#86EFAC` / `#DCFCE7` for low-emphasis labels. Selected states, indicator pips, and focused navigation items utilize vibrant emerald `#16A34A`.
- **Workspace Canvas (Content & Data Space):** The primary page canvas rests on `#F8FAF8` (Neutral Background), preventing the harsh glare of pure white over prolonged work sessions. Cards and interactive modules utilize pure `#FFFFFF`.
- **Borders & Dividers:** Subtle structural delineation via `#E5E7EB` (Neutral Border) on the light canvas, and semi-transparent white overlays (`rgba(255, 255, 255, 0.08)`) within the green chrome.
- **Data & Text:** Primary body and data labels use `#0F172A` (Slate 900) for uncompromised readability, paired with `#64748B` (Slate 500) for secondary metadata and axis labels.

## Typography

The type system prioritizes structural cadence, horizontal scanning efficiency, and numerical alignment across financial and telemetry metrics:

- **Hanken Grotesk** serves as both the headline and body typeface, selected for its crisp geometric apertures, tall x-height, and neutral editorial stance.
- **JetBrains Mono** is designated for labels, metric badges, micro-indicators, table code IDs, and numeric readouts, providing monospaced tabular alignment that prevents interface jitter during real-time value updates.
- Maintain strict baseline rhythm: all text elements snap to standard `4px` and `8px` vertical baselines. Line lengths in documentation or detail panes are constrained to a maximum of `72ch` to preserve executive legibility.

## Layout & Spacing

The system enforces a persistent multi-pane shell structure:

- **App Shell Framework:** Desktop layouts use a rigid `256px` fixed left navigation sidebar coupled to a `56px` persistent top utility bar, both painted in dark green chrome. The remaining viewport area serves as an independent scrollable workspace canvas.
- **Workspace Grid:** The main canvas deploys an 8-column layout on tablet (`768px - 1199px`) and a 12-column fluid grid on desktop (`1200px+`), constrained to a max-width of `1600px` for high-density dashboard layouts.
- **Spacing Rhythm:** Standard layout intervals obey strict 8pt scalar increments (`4px`, `8px`, `16px`, `24px`, `32px`). Component-level padding utilizes `space-sm` (`8px`) for compact table cells and filters, shifting to `space-lg` (`24px`) for analytical chart cards.

## Elevation & Depth

Visual hierarchy leverages a hybrid model balancing architectural outlines with soft diffused ambient shadows:

- **Surface Layering:**
  - Base level: `#F8FAF8` canvas background.
  - Interactive cards & data surfaces: Pure `#FFFFFF` resting on top of the base.
  - Flyouts, popovers, and slide-over drawers: Elevated `#FFFFFF` surfaces.
- **Shadow System:** Shadows remain hyper-diffused and low-contrast to avoid muddying analytical dashboards:
  - *Resting Cards:* `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`, supplemented by a crisp `1px solid #E5E7EB` border.
  - *Hover State:* `0 4px 6px -1px rgba(15, 23, 42, 0.07), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
  - *Floating Menus & Modals:* `0 12px 24px -4px rgba(15, 23, 42, 0.10), 0 4px 8px -2px rgba(15, 23, 42, 0.04)`.
- **Chrome Separation:** Navigation chrome requires no shadow; it relies on sharp chromatic contrast between the dark green surfaces and the `#F8FAF8` workspace canvas.

## Shapes

The interface embraces a tailored **Soft (`1`)** geometry that reinforces engineered discipline:

- Default controls (buttons, inputs, select triggers, segmented bars) leverage a subtle `0.25rem` (`4px`) corner radius.
- Cards, panels, and metric containers scale to `0.5rem` (`8px`, `rounded-lg`).
- Modal windows and slide-over drawers use `0.75rem` (`12px`, `rounded-xl`).
- High-density table elements, data pills, and status badges remain strictly squared to `4px` or fully circular (`pill-shaped` for numeric badges only) to preserve space economy.

## Components

- **Buttons:**
  - *Primary:* Solid `#166534` background with pure white text, transitioning to `#14532D` on hover. Focus rings use `2px solid #16A34A` with a `2px` offset.
  - *Secondary:* White surface, `#E5E7EB` border, `#0F172A` text; hovers to `#F8FAF8` with `#CBD5E1` border.
  - *Chrome Context:* Pure white fill with `#14532D` label, or ghost button with translucent hover state (`rgba(255, 255, 255, 0.1)`).
- **Navigation Items (Sidebar):**
  - Text rendered in `rgba(255, 255, 255, 0.75)` with regular weight.
  - Active item features an emerald `#16A34A` left indicator bar (width: `3px`), a subtle background wash of `rgba(22, 163, 74, 0.15)`, and `#FFFFFF` text weight bumped to semi-bold.
- **Cards & Metric Widgets:**
  - Background `#FFFFFF`, border `1px solid #E5E7EB`, radius `8px`. Headers feature bottom dividers (`1px solid #F1F5F9`) with secondary actions aligned right. KPI numbers utilize `JetBrains Mono` at semi-bold/bold weights.
- **Form Controls & Inputs:**
  - Input field background `#FFFFFF`, border `1px solid #E5E7EB`, height `36px`, typography `14px`. On focus, transitions cleanly to border color `#16A34A` with an ambient glow (`box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12)`).
- **Badges & Chips:**
  - Compact `20px` height. Operational statuses use tinted backgrounds: Success uses `#DCFCE7` with `#166534` text; Warning uses `#FEF3C7` with `#92400E` text; Neutral uses `#F1F5F9` with `#475569` text.
- **Checkboxes & Radios:**
  - Square `16px` box with `3px` radius. Inactive: border `1px solid #CBD5E1`. Checked: background `#166534`, border `#166534`, white checkmark glyph.
- **Data Tables:**
  - Header row styled in `#F8FAF8` with subtle upper-border, text in `label-sm` (`JetBrains Mono`, `#64748B`, uppercase). Rows feature subtle `#F1F5F9` bottom borders and highlight to `#F8FAF8` on cursor hover.