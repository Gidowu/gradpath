# GradPath

A full-stack web application for tracking graduate school applications. Built for SCMP 118 at Kenyon College.

GradPath helps students organize their grad school journey by tracking applications, deadlines, and statuses across multiple programs. It includes role-based access (student/advisor/admin), an advisor comment system, a CI/CD pipeline, and automated deployment.

## Tech Stack

- **Frontend:** React (Vite) + Bootstrap 5
- **Backend:** Node.js + Express
- **Database:** MariaDB (mysql2)
- **Auth:** express-session (server-side sessions)
- **Process Manager:** PM2
- **CI/CD:** GitHub Actions (self-hosted runner)

## Live App

- **URL:** http://10.192.145.179:4151
- **Server:** Kenyon Linux server (10.192.145.179)

## Installation

### Prerequisites

- Node.js 20+
- MariaDB (or MySQL)
- PM2 (`npm install -g pm2`)

### Setup

1. Clone the repository:

```bash
git clone https://github.com/Gidowu/gradpath.git
cd gradpath
```

2. Install dependencies:

```bash
npm install
cd client && npm install
cd ../server && npm install
cd ..
```

3. Create the database and configure environment:

```sql
CREATE DATABASE gradpath;
```

Create `.env` in the project root (`~/gradpath/.env`):

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=gradpath
SESSION_SECRET=your-secret-key
PORT=4151
```

4. The application automatically creates all required tables on first startup.

5. Build the frontend and start the server:

```bash
cd client && npm run build && cd ..
pm2 start server/index.js --name gradpath
pm2 save
```

The app will be available at `http://localhost:4151`.

## Usage

1. **Sign Up** — Create an account with your name, email, and password.
2. **Add Applications** — Click "Add Application" to track a new grad school program. Fill in the school name, program, degree type, fit level, deadlines, and notes.
3. **Manage Status** — Update application status (Researching, Applied, Accepted, Rejected, Waitlisted) directly from the dashboard.
4. **Track Deadlines** — Switch to the Deadlines tab to add task-level deadlines linked to specific applications. Deadlines are color-coded by urgency (red = overdue, yellow = due soon, green = completed).
5. **Admin View** — Admin users can see all applications and deadlines across all users.
6. **Advisor View** — Advisor users see a student roster of assigned students. Click any student to view their applications and deadlines read-only, and post feedback comments.
7. **Assign Advisors** — Admins can open the "Manage Users" tab to assign an advisor to each student via dropdown.

## Architecture

Single-port architecture. The Express server:
- Serves `/api/*` and `/auth/*` backend routes
- Serves the built React frontend from `client/dist`
- Returns `index.html` for all other routes (SPA fallback)

There is no separate frontend dev server in production. The frontend is built once with `npm run build` and served as static files by Express.

## Database Schema

The application uses four tables:

### users

| Column       | Type                            | Description              |
|--------------|--------------------------------|--------------------------|
| id           | INT AUTO_INCREMENT PRIMARY KEY | Unique user ID           |
| name         | VARCHAR(255)                   | Full name                |
| email        | VARCHAR(255) UNIQUE            | Email address            |
| password_hash| VARCHAR(255)                   | SHA-256 hashed password  |
| role         | ENUM('student','advisor','admin') | User role (default: student) |
| advisor_id   | INT (FK → users.id)            | Assigned advisor (students only) |
| created_at   | TIMESTAMP                      | Account creation time    |
| updated_at   | TIMESTAMP                      | Last update time         |

### gradpath_applications

