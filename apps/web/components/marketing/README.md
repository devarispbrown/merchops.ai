# Marketing Components

> **Source of Truth: Magic Patterns**
>
> All copy and Tailwind classnames in this directory are contractually fixed to the Magic Patterns source design. Do not modify copy or styling without updating the Magic Patterns design first.

## Overview

This directory contains the marketing landing page components for MerchOps. The landing page is rendered at `/` for unauthenticated users (authenticated users are redirected to `/queue`).

---

## File Layout

```
/apps/web/components/marketing
├── README.md                     # This file
├── pages/
│   └── LandingPage.tsx           # Main landing page component
└── components/
    ├── CampaignCard.tsx          # Campaign/solution cards with metrics
    ├── FeatureCard.tsx           # Feature highlight cards
    ├── PricingCard.tsx           # Pricing tier cards
    └── FAQItem.tsx               # Expandable FAQ accordion items
```

### Component Descriptions

| Component | Purpose |
|-----------|---------|
| `LandingPage.tsx` | Full page composition with all sections, navigation, and footer |
| `CampaignCard.tsx` | Displays solution cards with icon, description, and metric highlight |
| `FeatureCard.tsx` | Simple feature cards with icon, title, and description |
| `PricingCard.tsx` | Pricing tier card with features list and CTA button |
| `FAQItem.tsx` | Accordion-style FAQ item with expand/collapse behavior |

---

## Conversion CTAs

The landing page contains several call-to-action buttons that drive users to sign up.

### Primary CTAs (Route to `/signup?returnTo=/app`)

| Location | Button Text | Behavior |
|----------|-------------|----------|
| Navigation (desktop) | "Join the beta" | `router.push('/signup?returnTo=/app')` |
| Navigation (mobile) | "Join the beta" | `router.push('/signup?returnTo=/app')` |
| Hero section | "Join the beta" | `router.push('/signup?returnTo=/app')` |
| Final CTA section | "Start your free trial" | `router.push('/signup?returnTo=/app')` |

### Secondary CTAs (In-page scroll)

| Location | Button Text | Behavior |
|----------|-------------|----------|
| Hero section | "See how it works" | Scrolls to `#how-it-works` |
| Navigation links | "How it works", "Who it's for", "Pricing", "FAQ" | Smooth scroll to respective sections |
| Footer links | Product/Company links | Scroll to sections or placeholder `#` links |

### Pricing Card CTAs

| Plan | Button Text | Current Behavior |
|------|-------------|------------------|
| Beta | "Join the beta" | Scrolls to `#hero` (placeholder) |
| Launch | "Notify me at launch" | Scrolls to `#hero` (placeholder) |
| Enterprise | "Contact sales" | Scrolls to `#hero` (placeholder) |

> **Note:** Pricing CTAs currently scroll to hero section as placeholders. These may be updated to route to dedicated flows (waitlist form, contact form) in future iterations.

---

## Editing Guidelines

### What You Should NOT Change

1. **Copy text**: All headlines, descriptions, feature lists, and FAQ content
2. **Tailwind classnames**: All styling, spacing, colors, and responsive breakpoints
3. **Component structure**: Layout and composition of elements
4. **Design tokens**: Color values (e.g., `blue-600`, `neutral-900`)

### What You CAN Change (If Needed)

1. **Routing destinations**: Update `router.push()` paths if auth flow changes
2. **Section IDs**: Update `id` attributes if section anchors need renaming
3. **Link hrefs**: Update placeholder `#` links in footer when real pages exist
4. **Metrics data**: The `metric` and `metricLabel` props on CampaignCards may be updated with real data

### How to Edit (Proper Process)

1. Make changes in the Magic Patterns design tool first
2. Export the updated code from Magic Patterns
3. Replace the corresponding files in this directory
4. Verify routing and event handlers are preserved
5. Test all CTAs and scroll behaviors

---

## Route Integration

The landing page is integrated into the app via:

```
/apps/web/app/page.tsx
```

This page component:
1. Checks for authenticated session via `auth()`
2. Redirects authenticated users to `/queue`
3. Renders `<LandingPage />` for unauthenticated users

---

## Authentication Flow

When users click a conversion CTA:

1. User clicks "Join the beta" on landing page
2. Router navigates to `/signup?returnTo=/app`
3. After successful signup, user is redirected to `/login?registered=true&returnTo=/app`
4. After successful login, user is redirected to `/app` (or `/queue` if `returnTo` not specified)

The `returnTo` parameter ensures users land in the app after completing auth flow.

---

## Related Documentation

- [Root README](/README.md) - Project overview
- [API Integration](/API_INTEGRATION.md) - Dashboard API integration
- [Auth Flow](/docs/api/README.md#authentication) - Authentication documentation
