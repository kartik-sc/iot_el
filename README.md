# CRANE CTRL — IoT Tower Crane Dashboard

> Real-time operator dashboard for an STM32 Nucleo-F103RB tower crane. The browser sends cylindrical coordinates (θ, R, H) to Firebase Realtime Database; a Raspberry Pi reads and forwards them over UART to the STM32; telemetry flows back the same way and appears live on the dashboard.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [File Explanations](#3-file-explanations)
4. [Execution Flow](#4-execution-flow)
5. [API Documentation](#5-api-documentation)
6. [Database Documentation](#6-database-documentation)
7. [Environment Variables](#7-environment-variables)
8. [System Architecture Diagram](#8-system-architecture-diagram)
9. [API Request Flow Diagram](#9-api-request-flow-diagram)
10. [User Journey Diagram](#10-user-journey-diagram)
11. [Quickstart](#quickstart)
12. [Deployment](#deployment)

---

## 1. Project Overview

CRANE CTRL is a full-stack IoT control panel for a physically-built 3-axis tower crane. Operators send movement commands from a browser; the dashboard shows live position feedback, a 2D side-elevation SVG view, and a 3D interactive WebGL model — all animated without polling.

### Hardware Context

| Component | Role |
|---|---|
| STM32 Nucleo-F103RB | Microcontroller — reads commands via UART, drives stepper/servo motors |
| Raspberry Pi | Gateway — polls Firebase RTDB, converts to UART frames, publishes telemetry back |
| Crane chassis | 3-axis: slewing (θ), trolley radial (R), hook height (H) |

### Coordinate System

The crane operates in **cylindrical coordinates** only:

| Axis | Physical Meaning | Range | Constraint |
|---|---|---|---|
| θ (theta) | Boom slewing angle | 0 – 90° | Snaps to 0, 30, 60, or 90° (hardware stepper limit) |
| R | Trolley radial distance from pivot | 0 – 40 cm | Continuous |
| H | Hook drop height below boom | 0 – 30 cm | Continuous |

The frontend also accepts **Cartesian input (x, y, z)** and auto-converts to cylindrical before dispatch:
- `x` = distance along boom direction
- `y` = perpendicular to boom (horizontal)
- `z` = hook height (vertical)

### Layer-wise Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Microcontroller** | STM32 Nucleo-F103RB (C/HAL) | — | Motor control, position sensors |
| **Gateway** | Raspberry Pi (Python) | — | Firebase ↔ UART bridge |
| **Realtime bus** | Firebase Realtime Database | JS SDK v12 / Admin SDK v6.6 | Bidirectional command + telemetry channel |
| **Frontend framework** | Next.js | 16.2.9 | React server/client components, App Router |
| **UI library** | React | 19.2.4 | Component model |
| **Language (frontend)** | TypeScript | 5.x (strict) | End-to-end type safety — no `any` |
| **Styling** | Tailwind CSS | 4.x | Utility classes + CSS custom property theming |
| **3D rendering** | Three.js + @react-three/fiber + @react-three/drei | 0.184 / 9.x / 10.x | 3D crane model in WebGL |
| **Charts** | Recharts | 3.9 | Telemetry history line chart |
| **Backend framework** | FastAPI | 0.115.5 | Async REST API |
| **Language (backend)** | Python | ≥ 3.11 | Backend language |
| **ORM** | SQLAlchemy (async) | 2.0.36 | Database access layer |
| **DB driver** | asyncpg | 0.30.0 | Non-blocking PostgreSQL driver |
| **Database** | PostgreSQL | ≥ 14 | Persistent command + telemetry history |
| **Schema validation** | Pydantic v2 | 2.10.2 | Request/response typing + settings |
| **Migrations** | Alembic | 1.14.0 | Database schema version control |
| **Firebase (server)** | firebase-admin | 6.6.0 | Write commands + optional telemetry listener |
| **Authentication** | Clerk | ^7.5.7 | JWT-based user identity (wired, not yet enforced) |
| **Fonts** | Space Grotesk + JetBrains Mono | — | UI sans-serif + monospace |
| **Deployment — frontend** | Vercel | — | Edge CDN + serverless functions |
| **Deployment — backend** | Railway / Render / Fly.io | — | Containerised Python service |

---

## 2. Architecture Overview

```
┌──────────────── HARDWARE ──────────────────────────────────────────────────┐
│                                                                             │
│   STM32 Nucleo-F103RB  ◄───── UART ─────►  Raspberry Pi (Python)          │
│   (motor control,                           (Firebase bridge, publishes     │
│    position sensors)                         telemetry, reads commands)    │
│                                                      │                      │
└──────────────────────────────────────────────────────┼──────────────────────┘
                                                        │  Admin SDK reads/writes
                                           ┌────────────▼────────────────┐
                                           │  Firebase Realtime Database  │
                                           │  /commands/latest   ◄── FastAPI writes
                                           │  /commands/estop    ◄── Browser writes
                                           │  /telemetry/latest  ──► Browser reads
                                           └────────────┬────────────────┘
                                                        │
                            ┌───────────────────────────┼──────────────────────┐
                            │                           │                      │
                  ┌─────────▼──────────┐     ┌─────────▼──────────┐           │
                  │  FastAPI (Python)  │     │  Next.js 16         │           │
                  │  REST API          │     │  /dashboard         │           │
                  │  Firebase Admin SDK│     │  /history           │           │
                  │  DB writes         │     │  CraneSideView (2D) │           │
                  └─────────┬──────────┘     │  CraneAnimation (3D)│           │
                            │ asyncpg         └─────────┬──────────┘           │
                  ┌─────────▼──────────┐               │ REST calls            │
                  │   PostgreSQL        │◄──────────────┘                       │
                  │  cranes             │                                       │
                  │  commands           │                                       │
                  │  telemetry_snapshots│                                       │
                  │  fault_events       │                                       │
                  └────────────────────┘                                       │
```

### Data Flow — Command Dispatch

1. Operator types Cartesian (x, y, z) **or** Cylindrical (θ, R, H) in browser
2. Frontend converts + snaps θ to nearest valid angle (0/30/60/90°)
3. Confirmation dialog shows both coordinate representations + snap warning if θ adjusted
4. On confirm: **optimistic update** fires immediately — animation starts before network round-trip
5. Firebase JS SDK writes `{target_theta, target_R, target_H, command_id, timestamp}` to `/commands/latest`
6. In parallel: REST `POST /commands` hits FastAPI → second Firebase write + PostgreSQL insert
7. Raspberry Pi `onValue()` detects `/commands/latest` change → encodes UART frame → STM32
8. STM32 drives motors, reads encoders, streams position back over UART
9. Raspberry Pi writes `{current_theta, current_R, current_H, motor_status}` to `/telemetry/latest`
10. Next.js `onValue()` listener triggers → TelemetryPanel + all animations update smoothly

### Data Flow — Animation (rAF LERP)

Both the 2D SVG panel and the 3D WebGL panel use requestAnimationFrame-based **linear interpolation (LERP)**:

- Every frame: `current = current + (target - current) × 0.07`
- At 60fps this produces a natural ease-out curve (reaches ~99% of target in ~66 frames ≈ 1.1s)
- `useSharedCranePos` provides a single unified LERP that prioritises live telemetry over command history

---

## 3. File Explanations

### Repository Root

```
iot_el/
├── README.md                    This document
├── .gitignore                   Excludes: venv, node_modules, .env files, firebase-service-account.json
├── backend/                     Python FastAPI application
└── frontend/                    Next.js 16 application
```

---

### Backend (`backend/`)

```
backend/
├── main.py                      App factory, lifespan, CORS
├── config.py                    Pydantic Settings — reads .env
├── requirements.txt             Python package list
├── .env.example                 Template — copy to .env and fill
├── firebase-service-account.json  Firebase Admin credentials (gitignored)
│
├── api/
│   ├── health.py                GET /health
│   ├── cranes.py                GET /cranes, POST /cranes, GET /cranes/{id}
│   ├── commands.py              POST /commands, GET /commands
│   └── telemetry.py             GET /telemetry/history, /telemetry/latest, /faults
│
├── models/
│   └── crane.py                 SQLAlchemy ORM: Crane, Command, TelemetrySnapshot, FaultEvent
│
├── schemas/
│   └── crane.py                 Pydantic v2 schemas: *Create, *Out, CommandPage
│
├── services/
│   └── firebase_listener.py     Firebase Admin SDK init, command write, e-stop write,
│                                telemetry listener (stubbed — run in daemon thread per crane)
│
└── database/
    └── connection.py            Async engine, SessionLocal, Base, get_db() yield dependency
```

**`main.py`** — Entry point. `lifespan()` async context manager:
- Calls `Base.metadata.create_all` (idempotent table creation — swap for Alembic in prod)
- Calls `init_firebase()` — loads credentials, initialises Admin SDK
- Telemetry listener start is commented out (TODO once cranes are seeded)
Registers all four API routers. Adds CORS middleware using `settings.origins`.

**`config.py`** — `Settings(BaseSettings)` with `env_file=".env"`. The `origins` property splits the comma-separated `ALLOWED_ORIGINS` string into a list for CORS.

**`api/commands.py`** — Core dispatch handler:
1. `db.get(Crane, body.crane_id)` — validates crane exists or raises 404
2. Generates `cmd_XXXXX` short ID via `random.choices`
3. `write_command_to_firebase(namespace, payload)` — immediate Firebase write
4. `db.add(Command(...)); await db.commit()` — PostgreSQL insert
5. Returns `CommandOut` Pydantic schema

**`services/firebase_listener.py`** — Dual-mode credential loading: JSON file (local dev) or inline JSON string (cloud env var). Exports:
- `init_firebase()` — singleton, safe to call multiple times
- `write_command_to_firebase(namespace, cmd)` — sets `/{namespace}/commands/latest`
- `write_estop_to_firebase(namespace)` — sets `/{namespace}/commands/estop`
- `start_telemetry_listener(namespace, callback)` — blocking Firebase listener (designed for daemon thread)

**`models/crane.py`** — Four SQLAlchemy mapped classes with UUID PKs and `relationship()` back-populates. All timestamps use `DateTime(timezone=True)` with a `utcnow()` default.

---

### Frontend (`frontend/`)

```
frontend/
├── package.json
├── tsconfig.json                strict: true, paths: @/* → ./
├── next.config.ts
├── .env.local.example
│
├── app/
│   ├── layout.tsx               Root layout — Space Grotesk + JetBrains Mono fonts,
│   │                            data-theme="dark" on <html>
│   ├── globals.css              11 CSS custom properties (dark + light variants),
│   │                            @import "tailwindcss", input reset
│   ├── page.tsx                 Root route (placeholder / redirect)
│   ├── dashboard/
│   │   └── page.tsx             Main operator page — orchestrates all hooks,
│   │                            Header, CommandPanel, TelemetryPanel,
│   │                            CraneSideView (2D, left), CraneAnimationPanel (3D, right)
│   └── history/
│       └── page.tsx             History page — REST fetches on mount,
│                                time-range selector, TelemetryChart, CommandTable, FaultEvents
│
├── components/
│   ├── crane/
│   │   ├── CraneSideView.tsx    2D SVG mechanical view. Two sub-panels:
│   │   │                        (A) Side elevation: ground hatch, mast body + lattice braces,
│   │   │                            counter-jib + counterweight, support cable, boom + R ticks,
│   │   │                            apex cap, trolley wheels + body, rope, hook J-curve, H bar
│   │   │                        (B) Top-down compass: range rings, θ guide lines, animated boom
│   │   │                            arm, trolley dot. Recent commands list.
│   │   │                        Uses useSharedCranePos internally (60fps LERP scoped here).
│   │   │
│   │   ├── CraneAnimationPanel.tsx  3D WebGL scene. CraneMesh inside <Canvas>:
│   │   │                        useFrame drives LERP via mutable refs (zero React re-renders).
│   │   │                        Mast + accent rings, boom + counter-jib, trolley wheels + body,
│   │   │                        rope (BufferGeometry updated per frame), hook + torus.
│   │   │                        Top-down SVG inset + recent commands overlaid via position:absolute.
│   │   │                        SSR-safe: defers Canvas mount until client hydration.
│   │   │
│   │   ├── CraneScene.tsx       Alternative 3D scene (not on dashboard). Takes SmoothedCraneState,
│   │   │                        uses CraneModel + fixed PerspectiveCamera + OrbitControls.
│   │   ├── CraneModel.tsx       Detailed 3D crane mesh. Motor status drives colour + pulse animation.
│   │   │                        trolleyX = (R / R_max) × BOOM_LENGTH; hookDrop proportional to H.
│   │   └── CraneEnvironment.tsx R3F lighting + environment setup for CraneScene.
│   │
│   ├── dashboard/
│   │   ├── CommandPanel.tsx     Mode toggle pill (CARTESIAN ↔ CYLINDRICAL), 3 input fields
│   │   │                        (text inputs for Cartesian; select+inputs for Cylindrical),
│   │   │                        ConversionPreview box (live, both formats, active colouring,
│   │   │                        snap warning), ShakeField validation animation, REVIEW & SEND
│   │   │                        button with status states, confirmation dialog (overlay + scale
│   │   │                        transition), Last Sent monospaced readout.
│   │   ├── TelemetryPanel.tsx   3 Readout components (θ/R/H) each with a progress bar filling
│   │   │                        proportional to CRANE_LIMITS max. Motor status badge with 4
│   │   │                        styles (IDLE/MOVING/ERROR/TIMEOUT). System status badge. Fault
│   │   │                        error banner. Last updated time.
│   │   ├── EStopButton.tsx      Red emergency stop — no confirmation dialog, instant Firebase write.
│   │   └── ConnectionBadge.tsx  Live/offline indicator using Firebase .info/connected.
│   │
│   └── history/
│       ├── TelemetryChart.tsx   Recharts ResponsiveContainer LineChart. Three lines:
│       │                        theta (#00d4ff), R (#ffb800), H (#00ff88). Dark theme tooltips.
│       └── CommandTable.tsx     Overflow-x table. Columns: Command ID, θ, R, H, User, Sent at.
│
├── hooks/
│   ├── useFirebaseTelemetry.ts  Two onValue() subscriptions:
│   │                            .info/connected → setConnected boolean
│   │                            /telemetry/latest → setTelemetry state
│   │                            Cleanup: off() + unsubscribe on unmount
│   │
│   ├── useSendCommand.ts        Optimistic update: setLastCmd + onSuccess?.(cmd) fire BEFORE
│   │                            any await. Firebase set() + api.commands.send() are fire-and-
│   │                            forget with .then()/.catch(). Status: idle→sending→success/error.
│   │
│   ├── useCommandHistory.ts     useCallback-memoised addCommand() prepends to array,
│   │                            slices to MAX_HISTORY=20. Prevents infinite growth.
│   │
│   ├── useCraneState.ts         Telemetry-driven LERP (LERP_SPEED=0.08). Returns SmoothedCraneState
│   │                            with normalised values (thetaNorm, RNorm, HNorm). Used by CraneScene.
│   │
│   └── useSharedCranePos.ts     Priority: connected+telemetry data > latestCommand > zero.
│                                Single rAF loop. Returns SmoothedCraneState (same shape as
│                                useCraneState) so it's drop-in compatible with CraneScene.
│
├── lib/
│   ├── firebase.ts              getApps().length === 0 guard prevents duplicate init in Next.js
│   │                            hot reload. Exports db = getDatabase(app).
│   ├── api.ts                   apiFetch<T>() throws on non-OK HTTP. Typed call signatures
│   │                            for api.cranes, api.commands, api.telemetry, api.faults.
│   └── coordConverter.ts        Pure functions — no side effects, no imports except types:
│                                snapToNearest, cylindricalToCartesian, cartesianToCylindrical,
│                                isWithinLimits, formatCylindrical, formatCartesian
│
└── types/
    └── crane.ts                 Single source of truth for all shared types.
                                 CRANE_LIMITS = { theta:{0,90}, R:{0,40}, H:{0,30} } as const.
                                 VALID_THETA_ANGLES = [0,30,60,90] as const tuple.
```

---

## 4. Execution Flow

### 4.1 Application Startup

**Backend:**
```
uvicorn backend.main:app --reload
  → lifespan() called
  → engine.begin() → Base.metadata.create_all → creates 4 tables if missing
  → init_firebase() → loads service account JSON → firebase_admin.initialize_app()
  → routers registered: /health, /cranes, /commands, /telemetry, /faults
  → CORS: allow_origins = settings.origins (parsed from ALLOWED_ORIGINS)
  → Server ready on :8000
```

**Frontend:**
```
next dev
  → app/layout.tsx → Space Grotesk + JetBrains Mono fonts loaded
  → app/dashboard/page.tsx mounts → DashboardPage()
      → useFirebaseTelemetry("") initialises
          → firebase.ts → initializeApp() (singleton guard)
          → onValue(.info/connected) → setConnected()
          → onValue(/telemetry/latest) → setTelemetry() on every hardware update
      → useCommandHistory() → empty array, addCommand memoised
      → useSendCommand(null, "", addCommand) → status="idle"
      → components render
      → CraneAnimationPanel → <Canvas> deferred to client mount
          → CraneMesh renders → useFrame loop starts at 60fps
      → CraneSideView → useSharedCranePos() → rAF LERP loop starts at 60fps
```

---

### 4.2 Command Dispatch (detailed step-by-step)

```
[1] User types x=6, y=8, z=9 in Cartesian mode
    → useMemo re-runs cartesianToCylindrical({6, 8, 9}):
        R = √(6²+8²) = 10 cm
        thetaRaw = atan2(8,6) × 180/π = 53.13°
        snapToNearest(53.13) = 60°   (nearest of 0,30,60,90)
        returns { cyl:{theta:60, R:10, H:9}, snapped:true }
    → ConversionPreview shows both formats, snap warning shown

[2] User clicks REVIEW & SEND
    → validate() checks all fields non-empty → ok
    → openDialog() → setPending(...) → setDialogOpen(true)
    → Dialog animates in: fadeInOverlay + scaleInCard CSS keyframes
    → Shows: Cartesian (6, 8, 9) | Cylindrical (60°, 10cm, 9cm)
    → Snap warning: "snapped from 53.1° — nearest valid: 60°"

[3] User clicks CONFIRM
    → handleConfirm()
    → setDialogOpen(false)
    → onSend(60, 10, 9) → useSendCommand.sendCommand(60, 10, 9)

[4] useSendCommand: OPTIMISTIC UPDATE (synchronous, before any await)
    → setStatus("sending")
    → cmd = { command_id:"cmd_ab3x7", target_theta:60, target_R:10, target_H:9, timestamp:now }
    → setLastCmd(cmd)        ← "Last Sent" box updates instantly
    → onSuccess?.(cmd)       ← addCommand(cmd) → useCommandHistory adds to ring buffer
    → [ANIMATION STARTS HERE — before network]

[5] Firebase write (fire-and-forget — no await)
    → set(ref(db, "/commands/latest"), cmd)
    → .then() → setStatus("success") → setTimeout 2s → setStatus("idle")
    → .catch() → setStatus("error") → setTimeout 3s → setStatus("idle")

[6] REST POST (fire-and-forget — no await, parallel with Firebase)
    → api.commands.send(craneId, 60, 10, 9)   [skipped if CRANE_ID=null]
    → POST /commands {"crane_id":..., "target_theta":60, "target_R":10, "target_H":9}
    → FastAPI: crane found → writes Firebase again → inserts DB row → returns CommandOut

[7] useCommandHistory update propagates to both animation panels
    CraneSideView (useSharedCranePos):
        → history[0] changed → targetRef.current = {theta:60, R:10, H:9}
        → rAF tick each frame: pos.R += (10 - pos.R) × 0.08  etc.
        → SVG trolleyX = MAST_X + (pos.R / 40) × BOOM_PX  → trolley slides right
        → SVG hookY = BOOM_Y + (pos.H / 30) × ROPE_MAX    → hook drops
        → SVG thetaRad = 60° → top-down arm rotates

    CraneAnimationPanel 3D (useFrame LERP inside CraneMesh):
        → latest changed → targetRef.current = {theta:60, R:10, H:9}
        → useFrame per frame: currentRef.theta → 60°, .R → 10, .H → 9
        → pivotRef.current.rotation.y = -(60° rad)
        → trolleyRef.current.position.x = (10/40) × MAX_R_W
        → hookRef.current.position.y = -hookDrop
        → rope BufferGeometry setXYZ → visual rope length updates

[8] Hardware telemetry arrives (Raspberry Pi → Firebase → Next.js)
    → useFirebaseTelemetry: onValue fires → setTelemetry({current_theta:60, motor_status:"MOVING"})
    → TelemetryPanel: θ readout → "60°", motor badge → "MOVING" (amber pulse)
    → useSharedCranePos: connected=true + telemetry has values → target switches to telemetry
      (telemetry position takes priority over command history once hardware confirms)
    → Motor reports "IDLE" when movement finishes → badge returns to cyan
```

---

### 4.3 E-Stop Flow

```
User clicks E-STOP
  → sendEStop() (no dialog, no optimistic update for animation)
  → set(ref(db, "/commands/estop"), {emergency:true, timestamp:now})
  → Raspberry Pi detects /commands/estop → sends HALT UART frame
  → STM32 brakes all motors
  [E-Stop is not persisted to PostgreSQL — Firebase only]
```

---

### 4.4 History Page Load

```
Navigate to /history
  → useEffect (on mount):
      api.commands.list(CRANE_ID, 100, 0)     → GET /commands?crane_id=...
      api.faults.list(CRANE_ID)               → GET /faults?crane_id=...
  → useEffect (when rangeHours changes):
      api.telemetry.history(CRANE_ID, from, to) → GET /telemetry/history?...
  → CommandTable renders with paginated rows
  → TelemetryChart renders 3-line Recharts graph
  → FaultEvents section visible if any faults exist
```

---

## 5. API Documentation

Base URL: `http://localhost:8000` (development)  
Interactive Swagger UI: `http://localhost:8000/docs`  
ReDoc: `http://localhost:8000/redoc`

---

### `GET /`

Root welcome response.

**Response `200`:**
```json
{ "status": "ok", "docs": "/docs", "health": "/health" }
```

---

### `GET /health`

Liveness probe for load balancers and uptime monitors.

**Response `200`:**
```json
{ "status": "ok" }
```

---

### `GET /cranes`

List all registered cranes ordered by creation time.

**Response `200`:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Crane Alpha",
    "firebase_namespace": "crane_alpha",
    "created_at": "2026-06-01T10:00:00Z"
  }
]
```

---

### `POST /cranes`

Register a new physical crane. One row per crane — each maps to a Firebase namespace prefix.

**Request body:**
```json
{ "name": "Crane Alpha", "firebase_namespace": "crane_alpha" }
```

| Field | Type | Required | Constraint |
|---|---|---|---|
| `name` | string | YES | 1–100 characters |
| `firebase_namespace` | string | NO | Default `""` — uses RTDB root path |

**Response `201`:** `CraneOut` (same shape as list item above)  
**Error `422`:** Validation failure

---

### `GET /cranes/{crane_id}`

Get a single crane by UUID primary key.

**Path param:** `crane_id` — UUID  
**Response `200`:** `CraneOut`  
**Error `404`:** `{ "detail": "Crane not found" }`

---

### `POST /commands`

Dispatch a movement command. Performs two writes atomically from the caller's perspective:
1. Firebase RTDB `/{namespace}/commands/latest` — hardware reads this
2. PostgreSQL `commands` row — audit trail

**Request body:**
```json
{
  "crane_id": "550e8400-e29b-41d4-a716-446655440000",
  "target_theta": 60.0,
  "target_R": 10.5,
  "target_H": 9.0
}
```

| Field | Type | Unit | Description |
|---|---|---|---|
| `crane_id` | UUID | — | Must exist in `cranes` table |
| `target_theta` | float | degrees | Boom slewing angle (hardware snaps — send 0, 30, 60, or 90) |
| `target_R` | float | cm | Trolley radial distance (0–40) |
| `target_H` | float | cm | Hook drop height (0–30) |

**Response `201`:** `CommandOut`
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "command_id": "cmd_ab3x7",
  "crane_id": "550e8400-...",
  "user_id": null,
  "target_theta": 60.0,
  "target_R": 10.5,
  "target_H": 9.0,
  "sent_at": "2026-06-26T12:34:56.789Z"
}
```

**Firebase payload written (at `/{namespace}/commands/latest`):**
```json
{
  "command_id": "cmd_ab3x7",
  "target_theta": 60,
  "target_R": 10.5,
  "target_H": 9.0,
  "timestamp": "2026-06-26T12:34:56.789123Z"
}
```

**Error `404`:** Crane not found  
**Error `422`:** Validation failure

---

### `GET /commands`

Paginated command history for a crane, newest first.

**Query parameters:**

| Param | Type | Default | Max | Description |
|---|---|---|---|---|
| `crane_id` | UUID | required | — | Filter by crane |
| `limit` | int | 50 | 200 | Page size |
| `offset` | int | 0 | — | Skip N records |

**Response `200`:** `CommandPage`
```json
{
  "items": [ /* array of CommandOut */ ],
  "total": 142,
  "limit": 50,
  "offset": 0
}
```

---

### `GET /telemetry/history`

Time-bounded telemetry snapshots, ordered ascending by `recorded_at`.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `crane_id` | UUID | required |
| `from` | ISO 8601 datetime | Range start (alias: `from`) |
| `to` | ISO 8601 datetime | Range end (alias: `to`) |
| `limit` | int (max 2000) | Defaults 500 |

**Response `200`:** Array of `TelemetrySnapshotOut`
```json
[
  {
    "id": "...",
    "crane_id": "...",
    "current_theta": 60.0,
    "current_R": 10.5,
    "current_H": 9.0,
    "motor_status": "IDLE",
    "system_status": "OK",
    "recorded_at": "2026-06-26T12:35:00Z"
  }
]
```

---

### `GET /telemetry/latest`

Most recent telemetry snapshot persisted to DB. Returns `null` if no snapshots exist.

**Query params:** `crane_id` (UUID)  
**Response `200`:** `TelemetrySnapshotOut | null`

---

### `GET /faults`

Fault event log, newest first.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `crane_id` | UUID | required |
| `resolved` | bool (optional) | `true` = resolved only, `false` = open only, omit = all |
| `limit` | int (max 500) | Defaults 100 |

**Response `200`:** Array of `FaultEventOut`
```json
[
  {
    "id": "...",
    "crane_id": "...",
    "motor_status": "ERROR",
    "system_status": "ERR:TIMEOUT",
    "occurred_at": "2026-06-26T11:00:00Z",
    "resolved_at": null
  }
]
```

---

## 6. Database Documentation

### Tables

#### `cranes`

Crane registry. One row per physical crane.

| Column | Type | Nullable | Default | Index | Description |
|---|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid4()` | PK | Primary key |
| `name` | VARCHAR(100) | NOT NULL | — | — | Human label |
| `firebase_namespace` | VARCHAR(200) | NOT NULL | `""` | — | RTDB path prefix |
| `created_at` | TIMESTAMPTZ | NOT NULL | `utcnow()` | — | Creation timestamp |

---

#### `commands`

Every movement command dispatched. Append-only audit log.

| Column | Type | Nullable | Default | Index | Description |
|---|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid4()` | PK | Primary key |
| `command_id` | VARCHAR(50) | NOT NULL | — | btree | Short human-readable ID (`cmd_XXXXX`) |
| `crane_id` | UUID | NOT NULL | — | FK | References `cranes.id` |
| `user_id` | VARCHAR(200) | NULL | — | — | Clerk user ID (null until auth enforced) |
| `target_theta` | FLOAT | NOT NULL | — | — | Boom angle in degrees |
| `target_R` | FLOAT | NOT NULL | — | — | Trolley radial distance in cm |
| `target_H` | FLOAT | NOT NULL | — | — | Hook height in cm |
| `sent_at` | TIMESTAMPTZ | NOT NULL | `utcnow()` | btree | Dispatch time |

---

#### `telemetry_snapshots`

Point-in-time hardware position records. Written by the backend telemetry listener thread (currently stubbed — listener must be activated in `main.py`).

| Column | Type | Nullable | Default | Index | Description |
|---|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid4()` | PK | Primary key |
| `crane_id` | UUID | NOT NULL | — | FK | References `cranes.id` |
| `current_theta` | FLOAT | NULL | — | — | Measured boom angle |
| `current_R` | FLOAT | NULL | — | — | Measured trolley distance |
| `current_H` | FLOAT | NULL | — | — | Measured hook height |
| `motor_status` | VARCHAR(50) | NULL | — | — | IDLE / MOVING / ERROR / TIMEOUT |
| `system_status` | VARCHAR(50) | NULL | — | — | OK / ERR:LIMIT / ERR:TIMEOUT / ERR:MALFORMED |
| `recorded_at` | TIMESTAMPTZ | NOT NULL | `utcnow()` | btree | Snapshot time |

---

#### `fault_events`

Motor/system fault lifecycle. A row is created when a fault is detected; `resolved_at` is set when resolved.

| Column | Type | Nullable | Default | Index | Description |
|---|---|---|---|---|---|
| `id` | UUID | NOT NULL | `uuid4()` | PK | Primary key |
| `crane_id` | UUID | NOT NULL | — | FK | References `cranes.id` |
| `motor_status` | VARCHAR(50) | NULL | — | — | Motor status at fault onset |
| `system_status` | VARCHAR(50) | NULL | — | — | System code at fault onset |
| `occurred_at` | TIMESTAMPTZ | NOT NULL | `utcnow()` | btree | Fault onset time |
| `resolved_at` | TIMESTAMPTZ | NULL | — | — | NULL = fault still open |

---

### ER Diagram

```mermaid
erDiagram
    cranes {
        UUID    id           PK
        VARCHAR name
        VARCHAR firebase_namespace
        TIMESTAMPTZ created_at
    }

    commands {
        UUID    id           PK
        VARCHAR command_id
        UUID    crane_id     FK
        VARCHAR user_id
        FLOAT   target_theta
        FLOAT   target_R
        FLOAT   target_H
        TIMESTAMPTZ sent_at
    }

    telemetry_snapshots {
        UUID    id           PK
        UUID    crane_id     FK
        FLOAT   current_theta
        FLOAT   current_R
        FLOAT   current_H
        VARCHAR motor_status
        VARCHAR system_status
        TIMESTAMPTZ recorded_at
    }

    fault_events {
        UUID    id           PK
        UUID    crane_id     FK
        VARCHAR motor_status
        VARCHAR system_status
        TIMESTAMPTZ occurred_at
        TIMESTAMPTZ resolved_at
    }

    cranes ||--o{ commands           : "dispatches"
    cranes ||--o{ telemetry_snapshots : "reports"
    cranes ||--o{ fault_events        : "experiences"
```

---

### Firebase RTDB Schema

```
/                                    (root) or /{namespace}/  per crane
│
├── commands/
│   ├── latest/
│   │   ├── command_id     string    "cmd_ab3x7"
│   │   ├── target_theta   number    60              degrees
│   │   ├── target_R       number    10.5            cm
│   │   ├── target_H       number    9.0             cm
│   │   └── timestamp      string    ISO 8601 UTC
│   │
│   └── estop/
│       ├── emergency      boolean   true
│       └── timestamp      string    ISO 8601 UTC
│
└── telemetry/
    └── latest/
        ├── current_theta  number    actual angle (°)
        ├── current_R      number    actual trolley pos (cm)
        ├── current_H      number    actual hook height (cm)
        ├── motor_status   string    IDLE | MOVING | ERROR | TIMEOUT
        ├── system_status  string    OK | ERR:LIMIT | ERR:TIMEOUT | ERR:MALFORMED
        └── last_updated   string    ISO 8601 UTC
```

**Security Rules — development (open):**
```json
{ "rules": { ".read": true, ".write": true } }
```

**Security Rules — production (tighten before external access):**
```json
{
  "rules": {
    "commands": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "telemetry": {
      ".read": "auth != null",
      ".write": false
    }
  }
}
```

---

## 7. Environment Variables

### Backend — `backend/.env`

Copy `backend/.env.example` → `backend/.env`. **Never commit `.env`.**

| Variable | Required | Example | Description |
|---|---|---|---|
| `DATABASE_URL` | YES | `postgresql+asyncpg://user:pass@localhost/iot_el` | Must use `postgresql+asyncpg://` prefix (asyncpg driver). For Neon/Supabase append `?ssl=require`. |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | YES (local) | `./firebase-service-account.json` | Path to Admin SDK JSON key file. Download: Firebase Console → Project Settings → Service Accounts → Generate new private key. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | YES (cloud) | `{"type":"service_account",...}` | Full JSON as string. Use this on Railway/Render instead of a file. Mutually exclusive with PATH — if both set, JSON string takes priority. |
| `CLERK_SECRET_KEY` | No | `sk_test_...` | Clerk backend key for JWT verification. Required once auth guards are added to route handlers. |
| `ALLOWED_ORIGINS` | NO | `http://localhost:3000,https://your-app.vercel.app` | Comma-separated CORS origins. Must include your Vercel deployment URL. |

---

### Frontend — `frontend/.env.local`

Copy `frontend/.env.local.example` → `frontend/.env.local`. All `NEXT_PUBLIC_*` vars are bundled into the client JS — **never put secrets in NEXT_PUBLIC_ vars**.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | YES | From Firebase Console → Project Settings → Your Apps → Web App → Config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | YES | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | YES | `https://your-project-default-rtdb.firebaseio.com` — must end in `.firebaseio.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | YES | Your Firebase project ID string |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | YES | `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | YES | Numeric sender ID from Firebase config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | YES | Firebase App ID |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | No | `pk_test_...` — Clerk frontend key |
| `CLERK_SECRET_KEY` | No | `sk_test_...` — Clerk backend key (no NEXT_PUBLIC_ prefix — server-side only) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | `/sign-in` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | No | `/dashboard` |
| `NEXT_PUBLIC_API_URL` | YES | `http://localhost:8000` (dev) or your deployed FastAPI URL |

---

## 8. System Architecture Diagram

```mermaid
graph TB
    subgraph HW["Hardware Layer"]
        STM32["STM32 Nucleo-F103RB\n(C / STM32 HAL)\nStepper/servo control\nPosition sensors"]
        RPi["Raspberry Pi\n(Python)\nFirebase polling\nUART bridge\nTelemetry publisher"]
        STM32 <-->|"UART serial frames\ncmd/ack/telemetry"| RPi
    end

    subgraph RT["Realtime Layer — Firebase RTDB"]
        CMD["/commands/latest\n{target_theta, target_R,\ntarget_H, command_id}"]
        ESTOP["/commands/estop\n{emergency: true}"]
        TELEM["/telemetry/latest\n{current_theta, current_R,\ncurrent_H, motor_status}"]
    end

    subgraph BE["Backend Layer"]
        FA["FastAPI\n(Python 3.11+)\nREST API\nFirebase Admin SDK\nPydantic validation"]
        PG[("PostgreSQL\ncranes\ncommands\ntelemetry_snapshots\nfault_events")]
        FA <-->|"asyncpg\nSQLAlchemy 2.0"| PG
    end

    subgraph FE["Frontend Layer — Next.js 16"]
        DASH["dashboard/page.tsx\nOrchestrates all hooks"]
        CP["CommandPanel\nMode toggle\nInput + validation\nConversion preview\nConfirm dialog"]
        TP["TelemetryPanel\nθ/R/H readouts\nMotor status badge\nProgress bars"]
        SV["CraneSideView\n2D SVG\nSide elevation + top view\nrAF LERP (internal)"]
        R3F["CraneAnimationPanel\n3D WebGL (R3F)\nuseFrame LERP\nzero re-renders"]
        HOOKS["Hooks\nuseFirebaseTelemetry\nuseSendCommand\nuseCommandHistory\nuseSharedCranePos"]
        DASH --> CP
        DASH --> TP
        DASH --> SV
        DASH --> R3F
        DASH --> HOOKS
    end

    RPi <-->|"Admin SDK / REST"| CMD
    RPi <-->|"Admin SDK write"| TELEM
    FA -->|"write_command_to_firebase"| CMD
    FE <-->|"Firebase JS SDK\nonValue() subscription"| TELEM
    FE -->|"Firebase JS SDK\nset() write"| CMD
    FE -->|"Firebase JS SDK\nset() write"| ESTOP
    FE -->|"REST POST /commands"| FA
    FE -->|"REST GET /commands\n/telemetry/history\n/faults"| FA
```

---

## 9. API Request Flow Diagram

### Command Dispatch Round-Trip

```mermaid
sequenceDiagram
    actor Op as Operator
    participant CP as CommandPanel
    participant SC as useSendCommand
    participant CH as useCommandHistory
    participant FB as Firebase RTDB
    participant FA as FastAPI
    participant PG as PostgreSQL
    participant Pi as Raspberry Pi
    participant STM as STM32

    Op->>CP: Enter x=6, y=8, z=9 (Cartesian)
    CP->>CP: cartesianToCylindrical → θ=60°, R=10, H=9
    CP->>CP: Show conversion preview + snap warning
    Op->>CP: Click REVIEW & SEND
    CP->>CP: Validate → open confirmation dialog
    Op->>CP: Click CONFIRM
    CP->>SC: sendCommand(60, 10, 9)

    Note over SC: Optimistic update (synchronous)
    SC->>CH: onSuccess(cmd) → addCommand()
    Note over CH: history[0] = cmd_ab3x7
    Note over CP: Animation starts immediately

    SC-->>FB: set(/commands/latest, cmd) [fire-and-forget]
    SC-->>FA: POST /commands {theta:60, R:10, H:9} [fire-and-forget]

    FB->>Pi: onValue() fires
    Pi->>STM: UART: "MOVE theta=60 R=10 H=9"
    STM->>STM: Drive motors (seconds)

    FA->>FB: write_command_to_firebase() [second write, redundant]
    FA->>PG: INSERT INTO commands (theta=60, R=10, H=9)
    PG-->>FA: Row inserted
    FA-->>SC: 201 CommandOut [ignored — fire-and-forget]

    STM->>Pi: UART ACK + {theta=60, R=10, H=9, motor=MOVING}
    Pi->>FB: set(/telemetry/latest, {current_theta:60, motor_status:MOVING})
    FB->>CP: onValue() → setTelemetry()
    CP->>CP: TelemetryPanel updates, motor badge MOVING (amber)

    STM->>Pi: Movement complete {motor=IDLE}
    Pi->>FB: set(/telemetry/latest, {motor_status:IDLE})
    FB->>CP: onValue() → motor badge → IDLE (cyan)
```

---

### History Page Parallel Fetch

```mermaid
sequenceDiagram
    participant U as User
    participant HP as history/page.tsx
    participant FA as FastAPI
    participant PG as PostgreSQL

    U->>HP: Navigate to /history
    HP->>FA: GET /commands?crane_id=...&limit=100
    HP->>FA: GET /faults?crane_id=...
    HP->>FA: GET /telemetry/history?crane_id=...&from=1h_ago&to=now

    FA->>PG: SELECT * FROM commands WHERE crane_id=? ORDER BY sent_at DESC LIMIT 100
    FA->>PG: SELECT * FROM fault_events WHERE crane_id=? ORDER BY occurred_at DESC
    FA->>PG: SELECT * FROM telemetry_snapshots WHERE crane_id=? AND recorded_at BETWEEN ? AND ?

    PG-->>FA: Commands result set
    PG-->>FA: Fault events result set
    PG-->>FA: Telemetry snapshots result set

    FA-->>HP: CommandPage JSON
    FA-->>HP: FaultEvent[] JSON
    FA-->>HP: TelemetrySnapshot[] JSON

    HP->>HP: Render CommandTable (paginated rows)
    HP->>HP: Render TelemetryChart (3-line Recharts graph)
    HP->>HP: Render FaultEvents section
```

---

## 10. User Journey Diagram

```mermaid
journey
    title Crane Operator — Full Control Session

    section Dashboard Load
        Open browser at /dashboard: 5: Operator
        See OFFLINE status (Firebase connecting): 3: Operator
        Firebase connects — indicator turns LIVE: 5: Operator
        Telemetry panel shows last known position: 4: Operator
        2D crane view shows crane at rest: 5: Operator
        3D crane model renders idle: 5: Operator

    section First Command — Cartesian Mode
        Select CARTESIAN mode (default): 5: Operator
        Type x=6 in first input field: 4: Operator
        Type y=8 in second input field: 4: Operator
        Type z=9 in third input field: 4: Operator
        Live conversion preview appears instantly: 5: Operator
        Notice snap warning theta 53.1deg to 60deg: 4: Operator
        Click REVIEW & SEND: 5: Operator
        Confirmation dialog scales in: 5: Operator
        Review both coordinate formats side by side: 5: Operator
        Click CONFIRM: 5: Operator
        2D side view animates immediately: 5: Operator
        Trolley slides right on boom to R=10cm: 5: Operator
        Hook descends to H=9cm: 5: Operator
        3D boom rotates to 60 degrees: 5: Operator

    section Telemetry Monitoring
        Telemetry panel theta readout updates: 5: Operator
        Motor badge changes to MOVING amber: 4: Operator
        R and H progress bars fill to target: 5: Operator
        Motor badge returns to IDLE cyan: 5: Operator
        2D top-down compass shows new boom angle: 5: Operator

    section Second Command — Cylindrical Mode
        Switch to CYLINDRICAL mode: 5: Operator
        Select theta=30 degrees from dropdown: 5: Operator
        Type R=20 trolley distance: 4: Operator
        Type H=15 hook height: 4: Operator
        Conversion preview shows Cartesian equivalent: 5: Operator
        Confirm and dispatch: 5: Operator
        Boom rotates from 60 to 30 degrees: 5: Operator
        Trolley slides from 10cm to 20cm: 5: Operator

    section Emergency Stop
        Notice unexpected crane movement: 2: Operator
        Click red E-STOP button: 5: Operator
        No confirmation dialog — immediate halt: 5: Operator
        STM32 brakes all motors via UART: 5: STM32

    section History Review
        Click HISTORY in header: 5: Operator
        See full command log with timestamps: 5: Operator
        View 3-axis telemetry chart: 5: Operator
        Filter chart to last 30 minutes: 5: Operator
        Check fault events section: 4: Operator
        Navigate back to dashboard: 5: Operator
```

---

## Quickstart

### Prerequisites

- Node.js ≥ 20
- Python ≥ 3.11
- PostgreSQL running locally (or Neon/Supabase connection string)
- Firebase project with Realtime Database enabled

### 1. Clone

```bash
git clone <repo-url>
cd iot_el
```

### 2. Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
source venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env        # then edit .env with your values

# Start (tables auto-created on first run)
uvicorn backend.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

### 3. Frontend

Open a second terminal:

```bash
cd frontend
npm install
cp .env.local.example .env.local    # then fill in Firebase config + API URL
npm run dev
```

Dashboard: `http://localhost:3000/dashboard`

### 4. Seed a Crane (enable DB persistence)

The dashboard has `CRANE_ID = null` by default (skips DB writes). To enable:

```bash
curl -X POST http://localhost:8000/cranes \
  -H "Content-Type: application/json" \
  -d '{"name":"Crane Alpha","firebase_namespace":""}'
# Copy returned "id" UUID into frontend/app/dashboard/page.tsx line 12:
# const CRANE_ID = "550e8400-..."
```

---

## Deployment

### Frontend — Vercel

```bash
cd frontend
npx vercel deploy
```

Set the same `NEXT_PUBLIC_*` env vars in the Vercel project settings → Environment Variables.

### Backend — Railway / Render / Fly.io

Set these env vars on your platform:

```
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
ALLOWED_ORIGINS=https://your-app.vercel.app
```

Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

### Production Checklist

- [ ] Replace `create_all` with Alembic migrations: `alembic upgrade head`
- [ ] Tighten Firebase Security Rules (see section 6)
- [ ] Add `<ClerkProvider>` to `app/layout.tsx` and route guards
- [ ] Uncomment `start_telemetry_listener` in `backend/main.py` (after seeding cranes)
- [ ] Set `CRANE_ID` in `dashboard/page.tsx` to a real seeded UUID
- [ ] Add `?ssl=require` to `DATABASE_URL` if using a cloud Postgres provider

---

## Development Tips

| Task | Command |
|---|---|
| Type-check frontend | `cd frontend && npx tsc --noEmit` |
| API docs | `http://localhost:8000/docs` |
| Firebase emulator | `firebase emulators:start --only database` |
| Simulate telemetry | Write directly to RTDB console at `/telemetry/latest` |
| Offline animation test | Send a command — animation works without Firebase connection |
| Theme toggle | Button in top-right of dashboard header |
| Debug 3D scene | OrbitControls enabled — click + drag to inspect |
