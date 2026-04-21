# TandemPay

**Full-stack expense splitting app with Stripe Connect peer-to-peer payments, Plaid bank linking, a React 19 web app, and a React Native + Expo mobile app.**

🌐 **Live:** [tandempay.ca](https://tandempay.ca) &nbsp;|&nbsp; 📡 **API:** [api.tandempay.ca/docs](https://api.tandempay.ca/docs)

---

## What It Does

TandemPay lets groups of people track shared expenses and settle up with real money transfers — no IOUs, no Venmo screenshots. You create a group, add expenses, and the app tells you exactly who owes who. Pay directly through the app via Stripe, or mark a payment as sent via e-transfer.

**Core features:**
- Create shared expense groups for trips, apartments, dinners, etc.
- Track expenses with equal splits across any subset of members
- Greedy debt-simplification algorithm minimizes the number of transactions needed to settle a group
- Real Stripe Connect payments — payers pay via card, recipients receive funds directly to their bank account
- Plaid OAuth bank linking
- Recurring expense reminders with configurable intervals
- Friend system with social graph-aware group invites
- In-app notification feed with real-time polling
- Password reset via transactional email (Resend API)
- Dark / light mode on both web and mobile

---

## Architecture

TandemPay is a three-layer monorepo. All three layers share one backend API.

```
TandemPay/
├── backend/          ← FastAPI REST API + PostgreSQL
├── frontend/         ← React 19 web app (tandempay.ca)
├── mobile/           ← React Native + Expo (iOS & Android)
├── render.yaml       ← One-click Render cloud deployment
└── docker-compose.yml← Local PostgreSQL for development
```

```
                    ┌─────────────────────────────┐
                    │      api.tandempay.ca        │
                    │   FastAPI + PostgreSQL       │
                    └──────────┬──────────┬────────┘
                               │          │
              ┌────────────────┘          └──────────────────┐
              ▼                                              ▼
   ┌────────────────────┐                      ┌────────────────────────┐
   │   tandempay.ca     │                      │  iOS & Android App     │
   │   React 19 + Vite  │                      │  React Native + Expo   │
   └────────────────────┘                      └────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend framework** | FastAPI 0.115, Python 3.11 |
| **Production server** | Gunicorn + UvicornWorker (2 workers) |
| **ORM** | SQLAlchemy 2.0 (fully async) |
| **Database (dev)** | SQLite via `aiosqlite` |
| **Database (prod)** | PostgreSQL via `asyncpg` |
| **Auth** | JWT (`python-jose`), bcrypt |
| **Payments** | Stripe SDK — Connect Express accounts, PaymentIntents, webhooks |
| **Bank linking** | Plaid Python SDK — OAuth token exchange, account storage |
| **Email** | Resend API — transactional HTML emails |
| **Background jobs** | APScheduler — AsyncIOScheduler, two recurring jobs |
| **Web frontend** | React 19, TypeScript, TailwindCSS v4, Vite 6 |
| **Web routing** | React Router DOM 7 |
| **Payment UI** | @stripe/react-stripe-js, @stripe/stripe-js |
| **Bank link UI** | react-plaid-link |
| **Icons** | Lucide React |
| **Mobile framework** | React Native 0.81.5, Expo 54 |
| **Mobile navigation** | React Navigation 7 (native-stack + bottom-tabs) |
| **Mobile storage** | @react-native-async-storage/async-storage |
| **Mobile icons** | Lucide React Native, React Native SVG |
| **Deployment** | Render — Blueprint YAML, free PostgreSQL |

---

## Project Structure

```
backend/
├── requirements.txt
├── build.sh                      # Render build script
└── app/
    ├── main.py                   # FastAPI entry + APScheduler + lifespan migrations
    ├── config.py                 # Pydantic Settings (env vars, DB URL normalization)
    ├── database.py               # Async engine, session factory, get_db dependency
    ├── models.py                 # 15 SQLAlchemy ORM models
    ├── schemas.py                # Pydantic request/response schemas
    ├── ledger.py                 # Financial safety module (locking, validation, conservation)
    ├── idempotency.py            # @idempotent decorator — SHA-256 body hashing + DB keys
    ├── routes/
    │   ├── auth.py               # Register, login, JWT, password reset, admin diagnostics
    │   ├── groups.py             # Group CRUD + member management
    │   ├── expenses.py           # Expense CRUD + equal splitting + notifications
    │   ├── settlements.py        # Settlement record lifecycle (pending→sent→settled/declined)
    │   ├── payments.py           # Stripe PaymentIntent creation with safety guards
    │   ├── stripe_routes.py      # Stripe Connect onboarding, webhooks, reconciliation
    │   ├── plaid_routes.py       # Plaid Link token + access token exchange
    │   ├── bank_links.py         # Linked bank account CRUD
    │   ├── wallet.py             # Wallet balance + transaction ledger
    │   ├── requests.py           # Peer-to-peer payment requests
    │   ├── friends.py            # Friend request lifecycle
    │   ├── notifications.py      # Notification feed + mark read
    │   ├── reminders.py          # Expense reminder CRUD
    │   ├── me.py                 # Cross-group user data (payments, friends)
    │   └── users.py              # User search
    └── services/
        ├── balance_service.py    # Per-user balances + greedy settlement algorithm
        ├── reconciliation.py     # Admin: manual Stripe payment reconciliation
        ├── payment_reconciliation.py  # Background: auto-reconcile + expire stale payments
        └── reminder_scheduler.py     # Background: fire due reminder notifications

frontend/
└── src/
    ├── App.tsx                   # Router, auth guards, global auth error listener
    ├── context/AuthContext.tsx   # Global auth state (user, token, login, logout, refetch)
    ├── services/api.ts           # Typed API client (all 16 resource namespaces)
    ├── hooks/
    │   ├── useAutoRefresh.ts     # Poll + visibility change + focus re-fetch with debounce
    │   └── useScrollReveal.ts    # Intersection Observer scroll animations
    ├── utils/
    │   ├── balances.ts           # Client-side balance compute + greedy algo + isAllSettled
    │   └── currency.ts           # Null/NaN-safe formatCurrency()
    ├── pages/                    # 11 pages (Landing, Login, Register, Dashboard, Group, etc.)
    └── components/               # 20+ components (modals, cards, Stripe Elements, Plaid Link)

mobile/
└── src/
    ├── navigation/               # RootNavigator (Stack) + MainTabNavigator (bottom-tabs)
    ├── context/
    │   ├── AuthContext.tsx        # AsyncStorage token store, refreshUser, login, logout
    │   └── ThemeContext.tsx       # Dark/light mode, persisted to AsyncStorage
    ├── constants/Colors.ts        # Full semantic color token system (light + dark)
    ├── services/api.ts            # Same API but uses AsyncStorage for token
    ├── screens/                   # 8 screens (Dashboard, GroupDetail, Payments, Friends, ...)
    └── components/                # CustomTabBar, ThemeToggle
```

---

## API Endpoints (50+)

### Auth — `/api/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/register` | Create account, returns JWT |
| POST | `/login` | bcrypt verify, returns JWT |
| GET | `/me` | Current user profile |
| POST | `/forgot-password` | Send HTML reset email via Resend (rate limited) |
| POST | `/reset-password` | Validate JWT token, re-hash password |
| POST | `/admin/reset-all-passwords` | Admin — mass password reset emails |
| POST | `/admin/diagnose-hashes` | Admin — validate bcrypt hash integrity |

### Groups — `/api/groups`
| Method | Path | Description |
|---|---|---|
| POST | `/` | Create group |
| GET | `/` | List user's groups |
| GET | `/:id` | Group detail with members |
| POST | `/:id/members` | Add member by email |
| POST | `/:id/join` | Join by group ID (invite link target) |
| DELETE | `/:id` | Delete group (creator only) |
| DELETE | `/:id/members/:userId` | Remove member |

### Expenses — `/api/groups/:id/expenses`
| Method | Path | Description |
|---|---|---|
| POST | `/` | Create expense with equal split, notify participants |
| GET | `/` | List expenses |
| PUT | `/:expenseId` | Update expense |
| DELETE | `/:expenseId` | Delete expense |

### Balances & Settlements — `/api/groups/:id`
| Method | Path | Description |
|---|---|---|
| GET | `/balances` | Per-user net balance (paid − owed) |
| GET | `/settlements` | Greedy suggested settlement payments |

### Settlement Records — `/api/groups/:id/settlement-records`
| Method | Path | Description |
|---|---|---|
| POST | `/` | `@idempotent` — Create settlement record, notify payee |
| GET | `/` | List settlement records |
| PUT | `/:settlementId/status` | `@idempotent` — Status transition (pending→sent→settled/declined) |

### Payments (Stripe) — `/api/payments`
| Method | Path | Description |
|---|---|---|
| POST | `/create` | `@idempotent` — Create PaymentIntent with rate limiting, resume deduplication, and safety guards |

### Stripe Connect — `/api/stripe`
| Method | Path | Description |
|---|---|---|
| POST | `/onboard` | Create/retrieve Stripe Express account, return onboarding URL |
| GET | `/status` | Check if user's Stripe account is fully onboarded |
| POST | `/webhook` | Stripe webhook handler (idempotent via StripeEvent table) |
| POST | `/reconcile/:paymentId` | Manual: query Stripe, sync payment state |
| POST | `/cleanup` | Expire stale payments older than 24h |

### Plaid — `/api/plaid`
| Method | Path | Description |
|---|---|---|
| POST | `/create-link-token` | Generate Plaid Link token (auth + transactions, US + CA) |
| POST | `/set-access-token` | Exchange public token, store ProviderAccount |

### Bank Links — `/api/bank-links`
| Method | Path | Description |
|---|---|---|
| POST | `/` | Link a bank account |
| GET | `/` | List linked accounts |
| DELETE | `/:id` | Remove linked account |

### Wallet — `/api/wallet`
| Method | Path | Description |
|---|---|---|
| GET | `/balance` | User profile + cached balance (logs CRITICAL on drift) |
| GET | `/transactions` | Full ledger transaction history |

### Payment Requests — `/api/groups/:id/requests`
| Method | Path | Description |
|---|---|---|
| POST | `/` | `@idempotent` — Create P2P money request, notify payer |
| GET | `/` | List requests for current user in group |

### Friends — `/api/friends`
| Method | Path | Description |
|---|---|---|
| POST | `/requests` | Send friend request by email |
| GET | `/requests/pending` | List sent + received pending requests |
| PUT | `/requests/:id/accept` | Accept request, notify sender |
| PUT | `/requests/:id/decline` | Decline request |

### Notifications — `/api/notifications`
| Method | Path | Description |
|---|---|---|
| GET | `/` | Last 50 notifications |
| GET | `/unread-count` | Unread count |
| PUT | `/:id/read` | Mark notification read |
| PUT | `/read-all` | Mark all read |

### Expense Reminders — `/api/groups/:id/expenses/:id/reminder`
| Method | Path | Description |
|---|---|---|
| POST | `/` | Create/upsert recurring reminder (interval: 1–90 days, payer only) |
| GET | `/` | Get current reminder |
| DELETE | `/` | Cancel reminder (payer only) |

### Me — `/api/me`
| Method | Path | Description |
|---|---|---|
| GET | `/payments` | All settlement records across all groups |
| GET | `/friends` | Combined friends list (group members + accepted requests) |

### Users — `/api/users`
| Method | Path | Description |
|---|---|---|
| GET | `/search?query=` | Search by name or email (min 2 chars, max 10 results) |

### Admin — `/api/admin`
| Method | Path | Description |
|---|---|---|
| POST | `/reconcile-payments` | Find payments stuck in processing >1h, sync from Stripe |

---

## Financial Safety & How Payments Work

The payment architecture is the most technically rigorous part of the codebase. Here's how it works:

### The Ledger

Wallet balances are derived from a `WalletTransaction` table — a **double-entry ledger**. The `wallet_balance` column on the `User` model is a denormalized cache only. Every financial operation:

1. **Pre-validates** that `cached_balance == sum(completed_transactions)` — refuses to proceed if there's drift
2. Creates transactions as `PENDING`, promotes to `COMPLETED` after writing
3. **Asserts conservation of money** — total balance before == total balance after
4. **Verifies post-commit** — read-only check after the transaction commits (logs `CRITICAL` but never auto-fixes)

### Pessimistic Locking

Concurrent payment requests acquire **row-level locks** on User records using `SELECT ... FOR UPDATE`. When locking multiple users in a transfer, locks are always acquired in **sorted UUID order** to prevent deadlocks.

### Idempotency

The `@idempotent` decorator (in `app/idempotency.py`) protects all payment endpoints:
- Clients send an `Idempotency-Key` header
- The key + a **SHA-256 hash of the request body** are stored in the `idempotency_keys` table
- Retried requests with the same key return the cached response without re-executing
- If the key exists but the body hash differs → HTTP 422 (payload mismatch)
- DB-level `UNIQUE` constraint handles race conditions atomically — concurrent retries will get an `IntegrityError` and fall back to the cached result

### End-to-End Payment Flow

```
1. User A clicks "Pay $50" in the Group → Settlements tab
2. Frontend calls POST /api/payments/create
   ├── Rate limit check (max 5/min)
   ├── Verify payee has stripe_account_id (Stripe Connect)
   ├── Check for existing active Payment for this settlement
   │   ├── succeeded → return already_completed
   │   ├── processing → return existing client_secret (resume)
   │   └── stale → cancel old PaymentIntent, create fresh
   ├── Create Payment row (status: pending)
   ├── stripe.PaymentIntent.create(transfer_data.destination = B.stripe_account_id)
   └── Return client_secret to frontend

3. StripePaymentModal mounts Stripe Elements with client_secret
4. User A enters card details → stripe.confirmPayment()
5. Stripe processes payment and calls POST /api/stripe/webhook
   ├── Verify webhook signature
   ├── Check StripeEvent table (idempotency — silently ignore duplicates)
   ├── Retrieve Charge + Transfer, verify transfer.status == succeeded
   ├── Update Payment.status → succeeded
   ├── Update SettlementRecord.status → settled
   └── Insert StripeEvent record (committed atomically)

6. useAutoRefresh triggers loadAll() on GroupPage → UI reflects settled state
```

### Background Reconciliation

If the webhook is missed or delayed, two APScheduler jobs run continuously:
- **Every 30 minutes**: Find `Payment` records stuck in `processing` for >15 minutes → query Stripe SDK → sync state
- **Every 30 minutes**: Expire `Payment` records in `pending/processing` older than 24 hours
- **Manual endpoint**: `POST /api/admin/reconcile-payments` — same logic, on demand

---

## Real-Time Sync

Both web and mobile use `useAutoRefresh` — a polling hook that re-fetches data:
- On a configurable interval (default: **30 seconds**)
- When the browser tab becomes visible again
- When the window regains focus
- With a 5-second debounce to prevent event flooding

No WebSockets — deliberate simplicity.

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js** >= 18
- **Python** >= 3.11
- Optional: **Docker** (for local PostgreSQL)

### 1. Backend

```bash
cd backend
cp .env.example .env      # Fill in STRIPE_SECRET_KEY, PLAID_*, RESEND_API_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs available at `http://localhost:8000/docs`

The backend auto-creates all tables on first start. SQLite is used by default (no Docker needed for dev). Set `DATABASE_URL` in `.env` to switch to PostgreSQL.

### 2. Frontend Web

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

### 3. Mobile

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (iOS or Android), or press `i` for the iOS simulator.

### Local PostgreSQL (Optional)

```bash
docker-compose up -d    # Starts PostgreSQL on port 5432
# Then set DATABASE_URL=postgresql+asyncpg://splitease:splitease@localhost/splitease in backend/.env
```

---

## Deploy to Render

This project includes a `render.yaml` Blueprint for one-click deployment.

1. Push this repo to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. Connect your GitHub repo — Render auto-detects `render.yaml` and creates:
   - `splitease-api` — Python web service (Gunicorn + Uvicorn)
   - `splitease-web` — Static site (React)
   - `splitease-db` — Free PostgreSQL database
4. Set secret env vars manually on the API service:
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `PLAID_CLIENT_ID`, `PLAID_SECRET`
   - `RESEND_API_KEY`
   - `ADMIN_SECRET`
5. Trigger a redeploy

> **Note:** Free tier services spin down after 15 min of inactivity. The first request after sleep takes ~30-60 seconds.

---

## Environment Variables

Copy `backend/.env.example` and fill in these values:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | No | Defaults to SQLite. Set to `postgresql+asyncpg://...` for Postgres |
| `SECRET_KEY` | Yes | JWT signing secret |
| `STRIPE_SECRET_KEY` | Yes (payments) | Stripe secret key (`sk_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Yes (payments) | Stripe publishable key (`pk_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes (payments) | Webhook endpoint signing secret (`whsec_...`) |
| `PLAID_CLIENT_ID` | Yes (bank linking) | Plaid client ID |
| `PLAID_SECRET` | Yes (bank linking) | Plaid sandbox/production secret |
| `PLAID_ENV` | No | `sandbox` (default) or `production` |
| `RESEND_API_KEY` | Yes (email) | Resend API key |
| `RESEND_FROM_EMAIL` | No | Defaults to `noreply@tandempay.ca` |
| `FRONTEND_URL` | No | Used for password reset links |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `ADMIN_SECRET` | Yes (admin routes) | Secret header value for admin endpoints |

---

## Database Models (15)

| Model | Description |
|---|---|
| `User` | Accounts — UUID PK, bcrypt hash, wallet balance cache, Stripe account ID, Interac email |
| `Group` | Shared expense groups |
| `GroupMember` | Join table (group x user) |
| `Expense` | A single expense with split type and payer |
| `ExpenseParticipant` | Per-member share amount for an expense |
| `SettlementRecord` | Real payment tracking — status lifecycle, method |
| `Notification` | In-app notification feed |
| `ExpenseReminder` | Recurring reminder config with interval and next fire time |
| `FriendRequest` | Friend invitation by email (pending / accepted / declined) |
| `ProviderAccount` | Linked bank accounts via Plaid |
| `WalletTransaction` | Financial ledger — every money movement |
| `PaymentRequest` | Peer-to-peer direct money request |
| `Payment` | Stripe PaymentIntent tracker (cents, status) |
| `StripeEvent` | Webhook idempotency — processed Stripe event IDs |
| `IdempotencyKey` | Request-level idempotency keys with SHA-256 body hash |

All monetary columns use `Numeric(12, 2, asdecimal=True)` — exact decimal, no floats.
All PKs are UUIDs.

---

## License

MIT
