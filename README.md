# Crane CTRL — IoT Tower Crane Dashboard

Real-time control and telemetry dashboard for an STM32-based tower crane.

---

## Architecture

```
STM32 Nucleo-F103RB
       │  UART
Raspberry Pi  ──────►  Firebase Realtime Database
                               │
               ┌───────────────┴──────────────┐
               ▼                              ▼
          FastAPI (backend)          Next.js (frontend)
          - writes commands            - reads telemetry
            to Firebase                 directly via
          - stores history              Firebase JS SDK
            in PostgreSQL             - sends commands
          - persists telemetry          via REST API
            snapshots
               │
          PostgreSQL
```

**Data flow:**
- Operator enters coordinates → Next.js confirms → POST `/api/commands` → FastAPI writes to Firebase + stores in DB
- STM32 reads Firebase → moves crane → writes back `current_theta / current_R / current_H`
- Next.js subscribes to Firebase RTDB directly for live telemetry (no polling)

---

## Stack

| Layer | Technology |
|---|---|
| Hardware | STM32 Nucleo-F103RB + Raspberry Pi |
| Realtime | Firebase Realtime Database |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | FastAPI, SQLAlchemy (async), Alembic |
| Database | PostgreSQL |
| Auth | Clerk (wired, not enforced yet) |

---

## Quickstart

### Prerequisites

- Node.js ≥ 20
- Python ≥ 3.11
- PostgreSQL running locally (or a Neon/Supabase connection string)
- A Firebase project with Realtime Database enabled

---

### 1. Clone

```bash
git clone <your-repo-url>
cd iot_el
```

---

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill in environment variables
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://user:password@localhost/crane_db

# Firebase Admin SDK service account key
# Download from: Firebase Console → Project Settings → Service Accounts → Generate new private key
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# CORS — include your frontend origin
ALLOWED_ORIGINS=http://localhost:3000
```

Place `firebase-service-account.json` in the `backend/` directory.

```bash
# Start — database tables are created automatically on first run
uvicorn backend.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

---

### 3. Frontend

Open a second terminal:

```bash
cd frontend

npm install

cp .env.local.example .env.local
```

Edit `frontend/.env.local`:

```env
# Firebase — Firebase Console → Project Settings → Your Apps → Web App
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# FastAPI backend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
npm run dev
```

Dashboard: `http://localhost:3000/dashboard`

---

## Firebase Realtime Database Rules

```json
{
  "rules": {
    "cranes": {
      "$crane_id": {
        "command":   { ".read": true, ".write": true },
        "telemetry": { ".read": true, ".write": true }
      }
    }
  }
}
```

Tighten these to auth-gated rules before any production deployment.

---

## Firebase Database Schema

**Command node** — written by FastAPI, read by RPi/STM32:
```
cranes/{crane_id}/command/
  target_theta   number   degrees (0 | 30 | 60 | 90)
  target_R       number   cm (0–40)
  target_H       number   cm (0–30)
  command_id     string   UUID
  timestamp      number   Unix ms
```

**Telemetry node** — written by RPi/STM32, read live by Next.js:
```
cranes/{crane_id}/telemetry/
  current_theta  number
  current_R      number
  current_H      number
  motor_status   string   IDLE | MOVING | ERROR | TIMEOUT
  system_status  string   OK | ERR:LIMIT | ERR:TIMEOUT | ERR:MALFORMED
  last_updated   string   ISO 8601
```

---

## Coordinate System

The crane uses **cylindrical coordinates**:

| Axis | Meaning | Range | Valid values |
|---|---|---|---|
| θ (theta) | Boom rotation | 0–90° | `0, 30, 60, 90` only |
| R | Trolley radial distance | 0–40 cm | continuous |
| H | Hook height | 0–30 cm | continuous |

The dashboard accepts **Cartesian input** (x, y, z) and converts automatically. θ is always snapped to the nearest valid hardware angle.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/cranes` | List all cranes |
| POST | `/cranes` | Register a crane |
| POST | `/cranes/{id}/commands` | Send a command (writes to Firebase + DB) |
| GET | `/cranes/{id}/commands` | Paginated command history |
| GET | `/cranes/{id}/telemetry` | Telemetry snapshots (time range) |
| GET | `/cranes/{id}/faults` | Fault events |

---

## Project Structure

```
iot_el/
├── backend/
│   ├── api/             # Route handlers (thin — business logic stays in services/)
│   ├── services/        # Firebase listener, telemetry persistence
│   ├── models/          # SQLAlchemy ORM models
│   ├── schemas/         # Pydantic request/response schemas
│   ├── database/        # Engine, session factory, Base
│   ├── config.py        # Pydantic settings (reads .env)
│   ├── main.py          # App factory, lifespan, CORS
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── dashboard/   # Main operator dashboard page
    │   └── history/     # Command + telemetry history page
    ├── components/
    │   ├── crane/       # CraneAnimationPanel (2D SVG), CraneScene (3D R3F)
    │   ├── dashboard/   # CommandPanel, TelemetryPanel, EStopButton
    │   └── history/     # CommandTable, TelemetryChart
    ├── hooks/           # useFirebaseTelemetry, useSendCommand,
    │                    # useCommandHistory, useCraneState
    ├── lib/             # api.ts (REST client), coordConverter.ts, firebase.ts
    └── types/           # crane.ts — all shared types + CRANE_LIMITS constants
```

---

## Deployment

### Frontend — Vercel

```bash
cd frontend
vercel deploy
```

Add the same `NEXT_PUBLIC_*` env vars in the Vercel project dashboard.

### Backend — Railway / Render / Fly.io

Set env vars in the hosting platform. For Firebase credentials without a file, use the inline JSON form instead of a path:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

The backend creates tables on first startup via `Base.metadata.create_all`. For production, generate and run Alembic migrations instead.

---

## Development Tips

- **Type-check frontend** — `cd frontend && npx tsc --noEmit`
- **API docs** — `http://localhost:8000/docs` (Swagger UI auto-generated by FastAPI)
- **Theme toggle** — button in dashboard header; state lives on `data-theme` attribute of `<html>`
- **Crane animation panel** — driven entirely by command dispatch history, not live telemetry; works offline from Firebase
- **E-Stop** — bypasses the confirmation dialog; sends an immediate stop command
