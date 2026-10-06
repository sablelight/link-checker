# Link Checker

A scheduled link monitoring service built on Cloudflare Workers. Checks URLs on a cron schedule, stores results in D1 (SQLite), caches in KV, and alerts on failures.

## Features

- **Scheduled checks** via cron trigger (every 5 min by default)
- **REST API** for managing targets and viewing results
- **D1 database** for persistent check history
- **KV caching** for fast reads
- **Discord/Slack webhook alerts** on status mismatches
- **SSL expiry tracking** (HTTPS targets)
- **Redirect chain detection**
- **Per-target configuration** (interval, expected status, timeout)

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Cron       │────▶│  Worker      │────▶│  D1 (SQLite)│
│  Trigger    │     │  (Hono)      │     │  Checks     │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  KV Cache   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Webhook    │
                    │  Alerts     │
                    └─────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Create D1 database and KV namespace (first time)
wrangler d1 create link-checker
wrangler kv:namespace create CACHE
wrangler kv:namespace create CACHE --preview

# Update wrangler.toml with the returned IDs

# Apply schema locally
npm run db:local

# Deploy
npm run deploy

# Set alert webhook (optional)
wrangler secret put ALERT_WEBHOOK
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `check_interval_seconds` | How often to check each target | 300 (5 min) |
| `expected_status` | Expected HTTP status | 200 |
| `timeout_ms` | Request timeout | 10000 |
| `follow_redirects` | Follow redirect chain | true |
| `ALERT_WEBHOOK` | Discord/Slack webhook URL | (optional) |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/targets` | List all targets |
| GET | `/api/targets/:id` | Get target + latest check |
| POST | `/api/targets` | Create target |
| PATCH | `/api/targets/:id` | Update target |
| DELETE | `/api/targets/:id` | Delete target |
| POST | `/api/targets/:id/check` | Manual check trigger |
| GET | `/api/targets/:id/checks` | Check history |

## Target Object

```json
{
  "url": "https://example.com",
  "name": "Example Site",
  "expected_status": 200,
  "timeout_ms": 10000,
  "follow_redirects": true,
  "check_interval_seconds": 300,
  "enabled": true
}
```

## Check Result

```json
{
  "target_id": 1,
  "status_code": 200,
  "response_time_ms": 145,
  "error": null,
  "redirect_chain": null,
  "ssl_expiry": "2025-01-15T00:00:00Z",
  "checked_at": "2024-10-05T12:00:00Z"
}
```

## Deployment

```bash
npm run deploy
```

Sets up:
- Cloudflare Worker with cron trigger
- D1 database (auto-created if needed)
- KV namespace
- Scheduled checks every 5 minutes

## Local Development

```bash
npm run dev
# Opens http://localhost:8787
```

## Cost

All free tier:
- Workers: 100k requests/day
- D1: 5GB storage, 5M reads/day
- KV: 1GB storage, 100k reads/day
- Cron triggers: 100k/day

## License

MIT — see [LICENSE](LICENSE).