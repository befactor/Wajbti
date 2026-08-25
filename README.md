# Wajbti (وجبتي)

AI nutrition assistant specialized in Arabic and Middle Eastern cuisine — meal
analysis (photo/voice/text), hidden-fat detection, a correction feedback loop
that builds cuisine-specific memory over time, BMR/TDEE/BMI with weight-trend
tracking, a MyFitnessPal-style diary (with a Ramadan suhoor/iftar mode),
AI-generated meal plans, a water reminder, and a personal nutritionist chat.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Anthropic API** (`@anthropic-ai/sdk`, model `claude-sonnet-4-6`) for meal
  analysis and meal-plan generation
- **Prisma** + **PostgreSQL** (Supabase in production)
- **NextAuth.js**: Google, Email/password, Apple (gated behind env vars —
  Apple's Developer account is still being set up)
- Deployed on **Vercel**

## What's implemented

- Meal analysis by photo, voice (browser speech-to-text), or text
  description, with hidden-fat detection and, for text-only input, a
  "standard portion" breakdown in household measures (never raw grams
  presented as an observation — see design principles below)
- Dining-out mode: a toggle that tells the analyzer this meal wasn't cooked
  at home (restaurant/buffet/gathering), widening its estimate margin and
  flagging the result as rougher than a home-meal estimate
- Correction feedback loop: users can only confirm/correct the **food name**,
  never numbers; corrections are persisted and retrieved (simple text-match
  RAG) to ground future analyses
- Auth: Google, Email/password, Apple (once credentials exist)
- Profile page: BMR (Mifflin-St Jeor), TDEE (activity factor), BMI + daily
  calorie/water targets, a Ramadan-mode toggle, and weight-trend tracking
  (logging a new weight auto-recomputes BMR/TDEE/targets)
- Diary: date-navigable, calories-remaining ring, meals grouped by
  breakfast/lunch/dinner/snack (or suhoor/iftar in Ramadan mode), adaptive
  "go lighter next meal" / "you hit your goal" nudges, a logging-streak
  badge, and a best-effort "you haven't logged today" notification
- Smart meal planning: AI-generated 1-7 day plans of Arabic/local dishes
  sized to the user's TDEE and goal (safe 300-500 kcal deficit/surplus),
  restructured to a suhoor/iftar plan in Ramadan mode
- Water reminder: daily target from weight/activity, quick-log + undo,
  configurable schedule (including an overnight window for Ramadan),
  best-effort in-tab browser notifications (full background push needs the
  future Capacitor mobile app)
- Personal nutritionist chat: a persisted, ongoing conversation personalized
  with the user's profile/TDEE/goal and today's diary totals, bound by the
  same medical-disclaimer rule as the analyzer (no precise numbers for
  sensitive conditions; no detailed workout programming — out of scope)
- Image upload UI (camera on mobile, file picker on desktop)
- Arabic (RTL) / English (LTR) with instant toggle

## Design principles (read before changing the analysis flow)

1. **Users never correct numbers.** Calories/weights are the system's job,
   always. The only thing a user confirms is whether the food name is right.
2. **Photo vs. text input are different epistemically.** A photo shows the
   actual quantity, so the AI estimates weight directly from it. Text alone
   doesn't show quantity, so the response must be explicit that it's a
   *standard assumed portion* (shown in household measures: spoon, cup,
   piece — not just grams) so the user can compare it against their real
   meal by eye.

Both are enforced in `lib/systemPrompt.ts` and rendered accordingly in the UI
— don't reintroduce a "confirm the weight" flow or silently drop the portion
disclaimer.

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY, DATABASE_URL, NEXTAUTH_SECRET (see below)
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000

### Environment variables

See `.env.example` for the full list. Notes:

- **ANTHROPIC_API_KEY** — required for meal analysis and meal planning.
- **DATABASE_URL** — any Postgres instance works locally
  (`postgresql://user:pass@localhost:5432/wajbti_dev?schema=public`). In
  production, use Supabase's connection string.
- **NEXTAUTH_SECRET** — generate with `openssl rand -base64 32`.
- **NEXTAUTH_URL** — `http://localhost:3000` locally, the deployed URL in
  production.
- **GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET** — optional. Until set, the
  Google sign-in button renders disabled and the app still builds/runs.
- **APPLE_CLIENT_ID / APPLE_CLIENT_SECRET** — optional, same behavior.
  Requires an active Apple Developer account (in progress).

### Database commands

```bash
npm run db:migrate   # prisma migrate dev — create/apply a migration locally
npm run db:studio    # prisma studio — browse the local database
```

`prisma generate` runs automatically on `npm install` (via `postinstall`).

## Deploying (Vercel + Supabase)

1. **Supabase**: create a project, then grab two connection strings from
   Project Settings → Database:
   - The **pooled** connection (port 6543, `pgbouncer=true`) → use this as
     `DATABASE_URL` in Vercel (serverless functions need pooling).
   - The **direct** connection (port 5432) → use this locally, or as
     `DIRECT_URL` if you later split migration vs. runtime connections.
2. Run `npx prisma migrate deploy` against the direct connection once
   (locally, with `DATABASE_URL` pointed at it) to apply the schema.
3. **Vercel**: New Project → import the `befactor/Wajbti` repo → Framework
   Preset: **Next.js**.
4. Add all the environment variables from `.env.example` in Vercel's project
   settings (Production + Preview). Set `NEXTAUTH_URL` to the deployed URL.
5. Deploy. `prisma generate` runs automatically via `postinstall`.

Currently live at `wajbti-kohl.vercel.app`.

## Project structure

```
app/
  page.tsx              # home: analyze a meal (photo/voice/text), add to diary
  diary/page.tsx         # MyFitnessPal-style daily log (+ Ramadan slots, streak)
  chat/page.tsx           # personal nutritionist chat
  plan/page.tsx            # AI-generated meal plan
  profile/page.tsx         # BMR/TDEE/BMI form + weight trend chart
  water/page.tsx            # water tracking + reminders
  auth/{signin,register}/  # NextAuth pages
  api/
    analyze/               # meal analysis (Claude)
    chat/                   # nutritionist chat (Claude, persisted history)
    meal-plan/               # meal plan generation (Claude)
    meals/                    # diary CRUD
    weight/                    # weight log CRUD + profile auto-recompute
    water/                      # water log + settings CRUD
    profile/                     # BMR/TDEE/BMI compute + persist
    stats/streak/                 # consecutive-day logging streak
    feedback/                      # correction feedback (food name only)
    auth/                           # NextAuth + email/password register
lib/
  systemPrompt.ts   # WAJBTI_SYSTEM_PROMPT + MEAL_PLAN_SYSTEM_PROMPT + NUTRITIONIST_CHAT_SYSTEM_PROMPT
  nutrition.ts      # BMR/TDEE/BMI/water-target math, adaptive diary nudge
  corrections.ts    # correction RAG (retrieve + save)
  auth.ts           # NextAuth config
  prisma.ts         # Prisma client singleton
  i18n.ts           # ar/en dictionary
  date.ts           # local-day helpers, streak computation
prisma/schema.prisma
```

## Not yet built

- Broader statistics/progress dashboard (beyond the weight trend chart)
- Detailed workout/gym programming (explicitly out of scope for the chat and
  analyzer for now — see `NUTRITIONIST_CHAT_SYSTEM_PROMPT`)
- Paid subscription tier
- Capacitor wrapper for native iOS/Android (camera/mic already work via the
  browser; real background push notifications need this step)

## Important notes

- Never commit `ANTHROPIC_API_KEY` or any other secret — they live only in
  `.env.local` (gitignored) and in Vercel's environment variables.
- Medical disclaimer: sensitive health conditions (diabetes, blood pressure,
  eating disorders) never get precise therapeutic numbers from the AI — see
  `medical_disclaimer_flag` in the analysis response and the corresponding
  rule in `lib/systemPrompt.ts`.
