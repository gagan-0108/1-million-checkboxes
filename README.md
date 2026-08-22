# Million Checkboxes

A real-time collaborative web application where users can toggle checkboxes on a grid of **1,000,000 checkboxes**. Changes sync instantly across all connected users via WebSockets.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## Features

- **1 Million Checkboxes** — A grid of 1,000,000 interactive checkboxes
- **Real-Time Sync** — Toggle a checkbox and see it update for all connected users instantly
- **Virtual Scrolling** — Only renders visible rows (~50 at a time) for smooth performance
- **Redis Bitmap Storage** — All 1M checkbox states stored in just ~125KB using `SETBIT`/`GETBIT`
- **Google OAuth 2.0** — Secure authentication; only logged-in users can toggle
- **Custom Rate Limiting** — Sliding window rate limiter using Redis sorted sets (no external packages)
- **Redis Pub/Sub** — Multi-server broadcasting via `@socket.io/redis-adapter`
- **Dark Theme** — Pure black UI with neon cyan accents
- **Live Stats** — Real-time display of total checked, online users, and progress percentage
- **Anonymous Viewing** — Unauthenticated users can view the grid in read-only mode

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML, CSS, JavaScript (ES Modules) |
| **Backend** | Node.js, Express |
| **Real-Time** | Socket.io with Redis Adapter |
| **Database** | Redis (Bitmap for state, Sorted Sets for rate limiting) |
| **Auth** | Google OAuth 2.0, JWT |
| **Containerization** | Docker Compose (Redis) |

---

## Project Structure

```
million-checkboxes/
├── server/
│   ├── index.js                  # Express app entry point
│   ├── config/
│   │   └── redis.js              # Redis client factory (main, pub, sub)
│   ├── auth/
│   │   ├── googleOAuth.js        # Google OAuth 2.0 flow + JWT
│   │   └── authMiddleware.js     # HTTP & Socket auth middleware
│   ├── middleware/
│   │   └── rateLimiter.js        # Custom sliding-window rate limiter
│   ├── routes/
│   │   ├── authRoutes.js         # /auth/google, /auth/me, /auth/logout
│   │   └── checkboxRoutes.js     # /api/checkboxes, /api/stats
│   ├── services/
│   │   └── checkboxService.js    # Redis bitmap operations
│   └── socket/
│       └── socketHandler.js      # Socket.io event handlers
├── public/
│   ├── index.html                # Main page
│   ├── css/
│   │   └── style.css             # Dark theme styles
│   └── js/
│       ├── app.js                # App orchestrator
│       ├── grid.js               # Virtual-scroll engine
│       └── socket.js             # Socket.io client wrapper
├── docker-compose.yml            # Redis service
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---


## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 7000) | No |
| `REDIS_HOST` | Redis host (default: localhost) | No |
| `REDIS_PORT` | Redis port (default: 6379) | No |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | Yes |
| `JWT_SECRET` | Secret for signing JWTs | Yes |
| `JWT_EXPIRES_IN` | JWT expiration (default: 7d) | No |
| `CLIENT_URL` | Frontend URL (default: http://localhost:7000) | No |
| `CHECKBOX_COUNT` | Total checkboxes (default: 1000000) | No |


## 📄 License

MIT
