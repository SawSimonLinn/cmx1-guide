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

## Operational Excellence Review

OER is enabled in Choose a form alongside Store Visit. Start with Chef/FZ presence, record verified answers, select findings, and copy individual editable notes into CMX1. Review the executive summary and copy all notes before saving a draft or completed report. History opens either report type and can create a **blank** draft of the same type; previous answers and findings are deliberately not copied.

For an existing database, run `supabase/migrations/20261110_oer.sql` in the Supabase SQL Editor before saving OER reports. New databases can use `supabase/schema.sql`. The existing authenticated, per-user row-level policies protect OER data too. Google/Microsoft authentication is reused. No external AI API is needed.

Evidence fields store references to photos/documents (for example, a secure file location); this module does not upload files or grant access to referenced evidence. Generated notes and summaries are saved alongside manual overrides. Regenerate explicitly to replace an edited note or summary after changing answers.

### Scoring pending official verification

The reference PDF was not supplied in the available attachments. The typed question definitions use the numbering, wording and point values in the task (1–30 and 32; no question 31). Verify these against the original before operational rollout.

All displayed scores are **provisional**, using only scored questions answered Yes or No. Question 14 is reversed: Yes loses its three points. Zero-point administrative items are excluded. N/A, Unable to Verify, and unanswered questions are excluded from the provisional answered-item denominator; the total configured points and coverage are displayed separately. This is not an official N/A rule. Category mappings, official denominator adjustments, treatment of unverified answers, and pass/fail thresholds remain unverified. Category scores and automatic official Pass/Fail are therefore disabled. Rating is explicitly entered by the supervisor.

Chef absence never changes an answer or awards/deducts points. Corrective text only describes correction/coaching as completed when confirmed, and separates retraining/follow-up requirements. Compound questions should use Unable to Verify when supported if not all elements can be verified; record partial observations in the details field.

Run `npm test` for deterministic note, summary, scoring, serialization, and Store Visit regression tests; `npm run lint` for TypeScript; `npm run build` for a production build. Live authenticated Supabase save/reopen and cross-user RLS checks require a configured test account and applied migration.
