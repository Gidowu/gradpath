# GradPath — Graduate School Application Tracker

A full-stack web application for tracking graduate school applications.  
Built with React (Vite) + Node.js/Express + MariaDB.

## Authentication Path

**Local Login Path** — users log in with name and email. If the email does not exist, the user is created automatically and logged in. Server-side sessions via `express-session`.

## Project Structure

```
gradpath/
├── client/            # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx    # Main component (login form, user display, logout)
│   │   ├── App.css    # Styles
│   │   └── main.jsx   # Entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/            # Express backend
│   ├── index.js       # Main server (sessions, static serving, /api/me)
│   ├── db.js          # MariaDB connection pool + table init
│   ├── routes/
│   │   └── auth.js    # POST /auth/login and POST /auth/logout
│   ├── .env.example   # Environment variable template
│   └── package.json
├── schema.sql         # Database setup script
├── .gitignore
└── README.md
```

## Architecture

Single-port architecture. The Express server:
- Serves `/api/*` and `/auth/*` backend routes
- Serves the built React frontend from `client/dist`
- Returns `index.html` for all other routes (SPA fallback)

There is **NO separate frontend dev server**. The frontend is built once with `npm run build` and served as static files by Express.

## Install Steps

```bash
# Install client dependencies and build
cd client && npm install && npm run build

# Install server dependencies
cd ../server && npm install
```

## Database Setup

Make sure MariaDB is running, then:

```bash
mysql -u root -p < schema.sql
```

## Environment Setup

```bash
cp server/.env.example server/.env
# Edit server/.env with your DB password and preferred port
```

## Run Steps (server only)

```bash
cd server
npm start
```

## Server URL

`http://localhost:4100` (or whatever port you set in `.env`)

## Environment File Required

`server/.env` — see `server/.env.example` for the template.

## API Routes

| Method | Path         | Purpose                                   |
|--------|--------------|-------------------------------------------|
| POST   | /auth/login  | Log in with name and email                |
| POST   | /auth/logout | Destroy session and log out               |
| GET    | /api/me      | Return current logged-in user from session|
| GET    | /api/hello   | Basic test route                          |
| GET    | /api/status  | Server and database connection status     |

## How Sessions Work

1. User enters name and email in the login form
2. Frontend sends `POST /auth/login` with JSON body
3. Backend finds or creates the user in MariaDB
4. Backend stores `userId` in the server-side session (`req.session.userId`)
5. Express sets a `connect.sid` cookie on the browser
6. On every subsequent request, Express reads the cookie and restores the session
7. `GET /api/me` reads `req.session.userId`, queries the DB, and returns the user
8. Refreshing the page re-checks `/api/me` — login state persists
9. `POST /auth/logout` destroys the session and clears the cookie
