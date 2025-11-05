Backend (Node.js + Express + TypeScript)

Setup

1) Create a .env file with:

```
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/quild_ai
JWT_ACCESS_SECRET=replace-with-strong-secret
JWT_REFRESH_SECRET=replace-with-strong-secret
CLIENT_ORIGIN=http://localhost:5173
GEMINI_API_KEY=replace-with-google-gemini-key
```

2) Install dependencies and run:

```
npm install
npm run dev
```

API Summary

- GET /health
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- GET /api/conversations
- POST /api/conversations
- GET /api/conversations/:id/messages?page=1&pageSize=50
- DELETE /api/conversations/:id
- PATCH /api/conversations/:id/title
- POST /api/ai/stream  body: { conversationId?: string, message: string }

Notes

- Auth uses httpOnly cookies for access and refresh tokens.
- AI responses stream via Server-Sent Events (SSE) with events: { type: 'delta' | 'done' }.


