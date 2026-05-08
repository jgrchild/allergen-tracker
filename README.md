# Family Allergen Exposure Tracker

A simple local-first web app for tracking a family allergist food exposure plan.

The app is intentionally a tracking tool only. It does not diagnose allergies,
recommend new foods, suggest challenges, or replace allergist/pediatrician
guidance.

## Features

- Create and edit allergen foods with status, weekly target, allergist notes,
  safe forms, and serving examples.
- Weekly Monday-Sunday dashboard for active exposure foods.
- Clear avoid/paused “Do not give” warnings.
- Exposure logging with reaction flags and emergency-plan reminder text.
- Caregiver handoff view with printable summary.
- History filters by allergen, date range, and reaction status.
- Local storage persistence with typed data boundaries for future database work.

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Local storage

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Free Phone Sharing Setup

The lowest-cost hosted setup is:

- Vercel free tier for hosting
- Supabase free tier for login and shared data

This first cloud version uses one shared family magic-link login. Both phones can
sign in with the same family email and see the same tracker data.

### 1. Create Supabase Project

1. Go to Supabase and create a free project.
2. Open the SQL Editor.
3. Run the SQL in `supabase-schema.sql`.
4. In Project Settings, copy:
   - Project URL
   - Publishable key

### 2. Configure Local Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Restart the app:

```bash
npm run dev
```

Open Settings, enter the family email, and use the magic link to sign in.

### 3. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. Import the repository in Vercel.
3. Add the same two Supabase environment variables in Vercel Project Settings.
4. Deploy.
5. Open the deployed URL on each phone and use “Add to Home Screen.”

In Supabase Auth settings, add the Vercel URL to the allowed redirect URLs so
magic links return to the app.

## Verification

```bash
npm run build
```

## Future TODOs

- Authentication
- Shared caregiver access
- Doctor export PDF
- Reminders
- Database persistence
- Photo attachments
