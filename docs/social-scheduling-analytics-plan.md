# Social Integration + Scheduling + Analytics Plan

## Social Media Account Integration

### API requirements summary (major platforms)
- LinkedIn: OAuth 2.0, publishing scopes (for example `w_member_social`), account/member URN mapping for publish endpoints.
- Meta (Facebook + Instagram): OAuth 2.0 via Facebook Login, Page/IG business linkage, app review required for sensitive permissions.
- X: OAuth 2.0 + paid/credit-based API usage; enforce budget controls before enabling production publishing.
- Pinterest: OAuth 2.0, board/pin scopes, board target required for publishing.
- YouTube: OAuth 2.0 with upload scope, quota-based API consumption.
- TikTok: OAuth 2.0, publishing capabilities depend on app status and audit approval.

### OAuth flow (implemented foundation)
1. `GET /api/social/connect?platform=<platform>&userId=<userId>`
2. App builds authorize URL + signed `state`
3. Provider redirects to `GET /api/social/callback?code=...&state=...`
4. Callback validates state and stores account + encrypted tokens

### Account connection system
- Connected account metadata in `social_accounts`
- Token material isolated in `social_account_tokens`
- Status model: `connected`, `disconnected`, `error`

### Secure token storage
- AES-256-GCM encryption at rest for access/refresh tokens
- Encryption key via `SOCIAL_TOKEN_ENCRYPTION_KEY`
- OAuth state HMAC signing via `SOCIAL_OAUTH_STATE_SECRET`

## Scheduling System

### Workflow
1. User selects post + connected accounts + time
2. App creates one publish job per platform/account target
3. Worker/queue processes due jobs and updates status

### Queue/job model
- Statuses: `queued`, `processing`, `published`, `failed`, `cancelled`
- Retries with capped `retry_count`
- Persistent `last_error` for diagnostics

### Time/date UI logic
- Convert local date/time selection to UTC ISO before persistence
- Enforce minimum future offset (>= 1 minute)

## Analytics Framework

### Canonical metrics
- impressions
- engagement
- clicks
- likes
- comments
- shares

### Ingestion endpoints
- `POST /api/analytics` (store normalized snapshot)
- `POST /api/analytics/ingest` (future webhook/provider fan-in)
- `GET /api/analytics?userId=<userId>` (aggregated summary)

### Dashboard reporting
- Added top-level analytics cards for impressions/engagement/clicks/snapshot count
- Keep aggregated read model separate from raw provider payloads

## Testing & Stability

### Pipeline validations
- Encryption/decryption round-trip
- OAuth state integrity and expiry behavior
- Schedule time guardrails and UTC conversion

### Modularity checks
- Provider concerns isolated in `/lib/social/*`
- Scheduling concerns isolated in `/lib/scheduling/*`
- Analytics concerns isolated in `/lib/analytics/*`

### Bottleneck focus before publishing rollout
- Token refresh contention
- Queue depth growth under burst scheduling
- Analytics fan-in spikes from periodic sync jobs
