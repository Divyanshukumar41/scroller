# Scroller Secure Backend

Express + MongoDB + Socket.IO backend with:
- bcrypt password hashing
- email OTP for signup verification
- OTP on every login (2-step authentication)
- OTP hashes stored instead of plaintext codes
- 10-minute OTP expiry + 5 verification attempts
- OTP resend rate limiting
- Helmet, CORS and API rate limiting
- JWT authentication for REST and Socket.IO
- private conversation authorization
- real-time messages and typing indicators

## Setup

```bash
npm install
cp .env.example .env
```

Fill `MONGO_URI`, `JWT_SECRET`, `CLIENT_URL`, and SMTP settings.

For development, if SMTP is empty, the OTP is printed in the backend terminal. In production, configure SMTP; the server refuses to silently expose OTPs there.

Run:

```bash
npm run dev
```

Frontend expects:
- POST `/api/auth/signup`
- POST `/api/auth/signup/verify-otp`
- POST `/api/auth/login`
- POST `/api/auth/login/verify-otp`
- POST `/api/auth/otp/resend`
- GET `/api/users`
- POST `/api/conversations`
- GET `/api/messages/:conversationId`

Socket events:
`conversation:join`, `message:send`, `message:new`, `typing:start`, `typing:stop`, `user:online`, `user:offline`.
