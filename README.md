# Fieldnotes — Hissho Store Visit Notes

A mobile-first Next.js 15 app that generates editable, copy-ready inspection notes, saves private report history in Supabase, and supports Google / Microsoft OAuth.

## Quick start

1. Install Node.js 20+ and run `npm install`.
2. Create a Supabase project.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase **Project Settings → API**. Use a publishable/anon key, **never** the service role key.
4. In Supabase **SQL Editor**, run `supabase/schema.sql` and the migrations listed below to create the table, owner-only RLS and revision-checked autosave RPC.
5. Under **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` (or your production domain). Add `http://localhost:3000/auth/callback` and `https://YOUR_DOMAIN/auth/callback` to Additional Redirect URLs.
6. Under **Authentication → Providers**, enable **Google** and **Azure (Microsoft)** using the OAuth client ID / secrets created with Google Cloud Console and Microsoft Entra. In each provider's console, register the Supabase callback `https://YOUR_PROJECT.supabase.co/auth/v1/callback` as an authorised redirect URI. For Azure, enable email/profile scopes and set the appropriate supported account types for your Microsoft audience. If using corporate Microsoft 365 accounts, admin consent / tenant policies may apply.
7. Run `npm run dev` and open `http://localhost:3000`.

## Deploy

Deploy the Next.js project on Vercel (Git integration or CLI), set the two Supabase environment variables (and optional server-only AI variables) in Vercel, and add the production URL to Supabase Authentication redirect URLs. HTTPS is required for production OAuth callbacks.

## Daily field operations

Store Visit (13 questions), Operational Excellence Review, and Improvement Training Record are supported. Existing questions, Google/Microsoft sign-in, photo guidance, deep-cleaning notes, wrap-up and provisional OER scoring are preserved.

- **New Report** selects the form and creates a private draft immediately. Completion remains an explicit supervisor action.
- **Activities** opens the original editable report, searches titles/types, filters drafts/completed and report type, sorts by update time, renames, confirms deletion, and creates blank copies of completed reports.
- Answers, presence, findings, typed observations, generated suggestions, manual edits, corrective actions, training, follow-up and summaries persist together.
- Autosave runs about 800 ms after the last edit; important status/navigation actions flush sooner. The status displays **Saved** only after a confirmed server response. Pending writes are journalled locally before the debounce, retried with backoff, and resumed when online or after signing in again on that browser.
- A stable report UUID and per-save token make create/retry idempotent. Saves are serialized; revision checks reject older sessions rather than silently overwriting newer data. Conflict controls can keep the server version or preserve the local version as a separate draft.
- Report editing offers unanswered-question navigation, a findings-only view, editable summaries, individual note copy, and separate observation/action copy controls.

### Database upgrade (required)

For **existing projects**, run these additive migrations in Supabase SQL Editor, in order:

1. `supabase/migrations/20261110_oer.sql`
2. `supabase/migrations/20261111_daily_operations.sql`
3. `supabase/migrations/20261111_improvement_training.sql`
4. `supabase/migrations/20261111_training_evidence.sql` (Supabase Storage)

For **new projects**, run `supabase/schema.sql` followed by all migrations. Do not recreate or drop the existing table. The upgrade adds title, executive summary, completion timestamp, revision and save-token columns. Existing report JSON and per-user RLS policies remain intact. `save_field_report` is a SECURITY INVOKER RPC restricted to authenticated users; it derives ownership from `auth.uid()`, uses a row lock and revision comparison, and controls timestamps in the database. A revision conflict returns SQLSTATE `40001`.

Existing OER corrective fields remain readable. Legacy “corrected” flags without verification are no longer sufficient to describe an issue as resolved. Record the actual action and verification in the new Resolution section.

### Observation and resolution workflow

Enter **What did you observe?**, select optional findings, and choose **Generate Note**. The typed observation is the primary context. Edit the suggestion freely. Changing answers does not discard manual notes; Regenerate asks before replacing an edited note and ignores responses if inputs changed during generation.

Resolution distinguishes Open, Corrected Onsite, Follow-Up Required and Unable to Correct Onsite. Corrected Onsite requires an action and verification; Other verification requires detail. Competency Verified requires an independent chef demonstration. Training recommendations remain proposed; training completion alone does not verify a food-safety correction. Review generated text before copying it to CMX1. The app never submits to CMX1.

### Optional server-side AI

Set the following only in server environment variables (never `NEXT_PUBLIC_*`):

```dotenv
NOTE_AI_PROVIDER=openai
OPENAI_API_KEY=your-server-key
OPENAI_MODEL=gpt-4.1-mini
```

