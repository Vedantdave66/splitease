# SplitEase Backend — System Evolution Document

> **Audience**: Engineers, technical interviewers, and portfolio reviewers.
> **Scope**: Full architectural evolution from MVP to production-grade fintech backend.

---

## 1. Initial System (Baseline)

### Original Architecture

SplitEase started as a standard **FastAPI + SQLAlchemy** expense-splitting app with:

| Layer | Technology |
|-------|-----------|
| Framework | FastAPI (async, Python 3.11) |
| ORM | SQLAlchemy 2.0 (async via `aiosqlite` / `asyncpg`) |
| Auth | JWT (python-jose) + bcrypt |
| DB | SQLite (dev), PostgreSQL (prod via Render) |
| External APIs | Stripe (payments), Plaid (bank linking), Resend (email) |

### Early Features
- User registration/login with JWT tokens
- Group creation with member management
- Expense tracking with equal/custom splits
- Balance computation (greedy debt simplification algorithm)
- Settlement records (e-transfer tracking with `pending → sent → settled` state machine)
- Friend requests via email
- In-app notifications

### Major Risks in the Initial Version

| Risk | Description |
|------|-------------|
| **No idempotency** | Duplicate POST requests could create duplicate expenses, settlements, or wallet transactions |
| **No row-level locking** | Concurrent requests could read stale balances and produce incorrect mutations |
| **Float arithmetic** | [wallet_balance](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_idempotency_concurrency.py#138-143) was `Float` — accumulating `0.01` across 10,000 transactions produces `100.00000000000014` |
| **No ledger** | Balance was a mutable column with no audit trail — impossible to detect or recover from corruption |
| **No transaction boundaries** | Partial failures could leave the system in inconsistent states |

---

## 2. Critical Issues Discovered

### Issue 1: Idempotency Race Condition

**What**: Without idempotency keys, a network retry or double-click would execute the same financial operation twice. A $50 deposit retried once becomes $100.

**Why dangerous**: In production, mobile clients retry on timeout. Load balancers retry on 502. Payment processors retry webhooks. Every retry is a potential duplicate charge.

**Real-world impact**: User adds $50 to wallet → network blip → client retries → user now has $100. This is **free money** — a direct financial loss for the platform.

---

### Issue 2: TOCTOU (Time-of-Check to Time-of-Use) Vulnerability

**What**: The payment flow was:
```
1. READ PaymentRequest.status → "pending"       ← Time of Check
2. Process payment, update balances
3. SET PaymentRequest.status = "settled"          ← Time of Use
```

Between steps 1 and 3, another concurrent request could also read `status = "pending"` and process the same payment.

**Why dangerous**: Two concurrent requests to pay the same $100 PaymentRequest both see `pending`, both deduct $100 from the payer, both credit $100 to the requester. The payer loses $200 instead of $100. The requester gains $200 instead of $100.

---

### Issue 3: Float Precision Errors

**What**: [wallet_balance](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_idempotency_concurrency.py#138-143) was stored as `Float`. Python's `float` cannot represent `0.1` exactly — it's stored as `0.1000000000000000055511151231257827021181583404541015625`.

**Why dangerous**: After 10,000 transactions of $0.01:
```python
>>> sum([0.01] * 10000)
100.00000000000014    # ← NOT 100.00
```
This "drift" accumulates silently. Reconciliation reports show phantom discrepancies. Users see incorrect balances. Regulatory audits fail.

---

### Issue 4: Stripe Idempotency Key Shadowing Bug

**What**: In the original [stripe_routes.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/routes/stripe_routes.py), the idempotency key from the HTTP header was being read into a local variable that was shadowed before reaching the Stripe API call. The key was never forwarded to Stripe's `PaymentIntent.create()`.

**Why dangerous**: If the server crashed after Stripe charged the user's bank account but before our DB committed, the client retry would call Stripe **again** — creating a **duplicate bank debit**. The user is charged twice for one payment. Stripe's idempotency protection was completely bypassed.

---

### Issue 5: No Atomicity Guarantee

**What**: The wallet update flow was:
```python
user.wallet_balance += amount  # Mutation 1
db.add(WalletTransaction(...))  # Mutation 2
db.add(Notification(...))       # Mutation 3
# If exception after mutation 1 but before commit...
# → wallet_balance changed, but no ledger entry exists
```

**Why dangerous**: A crash between mutations creates **partial state** — the cached balance disagrees with the ledger. Without a reconciliation mechanism, this corruption is silent and permanent.

---

## 3. System Refactors & Fixes

### 3.1 Idempotency Redesign

**What changed**: Added a full [idempotency infrastructure](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/idempotency.py) with:

- **[IdempotencyKey](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/idempotency.py#44-61) model** with `UniqueConstraint("key", "user_id", "endpoint")`
- **`@idempotent` decorator** wrapping payment-critical route handlers
- **SHA-256 request body hashing** to detect payload conflicts (same key, different body → HTTP 422)
- **24-hour TTL** for key expiration

**How it works**:
```
Request arrives with Idempotency-Key header
  │
  ├─ SELECT existing key (fast path for sequential retries)
  │   ├─ Found + same hash → return cached response
  │   └─ Found + different hash → HTTP 422 rejection
  │
  └─ Not found → execute handler → INSERT record
      └─ UniqueConstraint catches concurrent races:
          If INSERT fails (IntegrityError) → entire transaction rolls back
          Client retries → SELECT finds committed record → cached response
```

**Why this design**: The `UniqueConstraint` is the **database-level safety net**. Even if two concurrent requests both pass the SELECT check (because neither has committed yet), the INSERT will fail for whichever commits second. This is fundamentally safer than application-level locking because the constraint is enforced by PostgreSQL's MVCC, not by Python code.

---

### 3.2 Row-Level Locking Strategy

**What changed**: Added [lock_users_sorted](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#L158-L166) — pessimistic `SELECT FOR UPDATE` with **deterministic sorted ordering** to prevent deadlocks.

**How it works**:
```python
async def lock_users_sorted(user_ids: list[str], db: AsyncSession) -> dict[str, User]:
    locked = {}
    for uid in sorted(user_ids):  # ← deterministic order prevents deadlocks
        locked[uid] = await lock_user_for_update(uid, db)
    return locked
```

**Why sorted order**: If Request A locks User 1 then User 2, and Request B locks User 2 then User 1, a deadlock occurs. Sorting by user ID ensures all requesters lock in the same order — eliminating deadlocks entirely.

**PostgreSQL behavior**: `SELECT ... FOR UPDATE` acquires a row-level exclusive lock. Any other transaction attempting `FOR UPDATE` on the same row **blocks** until the first transaction commits or rolls back. On SQLite, `FOR UPDATE` is a no-op.

---

### 3.3 Payment Flow Redesign (9-Step Protocol)

**What changed**: The [pay_request_with_wallet](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/routes/requests.py#L133-L331) handler was redesigned into a 9-step protocol:

| Step | Action | Purpose |
|------|--------|---------|
| 1 | Idempotency check | `@idempotent` decorator |
| 2 | Load + validate request state | No writes yet — read-only check |
| 3 | Lock users (sorted order) | Prevent concurrent mutations + deadlocks |
| 3.5 | Re-fetch request `FOR UPDATE` | TOCTOU protection: re-check status under lock |
| 4 | Pre-validate balances | Assert `cached == ledger` BEFORE any writes |
| 5 | Create PENDING ledger entries | Double-entry: `transfer_out` + `transfer_in` |
| 6 | Compute new balances in memory | Pure arithmetic, no DB writes yet |
| 7 | Conservation-of-money invariant | Assert `total_before == total_after` |
| 8 | Atomic write | Promote `pending → completed`, update caches, set `settled` |
| 9 | Post-commit verification | Read-only check, logs but never auto-fixes |

**Step 3.5 is the TOCTOU fix**: After acquiring user locks, the PaymentRequest is re-fetched with `FOR UPDATE`. If another transaction settled it between steps 2 and 3.5, the status will no longer be `pending` and the request is rejected with 400.

---

### 3.4 Double-Entry Ledger

**What changed**: Added [WalletTransaction](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py#L152-L167) model as the **single source of truth** for all money movement.

**Design principles**:
- [wallet_balance](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_idempotency_concurrency.py#138-143) on [User](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py#10-25) is a **cache** — it can always be recomputed from the ledger
- Every money movement creates a [WalletTransaction](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py#152-168) with type ([deposit](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_idempotency_concurrency.py#145-157), `withdrawal`, `transfer_in`, `transfer_out`)
- Transactions start as `pending` and are promoted to `completed` only within the atomic commit
- The [compute_wallet_balance](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#L24-L38) function derives the true balance: `SUM(amount) WHERE status = 'completed'`

**Invariant checks**:
- [pre_validate_balance](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#L41-L61): Assert `cached == ledger` BEFORE any mutation (catches pre-existing corruption)
- [validate_balance_integrity](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#L64-L81): Assert `cached == ledger` AFTER mutation (catches bugs in the current transaction)
- [assert_conservation_of_money](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#L84-L120): Assert `total_before == total_after` for every transfer

---

### 3.5 Decimal Precision Upgrade

**What changed**: All financial columns migrated from `Float` to `Numeric(12, 2, asdecimal=True)`. All application math uses `Decimal` with explicit `quantize(Decimal("0.01"))`.

**Files affected**: [models.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py) (6 columns across [User](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py#10-25), [Expense](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py#52-66), [ExpenseParticipant](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py#68-77), [SettlementRecord](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py#80-97), [WalletTransaction](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py#152-168), [PaymentRequest](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/models.py#170-188)), [ledger.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py), [wallet.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/routes/wallet.py), [requests.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/routes/requests.py), [balance_service.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/services/balance_service.py).

**Result**: `Decimal("0.01") * 10000 == Decimal("100.00")` — exactly, always.

---

### 3.6 Stripe Idempotency Key Fix

**What changed**: In [stripe_routes.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/routes/stripe_routes.py#L113-L158), the idempotency key is now:
1. Extracted from `request.headers.get("Idempotency-Key")` into `stripe_idem_key`
2. Passed directly to `stripe.PaymentIntent.create(**stripe_kwargs)` via `idempotency_key=stripe_idem_key`
3. A warning is logged if the key is missing

**End-to-end protection**: Client → SplitEase API (our `@idempotent` decorator) → Stripe API (Stripe's native idempotency). Both layers are protected.

---

### 3.7 Reconciliation Service

**What changed**: Added [reconciliation.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/services/reconciliation.py) providing:
- `GET /api/admin/reconciliation` — compare every user's cached balance vs. ledger sum
- `POST /api/admin/reconciliation/fix` — auto-correct drifted balances

**Design philosophy**: The payment flow's invariant checks should prevent drift entirely. Reconciliation is a **safety net**, not a primary mechanism. If reconciliation ever finds a discrepancy, it means there is a bug in the transaction logic that must be investigated.

---

## 4. Testing Evolution

### Stage 1: Sequential Testing (SQLite)

**Files**: [test_idempotency_concurrency.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_idempotency_concurrency.py), [test_payment_concurrency.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_payment_concurrency.py), [test_financial_precision.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_financial_precision.py), [test_stripe_idempotency.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_stripe_idempotency.py)

**What was tested**:
- Idempotency key reuse → cached response (6 tests: same payload, different payload, multiple retries, no key, different keys, withdraw)
- Payment request double-pay → 400 rejection (3 tests)
- Decimal precision: 3-way split exactness, 10K transaction drift check, ledger-vs-cached consistency
- Stripe key forwarding: retry safety, missing key warning, crash simulation

**Limitations**:
- All requests were **sequential** ([for](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/routes/auth.py#144-167) loops with `await`) — not concurrent
- SQLite's `FOR UPDATE` is a **no-op** — row-level locking was never actually exercised
- SQLite serializes all writes — true race conditions were impossible to trigger
- These tests prove **logic correctness**, not **concurrency safety**

**Confidence gained**: The idempotency, ledger, and Decimal logic is functionally correct under sequential execution.

---

### Stage 2: Real Concurrency Testing (PostgreSQL + asyncio.gather)

**File**: [test_pg_concurrency.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_pg_concurrency.py)

**Infrastructure**: Docker Compose with PostgreSQL 16 on port 5433 (tmpfs-backed for speed).

**What was tested** (5 tests, all using `asyncio.gather`):

| Test | Requests | Proves |
|------|----------|--------|
| A: Idempotency Race | 10 parallel, same idem key | `UniqueConstraint` prevents duplicates under true contention |
| B: Double-Spend | 5 parallel pay on same PaymentRequest | `SELECT FOR UPDATE` + status re-check blocks double-payment |
| C: Wallet Drain | 3× $50 on $100 balance | Balance **never goes negative** under concurrent withdrawals |
| D: Lock Proof | 2 raw sessions, FOR UPDATE | Session 2 blocks ~2s proving real row-level locking |
| E: Parallel Deposits | 5 parallel, different keys | Serialization works without rejecting valid requests |

**What was different from Stage 1**:
- True `asyncio.gather` parallelism — requests actually overlap in execution
- PostgreSQL's `FOR UPDATE` actually blocks — not a no-op
- `UniqueConstraint` races are real — `IntegrityError` actually fires
- Lock contention timing is measurable (Test D proves ~2s blocking)

**Confidence gained**: The system's concurrency guarantees hold under real database contention, not just sequential logic.

---

### Stage 3: Failure Injection Testing

**File**: [test_pg_failure_injection.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_pg_failure_injection.py)

**What was tested** (4 tests):

| Test | Failure Simulated | Injection Method |
|------|-------------------|-----------------|
| A: Crash after commit | Server dies after `session.commit()` but before HTTP response | Custom [get_db_crashable](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_pg_failure_injection.py#108-132) that raises after commit |
| B: In-flight retry | Overlapping requests (second arrives while first is processing) | `asyncio.gather` with 50ms stagger |
| C: Partial failure | Exception between `db.flush()` and `db.commit()` | `mock.patch` on [validate_balance_integrity](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#64-82) |
| D: Retry storm | 5 staggered retries at 50ms intervals | `asyncio.gather` with delays |

**Confidence gained**:
- After a crash-after-commit, the **retry correctly returns the cached response** from the idempotency table (Test A)
- **Partial failures result in complete rollback** — zero partial state survives (Test C)
- **Staggered retry storms** from flaky networks cannot penetrate the idempotency barrier (Test D)

---

## 5. Current System Guarantees

| Guarantee | Mechanism | Tested By |
|-----------|-----------|-----------|
| **No duplicate financial execution** | `IdempotencyKey.UniqueConstraint` + `@idempotent` decorator | PG concurrency Test A, Failure Test A/D |
| **No double-payment for a request** | `SELECT FOR UPDATE` on PaymentRequest + status re-check | PG concurrency Test B |
| **No negative balances** | `SELECT FOR UPDATE` on User + balance check under lock | PG concurrency Test C (wallet drain) |
| **No balance drift** | `Numeric(12,2)` + `Decimal` math throughout | Financial precision Tests A/B/C |
| **Atomic transactions** | All mutations in single [get_db](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/database.py#15-35) session; exception → full rollback | Failure Test C (partial failure) |
| **Cached balance == ledger** | [pre_validate_balance](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#41-62) + [validate_balance_integrity](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#64-82) invariant checks | Every PG test via [assert_ledger_consistency()](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/tests/test_pg_concurrency.py#318-327) |
| **Conservation of money** | [assert_conservation_of_money](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#84-121) checks `total_before == total_after` | Enforced in [pay_request_with_wallet](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/routes/requests.py#133-332) Step 7 |
| **Idempotent external API calls** | Client Idempotency-Key forwarded to Stripe's `PaymentIntent.create()` | Stripe idempotency Tests A/B/C |
| **Deadlock prevention** | [lock_users_sorted](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#158-167) acquires locks in deterministic sorted order | Architectural guarantee |
| **Crash recovery** | Idempotency record committed with business data; retry finds cache | Failure Test A |

---

## 6. Failure Scenarios Covered

### Retry After Success
```
Client sends request → Server processes → Client sees 200
Client retries (double-click, mobile app bug, aggressive retry policy)
→ @idempotent SELECT finds existing key → returns cached response
→ No duplicate execution
```

### Concurrent Requests (Same Operation)
```
10 requests arrive simultaneously with same idempotency key
→ All pass SELECT check (none committed yet)
→ All execute handler
→ First to commit wins (INSERT succeeds)
→ Others hit UniqueConstraint → IntegrityError → full rollback
→ Retried requests find committed record → cached response
→ Exactly 1 execution
```

### Crash After Commit, Before Response
```
Handler runs → session.commit() succeeds → process crashes
→ All data persisted (including idempotency record)
→ Client sees timeout/500
→ Client retries with same key
→ @idempotent SELECT finds committed record → cached response
→ No duplicate
```

### Partial Failure (Exception Before Commit)
```
Handler runs → db.flush() sends SQL → exception raised
→ get_db except block → session.rollback()
→ ALL changes undone (flush is not commit)
→ Client retries → clean slate → handler executes normally
→ Zero partial state
```

### External API Crash
```
Server calls Stripe with Idempotency-Key → Stripe charges bank
→ Server crashes before DB commit
→ Our idempotency record NOT saved (rolled back)
→ Client retries → our @idempotent passes (no cached record)
→ Handler calls Stripe again WITH SAME KEY
→ Stripe returns cached response (Stripe's own idempotency)
→ No duplicate bank charge
```

---

## 7. Known Limitations

> [!WARNING]
> These are honest assessments of what has **not** been validated.

| Limitation | Impact | Mitigation Path |
|------------|--------|-----------------|
| **No multi-instance testing** | Row-level locks work within a single DB, but the app hasn't been tested behind a load balancer with multiple FastAPI instances | PostgreSQL locks are connection-scoped, not process-scoped — this should work, but hasn't been proven |
| **No large-scale load testing** | Tests use 5-10 concurrent requests. Production might see 100+ simultaneous wallet operations | Need k6/Locust load test with sustained throughput |
| **No distributed transaction testing** | Stripe + DB commit are not in a two-phase commit. A crash between Stripe charge and DB commit relies on Stripe's idempotency | True 2PC would require a transaction coordinator (e.g., Saga pattern) |
| **Auto-migration is fragile** | [main.py](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/main.py) uses raw `ALTER TABLE` with `try/except` for schema changes | Should use Alembic for production migrations |
| **Reconciliation is manual** | Admin must call `/api/admin/reconciliation` to detect drift | Should be a scheduled job (cron/Celery beat) |
| **No rate limiting on retries** | A malicious client could send thousands of unique idempotency keys to flood the system | Need per-user rate limiting on financial endpoints |
| **SQLite ↔ PostgreSQL parity** | Sequential SQLite tests don't exercise PG-specific behavior (advisory locks, MVCC conflicts) | PG tests exist but must be run separately via Docker |
| **No chaos engineering** | Tests simulate specific failure points, not random failures | Need tools like toxiproxy or chaos-monkey for network partition simulation |

---

## 8. Final System Architecture (Current State)

### Wallet Deposit Flow
```
Client                          FastAPI                          PostgreSQL
  │                                │                                │
  │ POST /api/wallet/add-funds     │                                │
  │ + Idempotency-Key: abc123      │                                │
  │ + {amount: 50, source: "Bank"} │                                │
  │──────────────────────────────→ │                                │
  │                                │ @idempotent: SELECT key=abc123 │
  │                                │──────────────────────────────→ │
  │                                │ ← not found                    │
  │                                │                                │
  │                                │ lock_user_for_update(user_id)  │
  │                                │ → SELECT ... FOR UPDATE        │
  │                                │──────────────────────────────→ │
  │                                │ ← locked User row              │
  │                                │                                │
  │                                │ pre_validate(cached == ledger) │
  │                                │──────────────────────────────→ │
  │                                │ ← SUM(completed) == cached ✓   │
  │                                │                                │
  │                                │ INSERT WalletTransaction       │
  │                                │   (pending → completed)        │
  │                                │ UPDATE User.wallet_balance     │
  │                                │ INSERT Notification            │
  │                                │ INSERT IdempotencyKey          │
  │                                │──────────────────────────────→ │
  │                                │                                │
  │                                │ COMMIT (all-or-nothing)        │
  │                                │──────────────────────────────→ │
  │ ← 200 OK {wallet_balance: 1050}│                                │
```

### Payment Request Flow
```
 Step 1     Step 2      Step 3          Step 3.5        Step 4-7       Step 8
┌────────┐ ┌────────┐  ┌─────────────┐ ┌────────────┐  ┌───────────┐  ┌────────┐
│@idemp. │→│Load PR │→ │Lock users   │→│Re-fetch PR │→ │Validate + │→ │Atomic  │
│check   │ │status  │  │sorted order │ │FOR UPDATE  │  │create     │  │commit  │
│        │ │check   │  │(deadlock    │ │(TOCTOU     │  │double-    │  │        │
│        │ │        │  │ prevention) │ │ protection)│  │entry txns │  │        │
└────────┘ └────────┘  └─────────────┘ └────────────┘  └───────────┘  └────────┘
```

### Idempotency Mechanism
```
                    ┌──────────────────────┐
                    │ Idempotency-Key      │
                    │ header present?      │
                    └──────┬───────────────┘
                           │
                    ┌──────▼───────────────┐
                    │ SELECT existing key   │
                    └──────┬───────────────┘
                     ┌─────┴─────┐
                     │           │
                ┌────▼───┐ ┌────▼─────────┐
                │ Found  │ │ Not found    │
                └────┬───┘ └────┬─────────┘
                     │          │
              ┌──────▼──────┐   │
              │Same hash?   │   │
              └──┬──────┬───┘   │
               Yes      No     │
                │        │      │
          ┌─────▼──┐ ┌──▼───┐  │
          │ Return │ │ 422  │  │
          │ cached │ │reject│  │
          └────────┘ └──────┘  │
                               │
                        ┌──────▼──────────┐
                        │ Execute handler  │
                        │ INSERT record    │
                        │ COMMIT           │
                        └──────┬──────────┘
                               │
                        UniqueConstraint
                        catches races  ───→ Rollback
                                            Client retries
                                            → cache hit ✓
```

---

## 9. Key Engineering Learnings

### 1. Database constraints > application logic

The `UniqueConstraint` on `idempotency_keys` is the **one line of code** that makes the entire idempotency system safe under concurrency. Application-level checks (`SELECT` before `INSERT`) are necessary for performance (fast path for sequential retries) but are **not sufficient** for correctness under parallel execution. The constraint is evaluated by PostgreSQL's MVCC at commit time — it cannot be circumvented by timing.

### 2. Concurrency must be proven, not assumed

The SQLite test suite passed every idempotency test — and yet the system had **never actually exercised row-level locking**. `FOR UPDATE` was silently a no-op on SQLite. It was only by running against PostgreSQL with `asyncio.gather` that we could prove the locks actually block, the constraints actually fire, and the wallet drain scenario actually works. **A test that passes on the wrong database proves nothing about production safety.**

### 3. Financial systems require invariant-based testing

Traditional assertion testing (`assert balance == 1050`) catches correctness. Invariant-based testing (`assert cached == ledger`, `assert total_before == total_after`) catches **classes of bugs**. The conservation-of-money invariant doesn't just check one scenario — it checks a mathematical property that must hold for every transfer, regardless of amounts, users, or concurrency patterns.

### 4. Flush ≠ commit

`db.flush()` sends SQL to the database **within the current transaction**. `db.commit()` makes it permanent. An exception after flush but before commit results in **complete rollback**. This distinction is critical: it allows the system to write ledger entries, perform invariant checks, and only commit if everything is correct. The flush-check-commit pattern is the backbone of the atomic write strategy.

### 5. Failure injection reveals architectural gaps

Sequential tests prove that correct inputs produce correct outputs. Failure injection proves that **incorrect or interrupted inputs cannot corrupt state**. The crash-after-commit test revealed that the idempotency record must be committed atomically with the business data — otherwise a gap exists where committed data has no idempotency protection.

### 6. Sorted locking prevents deadlocks by construction

Rather than detecting and recovering from deadlocks (reactive), sorting the lock acquisition order prevents them entirely (proactive). This is cheaper, simpler, and more reliable. The sorted-lock pattern applies anywhere multiple resources are locked in a single transaction.

### 7. The ledger is the source of truth, the balance column is a cache

Making this distinction explicit (and enforcing it with [pre_validate_balance](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#41-62) and [validate_balance_integrity](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/backend/app/ledger.py#64-82)) means that even if a bug corrupts the cache, the system can always recover by recomputing from the ledger. The reconciliation service exists precisely for this purpose — but ideally, the invariant checks ensure it's never needed.