| Column        | Type                            | Description              |
|---------------|--------------------------------|--------------------------|
| id            | INT AUTO_INCREMENT PRIMARY KEY | Unique application ID    |
| user_id       | INT (FK → users.id)            | Owner of the application |
| school_name   | VARCHAR(255)                   | University name          |
| program_name  | VARCHAR(255)                   | Program name             |
| program_type  | ENUM('MS','PhD','MBA','Other') | Degree type              |
| fit_level     | ENUM('Safety','Match','Reach') | How well the school fits |
| status        | ENUM('Researching','Applied','Accepted','Rejected','Waitlisted') | Current status |
| app_deadline  | DATE                           | Application deadline     |
| decision_date | DATE                           | Expected decision date   |
| notes         | TEXT                           | Free-form notes          |
| created_at    | TIMESTAMP                      | Record creation time     |
| updated_at    | TIMESTAMP                      | Last update time         |

### gradpath_deadlines

| Column         | Type                            | Description              |
|----------------|--------------------------------|--------------------------|
| id             | INT AUTO_INCREMENT PRIMARY KEY | Unique deadline ID       |
| application_id | INT (FK → gradpath_applications.id) | Linked application (CASCADE delete) |
| title          | VARCHAR(255)                   | Deadline task name       |
| due_date       | DATE                           | When it's due            |
| reminder_date  | DATE                           | Optional reminder date   |
| is_completed   | TINYINT(1)                     | Completion status (0/1)  |
| notes          | TEXT                           | Optional notes           |
| created_at     | TIMESTAMP                      | Record creation time     |
| updated_at     | TIMESTAMP                      | Last update time         |

### gradpath_comments

| Column         | Type                            | Description              |
|----------------|--------------------------------|--------------------------|
| id             | INT AUTO_INCREMENT PRIMARY KEY | Unique comment ID        |
| application_id | INT (FK → gradpath_applications.id) | Linked application (CASCADE delete) |
| user_id        | INT (FK → users.id)            | Comment author           |
| content        | TEXT                           | Comment text             |
| created_at     | TIMESTAMP                      | When comment was posted  |

## API Documentation

All API responses follow the format: `{ ok: true/false, data: {...}, error: "...", details: [...] }`

### Authentication

| Method | Endpoint         | Description         | Auth Required |
|--------|-----------------|---------------------|---------------|
| POST   | /auth/register   | Create new account  | No            |
| POST   | /auth/login      | Sign in             | No            |
| POST   | /auth/logout     | Sign out            | Yes           |
| GET    | /api/me          | Get current user    | Yes           |

### Applications

| Method | Endpoint                        | Description              | Auth Required |
|--------|--------------------------------|--------------------------|---------------|
| GET    | /api/applications              | List applications        | Yes           |
| POST   | /api/applications              | Create application       | Yes           |
| PUT    | /api/applications/:id          | Update application       | Yes           |
| PUT    | /api/applications/:id/status   | Quick status update      | Yes           |
| DELETE | /api/applications/:id          | Delete application       | Yes           |

### Deadlines

| Method | Endpoint                        | Description              | Auth Required |
|--------|--------------------------------|--------------------------|---------------|
| GET    | /api/deadlines                 | List deadlines           | Yes           |
| POST   | /api/deadlines                 | Create deadline          | Yes           |
| PUT    | /api/deadlines/:id             | Update deadline          | Yes           |
| PUT    | /api/deadlines/:id/complete    | Toggle completion        | Yes           |
| DELETE | /api/deadlines/:id             | Delete deadline          | Yes           |

### Comments (Advisor Feedback)

| Method | Endpoint                   | Description                             | Auth Required | Role           |
|--------|---------------------------|-----------------------------------------|---------------|----------------|
| GET    | /api/comments/:applicationId | Get comments for an application      | Yes           | Any            |
| POST   | /api/comments             | Post a comment on an application        | Yes           | advisor, admin |
| DELETE | /api/comments/:id         | Delete a comment                        | Yes           | author, admin  |

### Advisor

| Method | Endpoint                                    | Description                          | Auth Required | Role           |
|--------|---------------------------------------------|--------------------------------------|---------------|----------------|
| GET    | /api/advisor/students                       | List assigned students with app stats| Yes           | advisor, admin |
| GET    | /api/advisor/students/:studentId/applications | View a student's applications (read-only) | Yes    | advisor, admin |
| GET    | /api/advisor/students/:studentId/deadlines  | View a student's deadlines (read-only) | Yes         | advisor, admin |