The model must support Chat Completions structured JSON outputs. `NOTE_AI_PROVIDER=none` or an absent key enables the deterministic fallback. Provider failures, timeouts and invalid/ungrounded responses also use the visibly labelled fallback. `lib/server/note-provider.ts` defines the replaceable provider interface. The implementation follows [official OpenAI structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat).

`POST /api/notes` requires a valid Supabase Bearer session, validates bounded inspection data, uses a 20-second provider timeout, and returns only structured note fields. For Store Visit/OER it receives only bounded inspection context. Training requests are validated as structured training records; only incident date/source, issues/actions/verification, inventory confirmation/notes, and final notes are forwarded to the AI. Employee/trainer fields, attachment paths/files, and previous generated or edited output are excluded. Store Visit/OER resolution actions are rendered on the server from confirmed input. Training actions are sent as evidence with explicit rules to distinguish plans, corrections, training and demonstrated competency. Store Visit/OER common email/phone identifiers in observations are redacted before transmission. Training narratives can contain identifiers the supervisor types; avoid unnecessary personal information. Avoid entering personal identifiers in observation text; automatic redaction cannot identify every name or identifier. AI output is a suggestion, not an independent verification of safety or policy. In-memory throttling allows 20 requests per user per minute per server instance; use shared infrastructure for a strict deployment-wide quota.

### Offline and device storage

Pending edits are stored under the authenticated user's ID in this browser's localStorage and retained across sign-out for that same user's recovery. Other signed-in accounts do not load them. Device storage is not encryption: use a trusted device, and sign out when finished. Offline edits sync when connectivity returns. If storage is unavailable or full, the app reports it; keep the page open until Saved. Closing a browser cannot guarantee completion of network requests; the local journal is the recovery mechanism. A new device can resume only the version already confirmed by Supabase. Clearing browser site data removes pending offline edits.

Store Visit and OER retain their existing evidence references. Improvement Training Record uploads private supporting images/PDFs to Supabase Storage and opens them with expiring signed URLs. No official CMX1 submission or policy integration is included.

### Scoring pending official verification

The reference PDF was not supplied in the available attachments. The typed question definitions use the numbering, wording and point values in the task (1–30 and 32; no question 31). Verify these against the original before operational rollout.

All displayed scores are **provisional**, using only scored questions answered Yes or No. Question 14 is reversed: Yes loses its three points. Zero-point administrative items are excluded. N/A, Unable to Verify, and unanswered questions are excluded from the provisional answered-item denominator; the total configured points and coverage are displayed separately. This is not an official N/A rule. Category mappings, official denominator adjustments, treatment of unverified answers, and pass/fail thresholds remain unverified. Category scores and automatic official Pass/Fail are therefore disabled. Rating is explicitly entered by the supervisor.

Chef absence never changes an answer or awards/deducts points. Corrective text only describes correction/coaching as completed when confirmed, and separates retraining/follow-up requirements. Compound questions should use Unable to Verify when supported if not all elements can be verified; record partial observations in the details field.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

`lint` runs the existing TypeScript check; no separate ESLint configuration is present. Tests use Node's test runner and PGlite (embedded PostgreSQL) to exercise the real migration, idempotent creation/retries, stale revision rejection, timestamps, completion/reopening, JSON round trips, invalid payloads and cross-user RLS. Note tests cover the six observation scenarios, provider failure, latest-input generation, manual edits, training recommendations, resolution verification, summaries and existing Store Visit/OER regressions. They do not contact a live AI provider or hosted Supabase. Live OAuth and real deployment connectivity require configured accounts and applied migrations.

The compatible PostCSS 8 override in `package.json` replaces Next.js's older transitive version to address the advisories reported by `npm audit`, without changing the Next.js major version.

Previous daily-operations upgrade validation: 38 automated tests passed; TypeScript, the existing lint command, production build, and dependency audit pass. Isolated browser fixtures exercised draft creation, debounced saves, editing during a delayed save, offline journal/reconnection, refresh recovery, Activities search/open, manual-edit confirmation, latest-input generation, OER presence/resolution/competency, and desktop/mobile layouts. The notes endpoint rejects unauthenticated requests with HTTP 401. These fixture checks do not establish live OAuth, hosted database migration status, or live model availability.


## Improvement Training Record

Select **New Report → Improvement Training Record**. A private draft is created immediately using the same journal, save tokens, revision checks and Activities history. No store/location ID is required. The original PDF is a field/structure reference only; its names, dates and findings are never default data.

