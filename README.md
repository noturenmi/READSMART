# READSMART

READSMART is a supplementary reading comprehension and writing practice app for Senior High School HUMSS students. It supports classroom learning and teacher assessment; it does not replace either.

## Current development stage

Stage 9 adds administrator monitoring and content management. Stage 8 student progress and one-time XP rewards, and Stage 6 AI summaries and writing feedback remain supplementary; none replaces official reading or writing assessment results.

## Requirements

- Node.js 20 or newer and npm
- MongoDB running locally or a MongoDB Atlas connection string
- Expo Go on Android for device testing

## Backend setup

1. Copy `server/.env.example` to `server/.env`.
2. Set `MONGODB_URI` to a reachable MongoDB database and replace `JWT_SECRET` with a private random value of at least 32 characters. For example, generate one with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
   ```

3. Install dependencies and start the API:

   ```powershell
   cd server
   npm install
   npm run dev
   ```

Run the authentication and reading API integration tests with `npm test` from `server/`. They start temporary MongoDB instances and do not use a configured development database.

Seed the four subjects and 40 lesson title records into the configured database with `npm run seed:reading` from `server/`. The upsert seed is safe to run repeatedly and preserves any existing lesson bodies and publication state. Seeded records without prepared content remain unpublished.

Import the approved MIL lesson bodies with `npm run import:mil` from `server/`. This idempotent import updates lesson numbers 1–10 for the existing `MIL` subject and publishes those lessons.

Import the approved UCSP lesson bodies with `npm run import:ucsp`, CPAR lesson bodies with `npm run import:cpar`, and Earth and Life Science lesson bodies with `npm run import:els` from `server/`. Each idempotent import updates lesson numbers 1–10 for the existing subject and publishes those lessons while preserving lesson IDs. The imports verify the four-subject, 40-lesson catalog.

Seed the lesson-specific assessment questions after all four reading subjects are published with `npm run seed:assessment` from `server/`. The idempotent seed creates five published questions per lesson (200 total) and does not modify reading lesson content or publication state.

Create writing activities for the 40 published lessons with `npm run seed:writing` from `server/`. The idempotent seed updates the existing lesson-linked activity records and creates one published, topic-specific prompt per lesson, with a 100–250 word range and the common five-criterion rubric. Every submission is scored by the backend and saved as a separate attempt.

The API listens on port 3000 by default and does not start until MongoDB connects successfully.

### Optional local AI-assisted learning support

AI summaries and supplementary writing feedback run through a locally hosted Ollama instance. The Express backend is the only caller of Ollama; the mobile app continues to call the authenticated READSMART API. No cloud AI provider or API key is used.

Prerequisites:

1. Install Ollama on the computer running the backend.
2. Check the locally installed model name with `ollama list`. READSMART does not download a model automatically.
3. Copy the exact installed model name into `OLLAMA_MODEL` in `server/.env`. The checked-in example leaves it blank intentionally.
4. Keep Ollama bound to loopback at `http://127.0.0.1:11434`; do not expose port 11434 to the LAN or internet.
5. Start Ollama using the Ollama desktop app or `ollama serve`. If needed, load a model only after confirming it is already installed with `ollama list`.

Local server configuration in `server/.env`:

- `AI_PROVIDER=ollama`
- `OLLAMA_BASE_URL=http://127.0.0.1:11434` — backend-only loopback URL; other hosts are rejected
- `OLLAMA_MODEL` — exact name shown by `ollama list`
- `OLLAMA_NUM_CTX=4096` — initial context limit to reduce memory use
- `AI_TIMEOUT_MS=90000` — backend inference timeout

Leave the model name blank to disable AI until Ollama and an installed model are ready. The API and official assessments continue to work if Ollama is offline. AI calls have a longer mobile request timeout than ordinary API calls; all other API timeouts remain unchanged. Neither the Ollama URL nor model configuration belongs in `mobile/.env` or an `EXPO_PUBLIC_*` variable.

To test manually, start Ollama and the READSMART backend, sign in to the mobile app, then use **Generate Summary** on a published lesson and **Get AI-Assisted Feedback** on your own saved writing result. The endpoints are `POST /api/lessons/:lessonId/summary` and `POST /api/lessons/:lessonId/writing/:submissionId/ai-feedback`; both require the normal READSMART bearer token and an empty request body. A model-not-installed response, offline service, timeout, or invalid model output returns a controlled error rather than fabricated AI content. Automated tests mock Ollama responses; they do not count as live inference verification.

For physical Android testing, put the backend computer and phone on a network where the phone can reach the configured `EXPO_PUBLIC_API_URL` (typically `http://<computer-LAN-IP>:3000/api`). Allow inbound traffic to the Express port as needed, but keep Ollama’s port 11434 restricted to loopback. Prompts and student writing are sent only from Express to the local Ollama process, not to an external inference provider.

### Create an administrator

Public registration always creates a student. To bootstrap the first administrator, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `server/.env` (use a unique email and a long password), then run:

```powershell
cd server
npm run create-admin
```

The bootstrap command refuses to promote an existing student account.

## Mobile setup

