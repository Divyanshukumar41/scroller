# Scroller deployment package

## Important architecture

The React frontend is Vercel-ready. The Express + Socket.IO backend should run on a persistent Node host such as Render/Railway/etc. Do not deploy the Socket.IO server as a normal Vercel serverless function: WebSocket connections are not persistent there.

## Vercel frontend

1. Import the `client` folder as the Vercel project root.
2. Framework: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. No frontend `.env` is required for REST API because `client/vercel.json` proxies `/api/*` to `https://scrollerbackend.vercel.app/api/*`.
6. Set `VITE_SOCKET_URL` in Vercel to the URL of the persistent Socket.IO backend.

## Backend

Deploy the `server` folder to a persistent Node service.

Required variables:
- MONGO_URI
- JWT_SECRET
- JWT_EXPIRES_IN
- CLIENT_URL (your Vercel frontend URL)
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- MAIL_FROM

The backend must expose `/health`, `/api/auth/*`, `/api/users`, `/api/conversations`, and `/api/messages/*`, plus Socket.IO.
