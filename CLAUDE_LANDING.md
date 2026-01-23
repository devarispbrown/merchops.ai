# CLAUDE_LANDING.md — MerchOps Landing Page Integration (Exact Magic Patterns Source)

## Objective
Integrate the Magic Patterns landing page into the existing MerchOps Next.js (App Router) full-stack application so:

1. `/` renders the landing page with **design + copy exactly matching** the Magic Patterns source code below.
2. Any CTA that represents conversion ("Join the beta", "Start your free trial", "Start free trial") routes into the app auth flow.
3. User can sign up or log in, then land in the app (default `/app`).
4. Authenticated users hitting `/` get routed to the app or see an "Open app" path without breaking landing parity.
5. Beta-grade gates: lint, typecheck, unit/integration tests, and Playwright E2E pass.
6. Documentation exists: root README marketing section + API/auth docs updated.

Hard constraint:
- **Copy must remain byte-for-byte identical** to the Magic Patterns code. No "improvements."
- Tailwind classes, layout structure, and component composition must match exactly, except for minimal Next.js wrappers and routing changes described here.

---

## Source of Truth (Magic Patterns)
The landing page source-of-truth is **exactly** the following files and their contents (provided in this spec):

- `App.tsx` (renders `<LandingPage />`)
- `pages/LandingPage.tsx`
- `components/CampaignCard.tsx`
- `components/ConfidenceBadge.tsx`
- `components/FAQItem.tsx`
- `components/FeatureCard.tsx`
- `components/PricingCard.tsx`
- `index.css`
- `tailwind.config.js`

The Next.js integration must preserve these components with minimal changes:
- Only modify CTA click behavior to route to auth.
- Only modify imports/paths to fit Next.js.
- Do not change strings, headings, bullets, pricing text, FAQ text, button labels.

---

## Next.js Routing Contract