1. Copy `mobile/.env.example` to `mobile/.env`.
2. Set `EXPO_PUBLIC_API_URL` to the API URL reachable from the device:
   - Android emulator: `http://10.0.2.2:3000/api`
   - Physical Android device: `http://<development-computer-LAN-IP>:3000/api`
3. Start the Expo app:

   ```powershell
   cd mobile
   npm install
   npx expo start
   ```

Allow inbound connections to port 3000 in the development computer's firewall for physical-device testing. The mobile app contains no MongoDB URI, JWT secret, or administrator credential. Its public API URL is configuration, not a secret.

Run the mobile test suite with `npm test` from `mobile/`. Export the Android JavaScript bundle with `npx expo export --platform android` from `mobile/`.

## API endpoints

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/register` | Public; creates a student account |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | Authenticated |
| GET | `/api/test/protected` | Authenticated |
| GET | `/api/admin/test` | Authenticated administrator |
| GET | `/api/subjects` | Authenticated |
| GET | `/api/subjects/:subjectId` | Authenticated |
| GET | `/api/subjects/:subjectId/lessons` | Authenticated; published lessons only |
| GET | `/api/lessons/:lessonId` | Authenticated; published lessons only |
| GET | `/api/lessons/:lessonId/questions` | Authenticated; published questions only, correct answers hidden |
| POST | `/api/lessons/:lessonId/assessment` | Authenticated; server-scored assessment submission |
| GET | `/api/lessons/:lessonId/assessment-attempts` | Authenticated; current user's attempts only |
| GET | `/api/writing/activities` | Authenticated student; published activities with own status |
| GET | `/api/lessons/:lessonId/writing` | Authenticated; published lesson writing activity |
| POST | `/api/lessons/:lessonId/writing` | Authenticated student; backend-scored writing submission |
| GET | `/api/lessons/:lessonId/writing-submissions` | Authenticated student; own saved submissions only |
| POST | `/api/lessons/:lessonId/summary` | Authenticated; published lesson summarized by the server-side AI service, with lesson-content caching |
| POST | `/api/lessons/:lessonId/writing/:submissionId/ai-feedback` | Authenticated student; supplementary feedback for own saved submission only |
| GET | `/api/progress/me` | Authenticated student; own XP, level, and completion totals |
| GET | `/api/progress/subjects` | Authenticated student; completion grouped by active subject |
| GET | `/api/admin/dashboard` | Authenticated administrator; system counts and recent learning activity |
| GET | `/api/admin/users` | Authenticated administrator; paginated student accounts and current progress summary |
| GET | `/api/admin/users/:userId` | Authenticated administrator; safe student profile fields |
| GET | `/api/admin/users/:userId/progress` | Authenticated administrator; calculated student and subject progress |
| GET/POST | `/api/admin/subjects` | Authenticated administrator; list/create subjects |
| PUT | `/api/admin/subjects/:subjectId` | Authenticated administrator; update subject |
| PATCH | `/api/admin/subjects/:subjectId/publish` | Authenticated administrator; set subject `isActive` |
| GET/POST | `/api/admin/subjects/:subjectId/lessons` | Authenticated administrator; list/create lessons for a subject |
| PUT | `/api/admin/lessons/:lessonId` | Authenticated administrator; update lesson content |
| PATCH | `/api/admin/lessons/:lessonId/publish` | Authenticated administrator; publish/unpublish lesson |
| GET/POST | `/api/admin/lessons/:lessonId/questions` | Authenticated administrator; list/create lesson questions |
| PUT | `/api/admin/questions/:questionId` | Authenticated administrator; update question |
| PATCH | `/api/admin/questions/:questionId/publish` | Authenticated administrator; publish/unpublish question |
| GET/POST | `/api/admin/lessons/:lessonId/writing` | Authenticated administrator; view/create writing activity |
| PUT | `/api/admin/writing/:activityId` | Authenticated administrator; update writing activity |
| PATCH | `/api/admin/writing/:activityId/publish` | Authenticated administrator; publish/unpublish writing activity |

Successful responses use `{ "success": true, "data": ... }`; errors use `{ "success": false, "error": ... }`. Access tokens are JWTs with a one-hour default lifetime. The app stores the token with Expo SecureStore and removes it on logout.

Progress is calculated from the student's saved assessment attempts and writing submissions against currently published lessons, questions, and writing activities. A lesson counts once toward overall completion if the student has completed either learning activity. The backend awards 20 XP once per lesson for a reading assessment and 25 XP once per lesson for a writing activity; opening lessons, summaries, and AI feedback do not award XP. Levels use `floor(totalXP / 100) + 1`. Progress records are initialized on demand; XP rewards are protected by a unique per-user/activity/lesson ledger key.

Administrator accounts are created only through the existing `npm run create-admin` bootstrap command. Public registration always creates a student. All `/api/admin/*` management routes verify both the JWT and the database-backed `admin` role. Admin content changes publish/unpublish or update records; they do not delete assessment attempts, writing submissions, progress, or XP records.

## Environment files

`server/.env` and `mobile/.env` contain local configuration and are ignored by their respective `.gitignore` files. Only the `.env.example` templates should be shared. Never put MongoDB credentials, JWT secrets, administrator passwords, or server-only Ollama configuration in the Expo app.
