# PV Trainer

A training tool for Dutch police students to practice writing a
**proces-verbaal (PV)**. Students interview an AI-played witness or suspect,
then write up a PV, which is auto-graded against a 6-criteria rubric.
Teachers manage cases, students, and review PV reports.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Firebase Auth + Firestore (client SDK for reads in the UI, Admin SDK for
  every privileged/admin operation)
- Anthropic API (witness/suspect roleplay, case generation, PV grading)
- OpenAI TTS (optional — spoken witness/suspect voice in the interview)
- Deploy target: Vercel

## Local setup

```bash
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev
```

### Required environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Witness/suspect chat, case generation, PV grading |
| `OPENAI_API_KEY` | No | Text-to-speech for the interview voice |
| `NEXT_PUBLIC_FIREBASE_*` | Yes | Firebase client SDK (Auth + Firestore) |
| `FIREBASE_ADMIN_PROJECT_ID` | **Yes** | Firebase Admin SDK — see below |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | **Yes** | Firebase Admin SDK |
| `FIREBASE_ADMIN_PRIVATE_KEY` | **Yes** | Firebase Admin SDK — paste the raw PEM value, `\n`-escaped, **without** surrounding quote characters |
| `SEED_SECRET` | No | Token required to call `/api/seed` (built-in case seeding) |

**The Firebase Admin SDK is mandatory**, not optional. It's used to verify
every authenticated request server-side (`lib/firebase-admin.ts`
`requireAuth`/`requireTeacher`) and to create/manage accounts. There is no
fallback path if it's missing — protected routes will return 500 until it's
configured.

## Account model

There is **no public self-registration**. Every account — student or
teacher — is created by an existing teacher via the "New user" flow on
`/teacher/users`, which:

1. Creates the Firebase Auth account with a random, unusable placeholder
   password (nobody, including the admin, ever sees or sets it)
2. Writes the Firestore `profiles/{uid}` document with the chosen role
3. Sets a `role` custom claim on the Firebase Auth user (used for fast
   server-side role checks without a Firestore read)
4. Triggers Firebase's built-in password-reset email so the new user sets
   their own password on first access

`/login` is the only public auth page. A signed-in user with no matching
Firestore profile is treated as unauthorized (not given a fallback role).

## Authorization model

- **API routes** (`app/api/**`) verify a Firebase ID token via
  `requireAuth`/`requireTeacher` in `lib/firebase-admin.ts` before doing
  anything. `requireTeacher` additionally checks the caller's role.
- **Client pages** do a lightweight role check for UX (redirect a
  non-teacher away from `/teacher/*` immediately) — this is not the real
  security boundary, just avoids flashing the wrong UI. The real boundary
  is the API layer above and the Firestore rules below.
- **`firestore.rules`** (tracked in this repo) mirrors the same checks at
  the database layer, so direct client Firestore access can't bypass the
  API's authorization even if a route were ever misconfigured. Deploy rule
  changes to Firebase whenever this file changes:
  ```bash
  firebase deploy --only firestore:rules
  ```
- **Session/PV ownership**: a student can only read their own
  `sessions`/`pvreports` documents (checked both client-side, for a clean
  "access denied" screen, and in Firestore rules, which is what actually
  enforces it).
- `middleware.ts` only checks whether a session cookie is present — it is
  a coarse "are you logged in at all" redirect for UX, **not** a role
  check. Don't rely on it for anything privileged.

## Directory structure

```
app/
  (auth)/login                    — the only public auth page
  api/
    admin/users, admin/users/[uid] — user CRUD (teacher-only, Admin SDK)
    chat                          — AI witness/suspect reply (any signed-in user)
    generate-case                 — AI case generator (teacher-only)
    evaluate                      — AI PV grading (any signed-in user)
    seed                          — one-time builtin case seeding (token-gated)
    tts                           — OpenAI text-to-speech (any signed-in user)
  student-start, docent-start     — role-specific landing/login shortcuts
  student/                        — cases, dashboard, interview, pv-editor, results
  teacher/                        — cases, dashboard, pvreports, sessions, students, users
contexts/AuthContext.tsx          — Firebase auth state + profile fetch
lib/
  types.ts                        — Case, Session, PVReport, ScoreBreakdown…
  cases.ts                        — built-in seed cases
  firebase.ts / firebase-admin.ts — client / admin SDK init + auth helpers
  api-client.ts                   — authFetch() — attaches the ID token to API calls
  utils.ts                        — grade conversion, labels, formatting
middleware.ts                     — coarse "logged in?" redirect (not a security boundary)
firestore.rules                   — database-level authorization (see above)
```

## Per-student customization

A teacher can set standing customization on a student's profile from
`/teacher/students/[id]`:

- **Class/group** (`classGroup`) — informational label
- **Attention note** (`attentionNote`) — free text, shown to the student
  (dashboard, interview, PV editor) and factored into their AI-graded
  evaluation
- **Focus areas** (`focusAreas`) — tags from the 6 rubric categories
  (`formalia`, `zeven_w`, `getuigenverklaring`, `delictsomschrijving`,
  `objectiviteit`, `doorvragen`), also shown to the student and fed to
  the grader

These are **standing per-student settings**, not per-assignment — set once,
apply to every future session for that student. Difficulty
(`cooperationLevel`) intentionally stays per-*case*, not per-student — see
the plan doc for why that distinction was made.

`/api/evaluate` fetches the note/focus areas **server-side by the
authenticated uid**, never from the client request body, so a student
can't tamper with their own note to influence grading.

## Known follow-ups (not yet built)

- Rate limiting / spend caps on the AI-calling endpoints
- Audit log for role changes and account deletion
- Pagination on the users/sessions/reports list views
- A visible indicator on the teacher's session/PV review screens when a
  student has an active attention note (easy to forget it's set)
- Distinct male/female AI voice selection tied to witness/suspect gender
  beyond the current TTS voice mapping (voice mapping already exists in
  `/api/tts`; scope for "more" wasn't yet confirmed)
- A deliberate visual/structural pass to make the teacher and student
  experiences feel like clearly distinct apps, not one app with role
  branches
