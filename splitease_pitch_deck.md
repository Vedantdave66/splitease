# SplitEase — Pitch Deck

---

## 🎯 The Problem

Splitting expenses among friends, roommates, and travel groups is **painful**. People forget who paid for what, awkward "you owe me" conversations happen, and settling up requires mental math, spreadsheets, or apps that feel clunky and outdated.

- **70% of millennials and Gen-Z** regularly split costs with others (rent, trips, dinners).
- Existing solutions (Splitwise, Venmo, etc.) either lack smart debt simplification, don't support Canadian payment methods (Interac e-Transfer), or charge premium fees.
- Users want a **modern, fast, free** tool that handles the entire lifecycle: tracking → calculating → settling.

---

## 💡 The Solution — SplitEase

**SplitEase** is a modern, full-stack fintech web application that lets users **track shared expenses, automatically simplify group debts, and settle up** — all in a stunning, premium dark-mode interface.

**Live App:** [https://splitease-web.onrender.com](https://splitease-web.onrender.com)

---

## ✨ Key Features

### 1. Group Expense Management
- **Create unlimited groups** for trips, roommates, dinners, events, etc.
- **Add expenses** with a title, amount, and who paid.
- **Equal splitting** automatically divides costs among selected participants.
- **Edit / delete** expenses at any time.
- **Invite members** by email — they get notified and can join instantly.

### 2. Smart Debt Simplification (Greedy Algorithm)
- Automatically calculates **who owes whom** within each group.
- Uses a **greedy settlement algorithm** that minimizes the total number of payments needed.
- Example: If Alice owes Bob $20, Bob owes Charlie $20 → SplitEase simplifies it to: **Alice pays Charlie $20** (1 payment instead of 2).

### 3. Settlement Tracking & Payment Flow
- **"Settle Up" modal** shows exactly how much you owe and to whom.
- Supports two payment methods:
  - **In-App Wallet** — pay directly from your SplitEase wallet balance.
  - **Interac e-Transfer** — copies the recipient's Interac email so you can send money from your bank.
- **Payment status tracking**: `Pending → Sent → Settled` (or `Declined`).
- Both payer and payee can update the settlement status.

### 4. In-App Digital Wallet
- **Add funds** to your SplitEase wallet from linked bank accounts.
- **Withdraw funds** back to your bank.
- **Pay friends directly** from your wallet balance for instant group settlements.
- Full **transaction history** (deposits, withdrawals, transfers in/out).

### 5. Bank Account Linking (Plaid Integration)
- Securely link real bank accounts via **Plaid** (industry standard used by Venmo, Robinhood, etc.).
- Plaid Link UI handles all the bank authentication — SplitEase never sees your bank credentials.
- Linked accounts display institution name and masked account number.
- Supports linking/unlinking multiple accounts.

### 6. Stripe Payment Processing
- **Stripe Connect** onboarding for users who want to receive payments.
- **Payment Intents** for secure, PCI-compliant card payments.
- Stripe handles all the compliance, fraud prevention, and money movement.

### 7. Friend System & Social Layer
- **Send friend requests** by email.
- **Accept / decline** incoming requests.
- **User search** — find other SplitEase users by name or email with live suggestions.
- **Friends list** shows shared group count.

### 8. Payment Requests
- **Request money** from specific group members with a custom note and optional due date.
- Recipients see the request and can **pay with their wallet** in one click.
- Status tracking: `Pending → Awaiting Payment → Processing → Settled`.

### 9. Real-Time Notifications
- **In-app notification bell** with unread count badge.
- Notifications for key events:
  - New expense added to your group
  - Settlement requested / payment sent / payment confirmed
  - Member added to group
  - Friend request received
- Mark individual or all notifications as read.

### 10. Secure Authentication
- **JWT-based authentication** with bcrypt password hashing.
- **Password reset flow** via email (Resend API) with time-limited tokens (15 min expiry).
- **Forgot Password** → email with reset link → set new password → login.
- Protection against email enumeration attacks.

### 11. Premium Dark-Mode UI
- **Glassmorphism** design with ambient background glows.
- **Smooth micro-animations** and hover effects throughout.
- **Responsive design** — works on desktop, tablet, and mobile browsers.
- **Landing page** with hero section, feature grid, and interactive "how it works" section.
- Custom avatar colors assigned to each user for visual identification.

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 19, TypeScript, TailwindCSS v4, Vite | Modern, fast, type-safe UI with instant HMR |
| **Backend** | FastAPI (Python), async SQLAlchemy, Pydantic | High-performance async API with auto-generated docs |
| **Database** | SQLite (dev) / PostgreSQL (prod) | Zero-config locally, production-grade on deploy |
| **Authentication** | JWT + bcrypt | Industry-standard stateless auth |
| **Payments** | Stripe Connect + Payment Intents | PCI-compliant payment processing |
| **Bank Linking** | Plaid Link | Secure bank account verification |
| **Email** | Resend API | Reliable transactional email delivery |
| **Hosting** | Render (Web Service + Static Site + PostgreSQL) | Free tier, auto-deploy from GitHub |
| **Mobile** | React Native + Expo (in progress) | Cross-platform native mobile app |

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                    │
│  Landing • Login • Register • Dashboard • Groups • Payments  │
│  Friends • Notifications • Wallet • Bank Links               │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTPS / REST API
┌──────────────────────▼───────────────────────────────────────┐
│                    BACKEND (FastAPI)                          │
│  14 Route Modules • JWT Auth • Async SQLAlchemy              │
│  ┌─────────┐ ┌────────┐ ┌────────┐ ┌──────────┐            │
│  │  Auth   │ │ Groups │ │Expenses│ │Settlements│            │
│  └─────────┘ └────────┘ └────────┘ └──────────┘            │
│  ┌─────────┐ ┌────────┐ ┌────────┐ ┌──────────┐            │
│  │ Wallet  │ │Friends │ │Notific.│ │ Requests │            │
│  └─────────┘ └────────┘ └────────┘ └──────────┘            │
│  ┌─────────┐ ┌────────┐ ┌────────┐                          │
│  │  Plaid  │ │ Stripe │ │ Users  │                          │
│  └─────────┘ └────────┘ └────────┘                          │
└──────┬───────────┬───────────┬───────────────────────────────┘
       │           │           │
  ┌────▼────┐ ┌────▼────┐ ┌───▼──────┐
  │ Plaid   │ │ Stripe  │ │PostgreSQL│
  │   API   │ │   API   │ │  (Render)│
  └─────────┘ └─────────┘ └──────────┘
```

---

## 📊 Database Schema (9 Models)

| Model | Purpose |
|-------|---------|
| **User** | Account info, wallet balance, avatar, Interac email, Stripe account ID |
| **Group** | Named expense groups with creator reference |
| **GroupMember** | Many-to-many join between Users and Groups |
| **Expense** | Individual expense with amount, payer, split type |
| **ExpenseParticipant** | Who participates in each expense + their share |
| **SettlementRecord** | Actual payment transactions between users (status-tracked) |
| **Notification** | In-app notifications for all group activity events |
| **FriendRequest** | Pending/accepted/declined friend connections |
| **ProviderAccount** | Linked bank accounts via Plaid |
| **WalletTransaction** | Internal ledger for all wallet money movement |
| **PaymentRequest** | P2P money requests within groups |

---

## 📡 Full API (40+ Endpoints)

| Category | Endpoints | Description |
|----------|----------|-------------|
| **Auth** | Register, Login, Me, Forgot Password, Reset Password | JWT auth with email verification |
| **Groups** | Create, List, Get, Join, Delete, Add/Remove Members | Full group lifecycle |
| **Expenses** | Create, List, Update, Delete per group | Expense CRUD with participant splitting |
| **Balances** | Get balances, Get settlement suggestions per group | Greedy debt simplification algorithm |
| **Settlements** | Create, List, Update status per group | Payment tracking with status flow |
| **Notifications** | List, Unread count, Mark read, Mark all read | Real-time activity feed |
| **Friends** | Send request, Get pending, Accept, Decline | Social network layer |
| **Users** | Search by name/email | User discovery |
| **Wallet** | Add funds, Withdraw, Get balance, Transaction history | Digital wallet management |
| **Bank Links** | Link, List, Remove accounts | Plaid-powered bank connections |
| **Plaid** | Create link token, Set access token | Plaid Link integration |
| **Stripe** | Onboard, Get status, Create payment intent | Stripe Connect payments |
| **Requests** | Create, List, Pay with wallet | P2P payment requests |

---

## 🖥️ Frontend Pages (10 Pages, 15 Components)

| Page | Description |
|------|-------------|
| **Landing Page** | Hero section with gradient text, feature grid, interactive demo card |
| **Register** | Name, email, password, optional Interac email |
| **Login** | Email + password with "Forgot Password" link |
| **Forgot Password** | Email input → sends reset link via Resend API |
| **Reset Password** | Token-validated new password form |
| **Dashboard** | Group list with member counts, total expenses, quick-create group |
| **Group Detail** | Expenses list, balance bubbles, settle up modal, add expense modal, member management |
| **Payments** | All settlement records across groups, status badges, update actions |
| **Friends** | Friends list, pending requests, search users, send requests |
| **Invite** | Shareable group invite link handling |

### Key UI Components
- `SettleUpModal` — Full settlement flow with Interac e-Transfer or wallet payment
- `AddExpenseModal` — Quick expense creation with participant selection
- `AddFundsModal` — Wallet top-up from linked bank accounts
- `LinkBankModal` — Plaid Link integration for bank account connection
- `RequestMoneyModal` — P2P payment request with note and due date
- `NotificationBell` — Real-time notification dropdown with unread badges
- `BalanceBubble` — Visual balance indicators (green = owed, red = owes)
- `ThemeToggle` — Dark/light mode switching

---

## 🚀 Deployment & Infrastructure

- **Render Blueprint** ([render.yaml](file:///c:/Users/vedan/.gemini/antigravity/playground/splitease/render.yaml)) for one-click deployment:
  - `splitease-api` — Python web service (Gunicorn + Uvicorn workers)
  - `splitease-web` — Static site (React build served via CDN)
  - `splitease-db` — Managed PostgreSQL database
- **Auto-deploy** on every GitHub push to `main`.
- **Docker Compose** available for local PostgreSQL development.
- **React Native / Expo** mobile app scaffolded and in progress.

---

## 🎯 Target Audience

1. **University students** splitting rent, groceries, and trip costs
2. **Roommates** managing shared household expenses
3. **Friend groups** tracking dinner bills, event costs, group vacations
4. **Canadian users** who prefer Interac e-Transfer over Venmo/Zelle (which aren't available in Canada)

---

## 🏆 Competitive Advantages

| Feature | SplitEase | Splitwise | Venmo |
|---------|-----------|-----------|-------|
| Free to use | ✅ | ❌ (Premium $) | ✅ |
| Smart debt simplification | ✅ | ✅ | ❌ |
| Interac e-Transfer support | ✅ | ❌ | ❌ |
| In-app wallet | ✅ | ❌ | ✅ |
| Bank linking (Plaid) | ✅ | ❌ | ✅ |
| Friend system | ✅ | ✅ | ✅ |
| Payment requests | ✅ | ❌ | ✅ |
| Dark mode premium UI | ✅ | ❌ | ❌ |
| Open source | ✅ | ❌ | ❌ |
| Available in Canada | ✅ | ✅ | ❌ |

---

## 📈 Future Roadmap

- **React Native mobile app** (scaffolded, in progress)
- **Receipt scanning** with OCR for automatic expense entry
- **Recurring expenses** for monthly bills (rent, subscriptions)
- **Multi-currency support** for international trips
- **Group analytics** with spending charts and trends
- **Push notifications** on mobile
- **Plaid Production** access for real bank account linking

---

## 👨‍💻 Built By

**Vedant Dave** — Full-stack developer

**GitHub:** [github.com/Vedantdave66/splitease](https://github.com/Vedantdave66/splitease)
**Live Demo:** [splitease-web.onrender.com](https://splitease-web.onrender.com)
