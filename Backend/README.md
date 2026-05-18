# SCMS Backend — Setup Guide

## Prerequisites
- Node.js 18+
- MS SQL Server (2017 or later) running locally or on a server
- The `SeniorCitizen_db` database created (run `database.sql` first)

---

## Folder Structure
```
scms-backend/
├── server.js          ← Entry point
├── db.js              ← MSSQL connection pool
├── .env               ← Your config (DB creds, JWT secret)
├── middleware/
│   ├── auth.js        ← JWT verification
│   └── upload.js      ← Multer file handler
├── routes/
│   ├── auth.js        ← /api/auth/*
│   ├── users.js       ← /api/users/*
│   ├── seniors.js     ← /api/seniors/*
│   └── reports.js     ← /api/reports/*
└── uploads/           ← Auto-created; stores proof & profile photos
```

---

## Step 1 — Run the SQL Script
Open **SQL Server Management Studio (SSMS)**, connect to your server, open `database.sql`, and run it.  
This creates the `SeniorCitizen_db` database and all tables.

---

## Step 2 — Configure `.env`
Edit `.env` and fill in your actual values:

```env
PORT=3000

DB_SERVER=localhost        # or 192.168.x.x / server hostname
DB_PORT=1433
DB_NAME=SeniorCitizen_db
DB_USER=sa
DB_PASSWORD=YourActualPassword

JWT_SECRET=change_this_to_a_long_random_string
```

> **SQL Server Auth note:** Make sure SQL Server authentication is enabled, not just Windows auth.  
> In SSMS: Server → Properties → Security → "SQL Server and Windows Authentication mode"

---

## Step 3 — Install & Run

```bash
cd scms-backend
npm install
npm start
```

You should see:
```
✅ Connected to MS SQL Server: SeniorCitizen_db
🚀 SCMS Server running at http://localhost:3000
```

For development with auto-reload:
```bash
npm install -g nodemon
npm run dev
```

---

## Step 4 — Point your Frontend at the Backend
In `js/api.js` the `API_BASE` is already set to `http://localhost:3000/api`.  
If you deploy the backend to another machine, update that line.

---

## API Endpoints Summary

### Auth  `/api/auth`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Register a new staff account |
| POST | `/login` | Login, returns JWT token |
| POST | `/change-password` | Change own password (auth required) |
| POST | `/verify-pin` | Verify master admin PIN (auth required) |

### Users  `/api/users`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Get all users |
| GET | `/me` | Get logged-in user's profile |
| PATCH | `/:id/status` | Enable or disable a user |
| PATCH | `/:id/remarks` | Update short remarks for a user |

### Seniors  `/api/seniors`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List seniors (search & status filter) |
| GET | `/stats` | Total and active counts |
| GET | `/:id` | Get single senior |
| POST | `/` | Register new senior (multipart/form-data) |
| PATCH | `/:id/status` | Change active / inactive |
| DELETE | `/:id` | Delete permanently |

### Reports  `/api/reports`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all reports (search) |
| GET | `/:id` | Get single report detail |
| POST | `/` | Create report + proof photo upload |
| DELETE | `/:id` | Delete report |

---

## Uploaded Files
Photos (profile photos, proof photos) are saved to the `uploads/` folder and served at:
```
http://localhost:3000/uploads/<filename>
```

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `Login failed for user 'sa'` | Check DB_USER / DB_PASSWORD in `.env`. Enable SQL auth in SSMS. |
| `Cannot open database` | Make sure you ran `database.sql` first and DB_NAME matches. |
| `ECONNREFUSED` on port 1433 | SQL Server not running, or TCP/IP not enabled in SQL Server Config Manager. |
| `encrypt` error | Set `encrypt: false` in `db.js` (already done for local). |
| File upload fails | Check `uploads/` folder exists and has write permissions. |
