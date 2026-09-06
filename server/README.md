# Scroller Backend

Express + MongoDB + JWT + OTP backend.

## Vercel

The `api/[...path].js` function exposes the REST API without running `node src/server.js` yourself.

Required Vercel environment variables:

```env
NODE_ENV=production
MONGO_URI=...
JWT_SECRET=...
JWT_EXPIRES_IN=1d
CLIENT_URL=https://YOUR-FRONTEND.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=...
```

Cloudinary variables are included in `.env.example` for future media features.

## Important

Vercel Functions are request-based, so Socket.IO cannot be relied on as a persistent production transport. The frontend therefore sends messages through REST and polls messages every 2.5 seconds. The original Socket.IO server is still kept for local/non-serverless deployments.

## Local

```bash
npm install
npm run dev
```
