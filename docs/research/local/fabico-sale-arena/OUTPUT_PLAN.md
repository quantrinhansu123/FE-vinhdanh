# OUTPUT_PLAN — fabico-sale-arena (html-bundle)

## Mode
`html-bundle` from `C:\Users\Admin\Documents\Codex\2026-10-26\c\outputs\fabico-arena`

## Stack adaptation
Host app is Vite + React 19 + React Router, not Next.js App Router.
Skill isolation and behavior port still apply. Route is a public React page, no auth.

## Route
`/sale-arena` — no login. Existing `/`, `/login`, `/crm-admin` unchanged.

## Artifacts
- Assets: `public/pages/fabico-sale-arena/`
- Scoped CSS (source styles, not rewritten to Tailwind): `src/components/pages/fabico-sale-arena/arena.css`
- Page: `src/pages/FabicoSaleArenaPage.tsx`
- Components: `src/components/pages/fabico-sale-arena/`

## Behavior
Port `app.js` + `data.js`: period, BU filter, table tabs, search, refresh, clock, demo data when `apiUrl` is empty.