### Admin

| Method | Endpoint                           | Description                    | Auth Required | Role  |
|--------|------------------------------------|--------------------------------|---------------|-------|
| GET    | /api/admin/users                   | List all users with advisor info | Yes         | admin |
| PUT    | /api/admin/users/:userId/advisor   | Assign or remove advisor       | Yes           | admin |

### Utility

| Method | Endpoint    | Description              | Auth Required |
|--------|------------|--------------------------|---------------|
| GET    | /api/hello  | Health check             | No            |
| GET    | /api/status | Server and DB status     | No            |

## Backend Validation

The server validates all input and returns field-level errors:
- Required fields: school_name, program_name (for applications); name, email, password (for auth)
- Enum validation: program_type, fit_level, status must be valid values
- Length limits: school_name and program_name max 200 chars, password min 4 chars
- Date format: app_deadline and decision_date must be YYYY-MM-DD
- Email uniqueness checked on registration

## Testing

The project includes 44+ automated tests:

```bash
# Run backend tests (20 tests)
cd server && npx vitest run

# Run frontend tests (21 tests)
cd client && npx vitest run

# Run E2E smoke tests (3 tests)
cd client && npx playwright test
```

## CI/CD Pipeline

- **CI (Continuous Integration):** Runs on every push via GitHub Actions. Executes all backend tests, frontend tests, and Playwright E2E tests, then builds the frontend.
- **CD (Continuous Deployment):** Triggers automatically after CI passes on the main branch. Uses a self-hosted runner on the Kenyon server to pull code, install dependencies, rebuild the frontend, and restart PM2.

### Key CI/CD Files

| File                          | Purpose                                    |
|-------------------------------|--------------------------------------------|
| .github/workflows/ci.yml     | CI workflow — runs all tests and builds     |
| .github/workflows/cd.yml     | CD workflow — auto-deploys after CI passes  |
| deploy.sh                     | Deployment script run by the CD pipeline    |

## How Sessions Work

1. User signs up or signs in
2. Backend hashes password and verifies against stored hash
3. Backend stores `userId` in the server-side session
4. Express sets a `connect.sid` cookie on the browser
5. On every subsequent request, Express reads the cookie and restores the session
6. `GET /api/me` reads `req.session.userId`, queries the DB, and returns the user + role
7. Refreshing the page re-checks `/api/me` — login state persists
8. `POST /auth/logout` destroys the session and clears the cookie

## Project Structure

```
gradpath/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx          # Main application component
│   │   ├── App.test.jsx     # Frontend tests (21 tests)
│   │   └── App.css          # Application styles
│   ├── package.json
│   └── vite.config.js
├── server/                  # Express backend
│   ├── routes/
│   │   ├── auth.js          # Authentication routes
│   │   ├── applications.js  # Application CRUD routes
│   │   ├── deadlines.js     # Deadline CRUD routes
│   │   ├── comments.js      # Advisor feedback comments
│   │   ├── advisor.js       # Advisor dashboard routes
│   │   └── admin.js         # Admin user management routes
│   ├── tests/
│   │   ├── applicationRoutes.test.js  # API route tests
│   │   └── applicationValidation.test.js  # Validation unit tests
│   ├── utils/
│   │   └── applicationValidation.js
│   ├── app.js               # Express app setup
│   ├── db.js                # Database connection and init
│   └── index.js             # Server entry point
├── tests/                   # Playwright E2E tests
│   └── smoke.spec.js
├── deploy.sh                # CD deployment script
├── .github/workflows/
│   ├── ci.yml               # CI workflow
│   └── cd.yml               # CD workflow
└── README.md
```

## Author

Godwin Idowu — Kenyon College