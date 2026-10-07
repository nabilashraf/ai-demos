# NovaDesk Integrations

## Native connectors

- **Slack** — board notifications and Doc share links
- **Google Drive** — import Docs; export final PDFs
- **Zapier** — 50+ triggers for CRM Light events

## API

NovaDesk exposes a REST API under `/v1`. Rate limits:

- Starter: 60 requests/minute
- Pro: 300 requests/minute
- Business: 1,000 requests/minute

API keys are scoped per workspace. Write endpoints require an Admin role.
Webhooks deliver `deal.updated`, `task.completed`, and `doc.published` events.