1. Enter an optional incident date/source and one or more employee names.
2. Add any number of issues. Each stable-ID issue stores the observation, actual/planned resolution, issue and training status, optional verification, equipment items, quantities and order status. Move/remove controls preserve other issues and manual notes.
3. Generate an individual note or the combined CMX1 sections. The generator treats typed evidence as data, distinguishes planned/completed actions, and rejects unsupported numeric, competency, order and equipment-function claims. Review all generated descriptions. Without a configured AI provider, the labelled template fallback preserves supplied observations and attributes action notes without rewriting plans as completed work.
4. Confirm additional trainers and the inventory answer (suggested from issue equipment requirements), attach evidence, and add final notes. Each CMX1 section is independently editable and copyable. Regeneration asks before replacing manual output and discards responses if inputs changed during generation.
5. Mark Completed explicitly; reopen through Activities to continue. Activities shows issue counts and supports deleting or copying a training draft/completed report. Copies retain text/issues but intentionally omit attachment references, so deleting evidence in one record cannot break another copy.

The additive `training_data` JSONB column leaves existing answers/OER data intact. Deploy the training-report migration **after** the daily-operations migration; reapplying an older migration alone can restore the older form-type constraint/RPC. No production migrations are applied automatically by the app.

The `training-evidence` bucket is private, accepts JPEG/PNG/WebP/HEIC/HEIF/PDF files up to 20 MB each, and requires the signed-in owner's UUID and an existing owned training report UUID in the upload path. Wait for the first draft save before uploading; a still-offline/new draft cannot upload until the server record exists. Files use signed one-hour access URLs, refreshed while the editor remains open. Upload progress is indeterminate while the upload is pending. Metadata autosaves alongside the report; file removal removes its reference immediately and deletes the private object. Report deletion also attempts evidence cleanup. Failed cleanup may leave an owner-private orphan for a storage administrator to remove. Files are never sent to AI or uploaded to CMX1.

Required configuration: apply both new SQL migrations in Supabase SQL Editor; keep existing OAuth/client environment settings; set the optional server AI variables above for professional AI rewriting. Storage/AI failures are surfaced in the editor. Existing projects without these migrations cannot save the new report type or upload evidence.

Training validation includes actual Postgres migration/RLS tests for report lifecycle and private evidence ownership, journal recovery with multiple/reordered issues and attachments, mixed corrected/unresolved actions, inventory order states, latest-input generation, fallback and unsupported AI claims. Browser fixtures exercise the editor and autosave against intercepted Supabase/AI responses; they do not verify live OAuth, hosted migration state, real uploads or model availability. Run the commands in Validation above. For live rollout, check account A can upload/open/remove an image and PDF and account B cannot access those objects, then reopen the saved report on another signed-in device.

Local training-module validation completed: **49 tests pass**, including embedded PostgreSQL report/storage RLS tests. TypeScript, lint (the project's TypeScript lint command), production build and `git diff --check` pass. Browser fixtures pass individual/combined generation, mixed issue states, stale-generation protection, manual-edit confirmation, add/remove/reorder, additional trainers, equipment orders, photo upload/private preview/removal, autosave/restore, Activities reopening, completion/reopening, section/full-report copy, duplication/deletion and 375px/1440px layout checks. Existing OER corrected-state and mobile drawer browser regression checks also pass. The live notes route returns 401 without authentication. Hosted migrations, live OAuth, real Storage uploads and live AI responses remain deployment checks.

### Fix: `relation "public.visit_reports" does not exist`

The selected database has not had the base schema installed. Confirm the Supabase project matches the app's `NEXT_PUBLIC_SUPABASE_URL`, then run the **entire** [`supabase/setup.sql`](supabase/setup.sql) file in its SQL Editor. This single transaction creates the base table before applying all report and private-evidence migrations. It also works on a partially configured project and can be rerun; existing report rows are retained. Refresh Fieldnotes afterward. Do not run just the evidence/training migration against an empty database.

`setup.sql` is generated from the schema and migrations. After changing those source files, regenerate it with `node scripts/build-db-setup.mjs`.

### AI Assistant conversations

Apply `supabase/migrations/20261112_ai_conversations.sql` after the existing report migrations. Chat history uses its own RLS-protected table and is not report evidence. Existing server-only `OPENAI_API_KEY`, `OPENAI_MODEL`, and `NOTE_AI_PROVIDER` settings also configure chat. Without a provider, the assistant clearly labels factual template notes and does not simulate conversational refinements. Rate limiting is per server process (20 requests per user per minute); multi-instance deployments need a shared limiter.

The sidebar and report toolbar open the assistant. Question/issue buttons attach live fields; Entire Report shares inspection content without account metadata or attachment URLs. Accepting a suggestion uses the report autosave journal. Manual note regeneration opens a preview. Deploy the migration before enabling chat in production.
