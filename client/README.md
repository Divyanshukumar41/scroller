# Scroller Frontend

React + Vite + Tailwind chat frontend.

## Production on Vercel

Set these Vercel environment variables:

```env
VITE_API_URL=https://YOUR-BACKEND.vercel.app/api
VITE_SOCKET_URL=https://YOUR-BACKEND.vercel.app
```

The production chat uses REST APIs + polling, so it works when the backend is deployed as a Vercel Function and no Node server is running locally. Socket.IO remains available for local/non-serverless deployments.

## Local

```bash
npm install
npm run dev
```
