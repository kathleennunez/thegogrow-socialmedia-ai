This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Multi-model AI text setup (Claude or Gemini/free via OpenRouter)

If you want one place with many models (Gemini, free routes, and more), use OpenRouter:

```env
# Keep Claude if you still want it as an option
# CLAUDE_API_KEY=your_claude_key

# OpenRouter (model hub)
OPENROUTER_API_KEY=your_openrouter_key
# Optional defaults
# OPENROUTER_MODEL=openrouter/free
# OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions
```

Then go to **Settings > Tone & Voice** and set:
- **AI Text Provider**: `Claude` or `OpenRouter (Gemini + Free Models)`
- **Model ID**: e.g. `openrouter/free` or a specific OpenRouter model id

### OpenRouter image generation (optional)

AI Studio can also generate graphics through OpenRouter.

```env
# Optional image model override (defaults to openrouter/free)
OPENROUTER_IMAGE_MODEL=openrouter/free
```

## Nanobanana setup (optional)

To generate visuals through Nanobanana, add these env vars:

```env
NANOBANANA_API_KEY=your_api_key
# Optional overrides
# NANOBANANA_API_BASE=https://api.nanobanana.ai/v1
# NANOBANANA_GENERATE_URL=https://api.nanobanana.ai/v1/images/generations
# NANOBANANA_STATUS_URL=https://api.nanobanana.ai/v1/images/generations/{id}
# NANOBANANA_MODEL=nanobanana-image-1
# NANOBANANA_IMAGE_SIZE=1024x1024
```

Then in **Settings > Brand Kit**, switch **Image Generation Provider** to **Nanobanana**.

## Social OAuth + Scheduling foundation

This repo now includes provider-agnostic social account and scheduling API scaffolding:

- `GET /api/social/connect?platform=<platform>&userId=<userId>`
- `GET /api/social/callback?code=<code>&state=<state>`
- `GET /api/social/accounts?userId=<userId>`
- `POST /api/social/refresh`
- `POST /api/schedules`
- `GET /api/schedules?userId=<userId>`
- `POST /api/worker/publish`
- `POST /api/analytics`
- `GET /api/analytics?userId=<userId>`
- `POST /api/analytics/linkedin/pull`

Set these env vars in `.env.local`:

```env
DATABASE_URL=postgres://...
# Optional; defaults to ssl enabled for hosted Postgres
# DATABASE_SSL=disable

SOCIAL_OAUTH_STATE_SECRET=replace_with_long_random_secret
SOCIAL_TOKEN_ENCRYPTION_KEY=replace_with_long_random_secret
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
CRON_SECRET=replace_with_long_random_secret
```

Optional provider credentials (used by `/api/social/connect` metadata):
`LINKEDIN_CLIENT_ID`, `X_CLIENT_ID`, `META_CLIENT_ID`, `PINTEREST_CLIENT_ID`, `YOUTUBE_CLIENT_ID`, `TIKTOK_CLIENT_ID`.

## Stability checks

Run:

```bash
npm run test:stability
npm run test:production
```

## Cron automation (Vercel)

`vercel.json` includes:
- `/api/worker/publish` every 5 minutes
- `/api/social/refresh` every 10 minutes
- `/api/analytics/linkedin/pull` daily at 01:00 UTC

When `CRON_SECRET` is set, these routes require:

`Authorization: Bearer <CRON_SECRET>`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
