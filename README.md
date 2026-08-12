# ☑️ Million Checkboxes

A real-time collaborative web application where users can toggle checkboxes on a grid of **1,000,000 checkboxes**. Changes sync instantly across all connected users via WebSockets.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🚀 Features

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

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML, CSS, JavaScript (ES Modules) |
| **Backend** | Node.js, Express |
| **Real-Time** | Socket.io with Redis Adapter |
| **Database** | Redis (Bitmap for state, Sorted Sets for rate limiting) |
| **Auth** | Google OAuth 2.0, JWT |
| **Containerization** | Docker Compose (Redis) |

---

## 📁 Project Structure

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

## ⚡ How to Run Locally

### Prerequisites

- **Node.js** 18+
- **Docker** (for Redis) or a local Redis server
- **Google OAuth credentials** (see below)

### 1. Clone and install

```bash
git clone https://github.com/gagan-0108/1-million-checkboxes.git
cd 1-million-checkboxes
npm install
```

### 2. Start Redis

```bash
docker compose up -d
```

Or if you have Redis installed locally, just ensure it's running on port 6379.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your Google OAuth credentials (see section below).

### 4. Start the server

```bash
npm run dev
```

Open `http://localhost:7000` in your browser.

---

## 🔑 Environment Variables

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

---

## 🔐 Setting Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth Client ID**
5. Select **Web application**
6. Add Authorized redirect URI: `http://localhost:7000/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env` file

---

## 🗄️ Redis Setup

Redis stores all checkbox states using a **bitmap** data structure:

```
Key: cb:state
Type: String (bitmap)
Size: ~125KB for 1 million bits
```

Each checkbox is a single bit in the bitmap:
- `SETBIT cb:state <index> 1` → Check checkbox
- `GETBIT cb:state <index>` → Read checkbox state
- `BITCOUNT cb:state` → Count total checked

### Why Redis?

- **Bitmaps**: 1M checkboxes in 125KB (vs ~1MB+ for JSON arrays)
- **O(1) operations**: SETBIT/GETBIT are constant time
- **Pub/Sub**: Built-in messaging for multi-server broadcasting
- **Sorted Sets**: Perfect for sliding-window rate limiting
- **Persistence**: AOF ensures state survives restarts

---

## 🔌 Authentication Flow

```
User clicks "Sign In"
    → Redirect to Google OAuth consent screen
    → User grants permission
    → Google redirects to /auth/google/callback with auth code
    → Server exchanges code for access token
    → Server fetches user profile from Google
    → Server generates JWT with user info
    → JWT set as httpOnly cookie
    → User redirected to app (now authenticated)
    → Socket.io connection includes JWT in handshake
    → Server verifies JWT on each socket event
```

- **Authenticated users**: Can toggle checkboxes
- **Anonymous users**: Can view the grid (read-only)

---

## 📡 WebSocket Flow

```
Client connects via Socket.io
    → Server verifies JWT from handshake auth
    → Server tracks connection in connectedUsers map
    → Broadcasts updated online count to all clients

User toggles a checkbox:
    → Client emits "checkbox:toggle" { index, checked }
    → Server validates: auth check → rate limit check → range check
    → Server updates Redis bitmap: SETBIT cb:state <index> <value>
    → Server broadcasts "checkbox:update" to ALL clients
    → Redis adapter handles cross-server broadcasting via Pub/Sub
    → Each client updates its local state and DOM

Client disconnects:
    → Server removes from connectedUsers
    → Broadcasts updated online count
```

---

## 🛡️ Rate Limiting Logic

Custom implementation using **Redis Sorted Sets** (no `express-rate-limit` or similar packages).

### Algorithm: Sliding Window Counter

```
For each request/event:
  1. Key = "rl:{type}:{identifier}" (user ID, IP, or socket ID)
  2. ZREMRANGEBYSCORE key 0 (now - windowMs)    → Remove expired entries
  3. ZADD key now "now:random"                  → Add this request
  4. ZCARD key                                  → Count requests in window
  5. EXPIRE key (windowMs + 1s)                 → Auto-cleanup
  6. If count > maxRequests → REJECT
```

### Limits Applied

| Context | Window | Max Requests | Identifier |
|---------|--------|-------------|------------|
| HTTP API | 60s | 60 | User ID or IP |
| Socket toggle | 10s | 15 | User ID |

### Why Sliding Window?

Fixed windows have boundary issues (a burst at the window edge could allow 2x the limit). Sliding windows are accurate and Redis sorted sets make them efficient.

---

## 📊 Screenshots

> Start the app locally and visit `http://localhost:7000` to see the dark-themed checkbox grid.

---

## 📄 License

MIT
