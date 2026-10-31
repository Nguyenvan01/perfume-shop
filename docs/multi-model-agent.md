# Multi-model Agent MVP

The backend can ask multiple configured model providers to answer one task concurrently. It is deliberately a text-only, no-tools worker: a model cannot make changes to the repository, database, or external services through this endpoint.

## Configuration

Copy the agent variables from `backend/.env.example` into `backend/.env`. A provider is enabled only when both its key and its model name are set. `AGENT_GEMINI_MODEL` may be written with or without the `models/` prefix.

```env
AGENT_OPENAI_API_KEY=...
AGENT_OPENAI_MODEL=...
AGENT_ANTHROPIC_API_KEY=...
AGENT_ANTHROPIC_MODEL=...
AGENT_GEMINI_API_KEY=...
AGENT_GEMINI_MODEL=...
```

Keys must remain on the server. Do not put them in the frontend environment or send them in a request body.

## Endpoints

Both endpoints require an `ADMIN` access token because a run can consume paid provider credits.

```http
GET /api/v1/agents/models
```

Returns each supported provider and whether it is configured. It never returns an API key.

```http
POST /api/v1/agents/runs
Content-Type: application/json
Authorization: Bearer <admin access token>

{
  "task": "Compare the checkout approaches and recommend one.",
  "providers": ["openai", "anthropic", "gemini"],
  "timeout_ms": 45000
}
```

At least two distinct providers are required. Their requests start in parallel; one failure or timeout is returned as a per-provider result and does not cancel the rest.

`timeout_ms` is optional (1000–120000, default 45000) and applies to each provider separately. The deadline is enforced by the server even if a provider never responds; that provider is reported as `timed_out`.

Provider errors are returned as short generic messages (for example `Provider request failed (500)`); upstream error bodies and internal error text are never passed through.

## Spend limits

- **Rate limit:** `POST /agents/runs` allows 5 runs per minute per admin user (keyed by user id, not IP). Further requests get `429`. `GET /agents/models` is not limited beyond the global API limit. Limiters are disabled under `NODE_ENV=test`.
- **Output token cap:** every provider request is capped at 2048 output tokens (OpenAI `max_output_tokens`, Anthropic `max_tokens`, Gemini `generationConfig.maxOutputTokens`). For reasoning/thinking models this budget includes reasoning tokens, so a response that hits the cap may come back incomplete; OpenAI `incomplete` responses are reported as `failed`.

Both values live in `backend/src/modules/agents/agent.constant.js`.

## Current scope

This is a synchronous MVP suited to short text tasks. It returns the raw responses so an admin can compare them. Long-running orchestration, worktree isolation for coding workers, persistence, budget tracking, and a judge/merge step should be added as a queued `AgentRun` implementation before allowing models to write code or invoke tools.
