# Fieldnotes — Hissho Store Visit Notes

A mobile-first Next.js 15 app that generates editable, copy-ready inspection notes, saves private report history in Supabase, and supports Google / Microsoft OAuth.

## Quick start

1. Install Node.js 20+ and run `npm install`.
2. Create a Supabase project.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase **Project Settings → API**. Use a publishable/anon key, **never** the service role key.
4. In Supabase **SQL Editor**, run `supabase/schema.sql` to create the visit_reports table with per-user row-level security.
5. Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` (or your production domain). Add `http://localhost:3000/auth/callback` and `https://YOUR_DOMAIN/auth/callback` to Additional Redirect URLs.
6. Under **Authentication → Providers**, enable **Google** and **Azure (Microsoft)** using the OAuth client ID / secrets created with Google Cloud Console and Microsoft Entra. In each provider's console, register the Supabase callback `https://YOUR_PROJECT.supabase.co/auth/v1/callback` as an authorised redirect URI. For Azure, enable email/profile scopes and set the appropriate supported account types for your Microsoft audience. If using corporate Microsoft 365 accounts, admin consent / tenant policies may apply.
7. Run `npm run dev` and open `http://localhost:3000`.

## Deploy

Deploy the Next.js project on Vercel (Git integration or CLI), set both environment variables in Vercel, and add the production URL to Supabase Authentication redirect URLs. HTTPS is required for production OAuth callbacks.

## Current scope

- Only **Store Visit** is enabled. All other activity types, including OER and Site Survey, appear as disabled "Coming soon" options.
- 13 questions: 12 store visit prompts + 1 operational infractions question; note yes = an infraction was **found** for question 13.
- Context-specific Yes / No / N/A, numeric input, orientation selector, supplier and case-size fields.
- Editable notes, individual clipboard copy, combined report copy.
- Save drafts or completed reports and return to them later on any device while signed in.
- No store ID, inspection date, or location fields. Supabase automatically timestamps reports for history.
- No photos/uploads: this app generates notes only; attachments still go into CMX1.

## Safeguards and limitations

The app **does not actually verify** observations. It generates note language based on selections, including statements about labels or logbooks only when Yes is selected. Ensure you've performed the necessary checks before copying notes into an official inspection. Provider authentication needs your real Supabase project and Google/Microsoft OAuth credentials; those can't be preconfigured in a generic source download. Review company policies before using personal or corporate sign-in for operational records. This is an independent tool, not an official CMX1 integration.

## Extending later

New templates can be added to `lib/questions.ts`; a future form-type-specific table or structured JSON schema can support OER and site surveys without changing the UI system.
