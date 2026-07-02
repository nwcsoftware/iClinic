# iClinic

Clinic reservation platform with an AI health assistant.

- **`web/`** — Next.js staff portal (doctors, receptionists) + the API the mobile app uses: AI triage, patient booking, chat history. Runs on port 3000.
- **`mobile/`** — Expo / React Native patient app: symptom chat that routes to the right specialty, doctor directory with ratings, slot booking, visit management. Works in the browser via `expo start --web` and on devices.
- **`supabase/migrations/`** — database schema (Supabase/Postgres): patients, doctors, availability, appointments with a no-double-booking constraint, triage chat persistence, row-level security.

## Setup

1. Create a Supabase project and run the SQL files in `supabase/migrations/` (in order) in the SQL Editor.
2. Copy the env templates and fill in your keys:
   - `web/.env.example` → `web/.env.local`
   - `mobile/.env.example` → `mobile/.env`
3. Install and run:

```bash
cd web && npm install && npm run dev        # portal + API on :3000
cd mobile && npm install && npx expo start --web   # patient app on :8081
```

The AI assistant works out of the box with a built-in classifier; set `ANTHROPIC_API_KEY` in `web/.env.local` for full Claude-powered conversation.

## Notes

- The email-only login (`/api/patient/dev-login`) is for local development and is disabled in production builds. The production flow uses Supabase email OTP (add `{{ .Token }}` to the Magic Link email template).
- The assistant gives navigation guidance only — it never provides medical advice or diagnoses, and emergency red flags always route to emergency care.
