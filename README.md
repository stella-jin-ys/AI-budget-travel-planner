# AI Budget Travel Planner

AI Budget Travel Planner creates a budget- and preference-based travel plan for solo travellers, students, families, and groups.

The planner combines transport, accommodation, activities, local travel, food, warnings, and budget calculations in one workspace. The current guided flow builds a clearly labelled personalized preview from the submitted brief without making an AI request; the server-side Next.js AI route remains available for the live provider integration.

## Live deployments

- [Vercel live app](https://ai-budget-travel-planner-stella.vercel.app/) — personalized preview planning.
- [GitHub Pages build](https://stella-jin-ys.github.io/AI-budget-travel-planner/) — static Pages deployment.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

- `GEMINI_API_KEY` enables Gemini planning. `GEMINI_MODEL` is optional.
- `OPENROUTER_API_KEY` enables OpenRouter; `OPENROUTER_MODEL` must be a valid OpenRouter model slug, such as a currently available `:free` model. The app does not use the invalid generic `openrouter/free` slug.
- `AI_PROVIDER` selects `gemini` or `openrouter` when both keys are configured.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` enable server-side trip-plan persistence.

Keep `.env.local` and all real keys out of Git. Add the same variables to the Vercel project environment settings for production.

## Validation

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The repository root is the Next.js project root. Vercel uses the default root directory and `.github/workflows/pages.yml` builds the GitHub Pages export.
