# AU Device Assignee

A glassmorphism device-assignment app for React Native teams who share Android and iOS testing devices each morning. The visual palette follows AU Small Finance Bank's published brand direction: orange for optimism/warmth and purple for innovation/premium quality.

## Features

- Admins can add people and Android/iOS testing devices.
- Devices are listed with an assignee dropdown and an **Assign** action.
- After assignment, the action changes to **Submit** to record completion/return.
- Assignment and submission timestamps are stored and shown in the dashboard.
- Viewer mode is read-only; backend mutations require an admin token.
- Frontend uses Next.js; backend uses a Node.js HTTP API with a JSON data store for simple hosting.

## Local development

```bash
npm install
npm run dev
```

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:4000>

## Environment variables

### Backend

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | CORS origin |
| `ADMIN_TOKEN` | `au-admin-demo` | Token required for admin writes |
| `DB_PATH` | `backend/data/db.json` | JSON persistence path |

### Frontend

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend API base URL |
| `NEXT_PUBLIC_ADMIN_TOKEN` | `au-admin-demo` | Demo admin token sent for writes |

## Hosting

A practical production setup is:

1. Deploy `backend` to a Node.js host such as Render, Railway, Fly.io, or an internal VM.
2. Set `ADMIN_TOKEN` to a strong secret and `FRONTEND_ORIGIN` to the deployed frontend URL.
3. Deploy `frontend` to Vercel or any Next.js-compatible host.
4. Set `NEXT_PUBLIC_API_URL` to the live backend URL. For a real internal deployment, replace the demo public admin token with SSO/session-based authentication.