### Routes
- Marketing landing: `/`
- Auth: `/signup` and `/login` (must exist)
- App: `/app` (or the repo's canonical app home route)

### CTA behavior (required)
Replace scroll behavior for conversion CTAs only:

Conversion CTAs in `pages/LandingPage.tsx`:
- Navigation "Join the beta"
- Hero "Join the beta"
- Pricing card CTAs ("Start free trial" buttons inside `PricingCard`)
- Final CTA "Start your free trial"

All of these must navigate to:
- `/signup?returnTo=/app`

Non-conversion buttons keep scroll behavior:
- "How it works", "Who it's for", "Pricing", "FAQ", "See how it works"

### Authenticated behavior for `/`
Preferred:
- If authenticated, redirect `/` → `/app`

Alternative (only if redirect is undesirable):
- Keep landing but ensure at least one CTA becomes "Open the app" (this would violate exact copy unless Magic Patterns already includes it, so do NOT do this).
Therefore: **use redirect**.

Acceptance criteria:
- Unauthed: `/` shows landing; clicking any conversion CTA routes to `/signup?returnTo=/app`
- Completing signup lands in `/app`
- Authed: visiting `/` redirects to `/app` (307 or client redirect acceptable)

---

## File Placement (Exact Code, Next-Compatible)

### Create these files in the Next.js repo
Prefer colocating marketing components in one folder.

#### 1) Landing components (preserve names + exports)
Create:
- `apps/web/components/marketing/pages/LandingPage.tsx` (client component)
- `apps/web/components/marketing/components/CampaignCard.tsx`
- `apps/web/components/marketing/components/ConfidenceBadge.tsx`
- `apps/web/components/marketing/components/FAQItem.tsx`
- `apps/web/components/marketing/components/FeatureCard.tsx`
- `apps/web/components/marketing/components/PricingCard.tsx`

All files should be copied exactly from Magic Patterns, with only:
- import path fixes (relative paths)
- Next router usage for conversion CTAs (see below)

#### 2) Next.js route for `/`
Create:
- `apps/web/app/page.tsx`

Implementation:
- Server component wrapper that renders the landing client component for unauthed users.
- Performs auth check and redirects authed users to `/app`.

Example behavior:
- If `session` exists: `redirect('/app')`
- Else: render `<LandingPage />`

#### 3) Replace `App.tsx` concept
Magic Patterns has `App.tsx`:

```ts
import React from 'react'
import { LandingPage } from './pages/LandingPage'
export function App() {
  return <LandingPage />
}
```

In Next.js, the equivalent is `app/page.tsx` rendering `LandingPage`. Do not introduce a separate `App.tsx` unless the repo architecture already requires it.

---

## Required Minimal Code Changes (CTA Routing Only)

### LandingPage.tsx changes
In `pages/LandingPage.tsx`, conversion CTAs currently call:

```ts
onClick={() => scrollToSection('cta')}
```

Replace for conversion CTAs only with Next navigation:
- Use `useRouter()` from `next/navigation`
- Replace `scrollToSection('cta')` with `router.push('/signup?returnTo=/app')`

Do not alter:
- button text
- className strings
- section ids
- content arrays

All other scroll navigation remains as-is using `scrollToSection`.

### PricingCard.tsx changes
`PricingCard` currently renders a `<button>` with `{ctaText}`.
To route without changing visual/copy:

Either:
- Accept an optional `onCtaClick?: () => void` prop (but this changes component API), OR
- Wrap the `PricingCard` at call site by overlaying click handler using event delegation, OR
- Convert the button to `next/link` with identical classes (preferred).

Constraint: preserve visual markup as closely as possible.
Preferred approach:
- Replace `<button ...>{ctaText}</button>` with `<Link ... href="/signup?returnTo=/app">{ctaText}</Link>`
- Keep `className` identical.
- Keep text identical.

If you choose to keep `<button>`, then `onClick` must route.

### Final CTA button
In CTA section, button text is "Start your free trial".
It must route to `/signup?returnTo=/app` instead of doing nothing.

---

## Global Styles (Exact)
Magic Patterns `index.css` must be integrated into Next global CSS exactly.

### Required
Add to `apps/web/app/globals.css` (or equivalent):
- the Google Fonts import for Inter
- the Tailwind directives
- the base variables layers

Do not partially copy. Preserve as-is.

Note: If the repo already imports Inter via `next/font`, you must still preserve typography equivalence. Easiest path: keep the CSS import exactly and avoid conflicting font declarations.

---

## Tailwind Config Merge (Exact)
Magic Patterns `tailwind.config.js` includes:
- `darkMode: "selector"`
- container settings
- theme extensions for CSS variable-based colors and radius
- keyframes/animations

Merge this into the repo Tailwind config so the landing renders identically.

Hard rules:
- Do not delete existing app extensions unless they conflict.
- Ensure content globs include the marketing components directory.
- Ensure CSS variable color tokens used by landing compile correctly.

---

## Dependencies
Ensure these exist in `package.json`:
- `lucide-react`

If using Next Link:
- `next/link` builtin.

---

## Auth Integration Requirements
Routes must exist:
- `/signup`
- `/login`

Both must:
- accept `returnTo` query param
- redirect to `returnTo` after success, default `/app`

Acceptance criteria:
- `/signup?returnTo=/app` works end-to-end
- `/login?returnTo=/app` works end-to-end
- direct visits to `/app` require auth (or show login)

---

## QA: Tests That Enforce "Exact Copy"

### Playwright E2E (required)
Add tests:

1. **Landing renders exact hero copy**
   - Visit `/`
   - Assert:
     - "Campaigns ready to send."
     - "Not another dashboard."
     - "Draft-first by default. Nothing sends without your approval."
     - "MerchOps turns your Shopify catalog + sales history into winback, discovery, and restock campaigns. You approve. It schedules."
   - Assert "MerchOps.ai" logo text exists.

2. **Conversion CTA routes to signup**
   - Click top nav "Join the beta"
   - Assert URL starts with `/signup`
   - Assert `returnTo=/app`

3. **Hero CTA routes to signup**
   - Click hero "Join the beta"
   - Assert URL starts with `/signup`

4. **Pricing CTA routes to signup**
   - Scroll to pricing
   - Click "Start free trial" on any plan
   - Assert navigates to `/signup?returnTo=/app`

5. **Final CTA routes to signup**
   - Scroll to CTA
   - Click "Start your free trial"
   - Assert navigates to `/signup?returnTo=/app`

6. **Authenticated redirect**
   - With authenticated session, visit `/`
   - Assert redirected to `/app`

### Optional visual checks
If you already have screenshot testing infra:
- Capture `/` at desktop + mobile and keep stable.

---

## Documentation Requirements (Must Ship With Landing)

### Update:

**Root README.md**
Add "Marketing site" section:
- `/` is landing
- CTAs route to auth
- how to edit landing: treat Magic Patterns code as source-of-truth

**Add `apps/web/components/marketing/README.md`**
- states: "Copy and classnames are contractually fixed"
- lists conversion CTAs and routing behavior

**Update auth/API docs:**
- mention `returnTo` param
- mention `/signup` and `/login`

---

## Definition of Done (Landing)
Landing integration is done when:

1. `/` matches Magic Patterns layout, Tailwind classes, and copy exactly
2. All conversion CTAs route to `/signup?returnTo=/app`
3. Signup/login flows work and redirect into `/app`
4. Authenticated users visiting `/` end up in `/app`
5. CI gates are green: lint/typecheck/unit/integration/E2E
6. Documentation updates are merged and accurate
