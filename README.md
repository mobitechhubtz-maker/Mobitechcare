# MOBITECH HUB — Next.js + Supabase + Netlify

This is your original single-file app (`mobitech-hub-system-1.html`) restructured
into a proper Next.js App Router project, split into an isolated public
storefront and an isolated admin portal, wired to the **same live Supabase
project** already embedded in that file (`zjqpwuexnyzgqugsrpbs.supabase.co`).
No data model changed — every table, RPC, and storage bucket below already
exists in that project; this just gives the app a real deployable
architecture around it.

## Architecture at a glance

```
                    ┌─────────────────────────────┐
   Browser  ───────▶│           Netlify            │
                    │  (Next.js runtime plugin)    │
                    │                              │
                    │  middleware.ts (Edge Fn)     │──┐ checks auth + approval
                    │  (storefront) → public pages │  │ before /admin/* renders
                    │  (admin)      → admin portal  │  │
                    └─────────────┬────────────────┘  │
                                  │                     │
                                  ▼                     │
                    ┌─────────────────────────────┐    │
                    │           Supabase           │◀───┘
                    │  Postgres + Row-Level Security│
                    │  Auth (email/password)        │
                    │  Storage (public-assets,      │
                    │           tradein-photos)      │
                    │  Edge Function: grade-device  │──▶ Anthropic API
                    └─────────────────────────────┘      (AI condition grading)
```

- **Netlify** hosts the Next.js app itself (`@netlify/plugin-nextjs` turns
  `middleware.ts` into a Netlify Edge Function automatically — no extra config).
- **Supabase** is the entire backend: Postgres tables with row-level
  security, email/password auth, file storage, and one Edge Function that
  calls the Anthropic API for AI-assisted trade-up grading.
- The Next.js app never talks to Anthropic directly — only the Supabase
  Edge Function does, using its own `ANTHROPIC_API_KEY` secret.

## Folder structure

```
src/
├── middleware.ts              Admin auth guard (Supabase session + approval)
├── app/
│   ├── layout.tsx             Root <html>/<body> + global stylesheet
│   ├── globals.css            Ported design tokens & component classes
│   ├── (storefront)/          Public site — no auth required
│   │   ├── layout.tsx         Header + footer chrome
│   │   ├── page.tsx           Home (hero + how trade-up works)
│   │   ├── catalog/           Inventory grid + search
│   │   ├── trade-in/          Trade-up estimator, AI grading, submission
│   │   └── warranty/          Certificate number lookup + PDF download
│   │                          (added beyond your original tree — the source
│   │                           app has a distinct Warranty tab alongside
│   │                           Trade-Up, so it gets its own route)
│   └── (admin)/                Isolated admin portal group
│       ├── layout.tsx          Thin pass-through (see note below)
│       └── admin/
│           ├── login/          Sign in / register (no sidebar)
│           ├── pending/        Awaiting-approval screen (no sidebar)
│           └── (dashboard)/    Sidebar + profile bar shell
│               ├── layout.tsx  Sidebar, profile bar — the "Admin Layout"
│               ├── page.tsx    Overview
│               ├── inventory/  SKU, stock & pricing + trade-in value list
│               ├── trade-ins/  Request approvals & valuations queue
│               ├── certificates/  Issue, preview, void, PDF export
│               ├── team/       Approve/remove staff
│               └── settings/   Business info, warranty terms, grade multipliers
├── components/                 storefront/, admin/, and shared Certificate.tsx
├── lib/
│   ├── supabase/                client.ts, server.ts, middleware.ts
│   ├── queries.ts, mappers.ts, storage.ts, format.ts, certificatePdf.ts
│   └── business.ts               slug/env constants
└── types/database.ts            TypeScript types mirroring the schema below

supabase/
├── migrations/0001_init.sql     Full schema, RLS policies, RPCs, buckets
└── functions/grade-device/      Reference copy of the deployed Edge Function
```

**One deliberate deviation from the folder scheme you sent:** the sidebar
layout lives in `admin/(dashboard)/layout.tsx`, one level deeper than
`(admin)/layout.tsx`. That's so `/admin/login` and `/admin/pending` render as
plain centered cards instead of showing a sidebar with nothing behind it yet.
`(admin)/layout.tsx` itself is just a pass-through.

## Database (already live — this is documentation, not a required step)

| Table | Purpose |
|---|---|
| `businesses` | One row per shop (`slug = "mobitech-hub"`). Name, contact info, cert numbering, warranty terms, grade multipliers (jsonb). |
| `profiles` | Links a Supabase Auth user to a business. First person to register becomes an approved `owner`; everyone after is `admin`, unapproved until a teammate approves them. |
| `inventory` | Phones/laptops/accessories for sale. Publicly readable. |
| `trade_in_values` | Base wholesale value per model, used to compute top-up quotes. Publicly readable. |
| `certificates` | Issued warranty certificates. **Not** publicly readable as a table — customers only ever see one row via `lookup_certificate()`. |
| `trade_ins` | Customer trade-up submissions. Anyone can insert (no login required to submit); only approved admins can read/update/delete. |

Two RPCs (`SECURITY DEFINER`, narrowly scoped):
- `register_profile(p_slug)` — creates a profile on first sign-in.
- `lookup_certificate(p_business_slug, p_number)` — the only way a customer
  can read certificate data, one row at a time.

Two storage buckets: `public-assets` (logos, inventory photos — admin
write, public read) and `tradein-photos` (customer condition photos —
public insert, public read via direct link, matching the trade-off your
original Settings screen already disclosed).

`supabase/migrations/0001_init.sql` is idempotent — safe to run against the
existing project to confirm everything matches, or against a fresh project
if you ever spin up a second shop from this codebase.

## Deploying

**1. Supabase** — nothing to do if you're pointing at the existing project;
just confirm the `grade-device` function's `ANTHROPIC_API_KEY` secret is
still set (Project Settings → Edge Functions → Secrets).

**2. Netlify**
- New site from Git → connect this repo.
- The deployable application is in `mobitech-hub/`. The ZIP files are archived
  copies, not directories Netlify can build directly.
- Use base directory `mobitech-hub`, build command `npm run build`, and publish
  directory `.next`, as configured in the root `netlify.toml`.
- Netlify automatically detects Next.js and installs its runtime adapter;
  no separate plugin declaration or single-page-app redirect is required.
- Add environment variables (Site settings → Environment variables):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_BUSINESS_SLUG` = `mobitech-hub`
  - `NEXT_PUBLIC_SITE_URL` = your Netlify URL once you have it
- Deploy. Netlify's Next.js runtime turns `middleware.ts` into an Edge
  Function automatically, so the `/admin/*` auth guard runs at the edge with
  no extra Netlify config needed.

**3. Local dev**
```bash
cd mobitech-hub
npm install
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.
npm run dev
```

## Notes on what changed in the port

- **Barcode/QR/PDF**: swapped the original's CDN `<script>` tags for the
  equivalent npm packages (`jsbarcode`, `qrcode`, `jspdf`) so they bundle
  properly with Next.js. Same visual output, same libraries' underlying logic.
- **Auth**: swapped raw `fetch()` calls to the Supabase Auth REST endpoints
  for `@supabase/ssr`'s browser/server clients, which is what lets
  `middleware.ts` read the session server-side before any admin HTML ships
  to the browser — a meaningfully stronger guard than the original's
  client-side-only gate.
- **No "cart"**: the requested folder scheme mentioned a cart, but this is a
  trade-in/warranty shop with in-person purchase, not a checkout flow — so
  there's no cart route. Say the word if you actually want online checkout
  added later.
