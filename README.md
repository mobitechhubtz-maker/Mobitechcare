# MobiTech Hub — Shop & Admin System (Next.js)

Real route-level separation: everything under `app/(storefront)` is public,
everything under `app/(admin)` requires a signed-in, approved admin — enforced
by `middleware.ts` before a page is ever sent to the browser. Nothing in the
admin section can leak onto the storefront, because they're different pages
entirely, not one page hiding parts of itself.

## Before you do anything else

`.env.local` already has your real Supabase project URL and anon key in it —
that part is done. Nothing else to configure there.

## Run it locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the storefront, `http://localhost:3000/admin`
for the admin portal (redirects to `/admin/login` if you're not signed in).

Test the full loop locally before deploying: register, confirm your email,
sign in, add an inventory item, issue a certificate, submit a trade-up
request from an incognito window (so you're testing as an anonymous
customer), and approve a second test account from Team.

## Deploy it

This needs a host that runs Next.js server code — `middleware.ts` won't work
on plain static hosting like Netlify Drop. Vercel is the simplest path:

1. Push this folder to a GitHub repo.
2. Import the repo at vercel.com/new.
3. Add the two `NEXT_PUBLIC_*` variables from `.env.local` as Environment
   Variables in the Vercel project settings (same names, same values).
4. Deploy.

Netlify also supports Next.js (including middleware) if you'd rather stay
there — connect the repo through their dashboard rather than the old
drag-and-drop flow, and it will detect the framework automatically.

## Also update your Supabase Auth URL settings

Once you have your real deployed URL, set it in the Supabase dashboard under
**Authentication → URL Configuration** (Site URL + a Redirect URL entry) so
confirmation emails point at the right place instead of localhost.

## What's still simplified from the original build

- Trade-in photo uploads go to a Supabase Storage bucket that's readable by
  anyone with the direct file link (not listed, not access-controlled).
- AI grading calls the `grade-device` Edge Function, which still needs an
  `ANTHROPIC_API_KEY` secret added in your Supabase project before it responds.
- No automated tests. Everything here has been checked for structural and
  type correctness by hand, but hasn't been run through a real `next build` —
  I don't have Node/npm network access in this environment. Run `npm run
  build` yourself before deploying to catch anything that slipped through.
