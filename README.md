# ActiLedger — Corporate Actions Portfolio Management & Audit Platform

> **BNP Paribas Hackathon 2026** — End-to-end corporate actions lifecycle management system with real-time portfolio impact analysis, AI-powered natural language querying, and complete audit trail.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [Backend API Reference](#backend-api-reference)
- [Frontend Application](#frontend-application)
- [AI Copilot — Natural Language Query Engine](#ai-copilot--natural-language-query-engine)
- [Corporate Actions Lifecycle](#corporate-actions-lifecycle)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Data Model](#data-model)
- [Screenshots & UI Flow](#screenshots--ui-flow)

---

## Overview

**ActiLedger** is a full-stack enterprise platform for managing corporate actions across client portfolios. It handles the complete lifecycle from event ingestion to settlement, including:

- **14 Securities** (equities, convertible bonds, preference shares) across **8 Client Portfolios**
- **16 Corporate Action Events** spanning all 3 tiers:
  - **Tier 1 (Mandatory):** Cash Dividend, Stock Split, Bonus Issue, Stock Dividend, Merger, Spin-Off, Delisting, Name Change
  - **Tier 2 (Voluntary):** Rights Issue, Tender Offer, DRIP Election, Bond/Preference Conversion
  - **Tier 3 (Complex):** Reverse Split, Reversals & Corrections
- **Transactional Processing** with position/cash ledger adjustments, settlement generation, and audit logging
- **Reconciliation Engine** with before/after portfolio valuation snapshots
- **AI Copilot** grounded in live PostgreSQL data for natural language portfolio queries
- **Dual-Role Interface:** Admin (operations) and Analyst (read-only portfolio monitoring)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Landing    │  │   Analyst    │  │    Admin      │  │
│  │    Page      │  │  Workspace   │  │  Workspace    │  │
│  │  (Public)    │  │ (Read-Only)  │  │ (Full CRUD)   │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │        Floating AI Copilot Chat Widget            │    │
│  │     (Available on every page, queries live DB)    │    │
│  └──────────────────────────────────────────────────┘    │
│                         │                                │
│                    HTTP REST API                         │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│                  BACKEND (FastAPI)                        │
│                                                          │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │   Auth     │ │ Portfolio  │ │  Corporate Actions   │  │
│  │  Routes    │ │  Routes    │ │  Routes (Process,    │  │
│  │ (JWT/Dev)  │ │ (Holdings) │ │  Reverse, Elections) │  │
│  └────────────┘ └────────────┘ └──────────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │   Audit    │ │  Report    │ │    AI NL Query       │  │
│  │  Routes    │ │  Routes    │ │  Engine (nl_query)   │  │
│  │ (Logs+Ask) │ │ (PDF/CSV)  │ │  (Live DB Queries)   │  │
│  └────────────┘ └────────────┘ └──────────────────────┘  │
│                         │                                │
│  ┌──────────────────────┴───────────────────────────┐    │
│  │             Services Layer                        │    │
│  │  ProcessService · ReconciliationService           │    │
│  │  AuditService · PortfolioService · ReportService  │    │
│  └──────────────────────┬───────────────────────────┘    │
│                         │                                │
│  ┌──────────────────────┴───────────────────────────┐    │
│  │         SQLAlchemy ORM / Raw SQL Queries          │    │
│  └──────────────────────┬───────────────────────────┘    │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│              PostgreSQL 18 (bnp_hackathon)               │
│              Schema: corporate_actions                   │
│                                                          │
│  17 Tables + Views:                                      │
│  portfolios · securities · positions · cash_balances     │
│  prices · corporate_action_events · event_terms          │
│  ca_processing · ca_elections · settlements              │
│  audit_logs · users · user_portfolios                    │
│  current_positions (view) · current_cash_balances (view) │
│  processing_reconciliation (view)                        │
│  settlement_forecast (view)                              │
│                                                          │
│  Triggers: processing_guard · election_guard             │
│  Constraints: unique indexes, check constraints          │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **Vite** | Build tool & dev server (HMR) |
| **Tailwind CSS 4** | Utility-first styling (BNP green `#126b45` + white theme) |
| **React Router v7** | Client-side routing (dual workspace) |
| **Recharts** | Portfolio value charts & data visualization |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|---|---|
| **FastAPI** | REST API framework (async, auto-docs) |
| **Uvicorn** | ASGI server with hot-reload |
| **SQLAlchemy 2.0** | ORM + raw SQL for complex queries |
| **Pydantic v2** | Request/response validation |
| **psycopg2** | PostgreSQL adapter |
| **ReportLab** | PDF report generation |
| **python-dotenv** | Environment configuration |

### Database
| Technology | Purpose |
|---|---|
| **PostgreSQL 18** | Relational database |
| **Schema: `corporate_actions`** | All tables namespaced under dedicated schema |

---

## Database Schema

### Core Tables (17)

| Table | Records | Description |
|---|---|---|
| `portfolios` | 8 | Client portfolios (P001–P008) |
| `securities` | 14 | Equities, bonds, preference shares (SEC001–SEC014) |
| `positions` | 27+ | Historical position snapshots (qty, avg_cost, as_of_date) |
| `cash_balances` | 8 | Opening cash balances per portfolio |
| `prices` | 40+ | Daily closing prices per security |
| `corporate_action_events` | 14 | CA events (CA001–CA014) with dates, ratios, rates |
| `event_terms` | 14 | Processing block reasons, review policy, approval status |
| `ca_processing` | 50+ | Transactional processing records (status, reversal tracking) |
| `ca_elections` | 7+ | Voluntary action client elections (SUBSCRIBE/LAPSE/TENDER) |
| `settlements` | 31+ | Cash & security settlement legs |
| `audit_logs` | 102+ | Immutable audit trail (before/after state snapshots) |
| `users` | 2 | DEMO_ADMIN, DEMO_ANALYST |
| `user_portfolios` | 8 | User ↔ portfolio access mapping |

### Views

| View | Description |
|---|---|
| `current_positions` | Latest position per portfolio×security (consolidates processing adjustments) |
| `current_cash_balances` | Latest cash balance per portfolio |
| `processing_reconciliation` | Before/after valuation with observed vs expected difference |
| `settlement_forecast` | Upcoming settlement obligations |

### Key Constraints & Triggers

- **`processing_guard`** — Prevents UPDATE on processed `ca_processing` rows (immutability)
- **`election_guard`** — Validates election_type ∈ {SUBSCRIBE, LAPSE, TENDER, DRIP, CASH, CONVERT, SELL}
- **`one_original_processing`** — Unique index ensuring one active processing per CA×portfolio
- **Foreign keys** — Full referential integrity across all tables

---

## Backend API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/login` | Login with user_id, returns token |
| GET | `/me` | Get current user profile |

### Portfolios
| Method | Endpoint | Description |
|---|---|---|
| GET | `/portfolios` | List all portfolios with cash balances |
| GET | `/portfolios/{id}` | Single portfolio detail |
| GET | `/holdings/{id}` | Holdings with latest prices & P&L |
| GET | `/cash/{id}` | Cash balance for portfolio |

### Corporate Actions
| Method | Endpoint | Description |
|---|---|---|
| GET | `/actions` | List all CA events with computed status |
| GET | `/actions/{ca_id}` | Single action detail with event terms |
| POST | `/process-action` | Transactional processing (adjusts positions, cash, generates settlements + audit) |
| POST | `/reverse-action` | Full reversal with audit trail |
| POST | `/reject-action` | Reject/cancel an event |
| PATCH | `/event-terms/{ca_id}` | Approve or block event terms |

### Elections
| Method | Endpoint | Description |
|---|---|---|
| GET | `/elections` | List elections (filterable by ca_id, portfolio_id) |
| POST | `/elections` | Create/update election for voluntary action |

### Reconciliation & Settlements
| Method | Endpoint | Description |
|---|---|---|
| GET | `/reconciliation` | Portfolio reconciliation view (before/after values) |
| POST | `/reconciliation/{id}/resolve` | Resolve discrepancy with audit record |
| GET | `/settlements` | Settlement transaction records |

### Audit & AI
| Method | Endpoint | Description |
|---|---|---|
| GET | `/audit` | Audit log records |
| POST | `/audit/ask` | **AI Natural Language Query** — ask questions about portfolios, securities, actions, etc. |

### Reports
| Method | Endpoint | Description |
|---|---|---|
| GET | `/reports/{id}/summary` | Portfolio summary report |
| GET | `/reports/{id}/pdf` | PDF report download |
| POST | `/reports/extract-notice` | Extract corporate action notice from text |

---

## Frontend Application

### Dual-Role Workspace

#### Landing Page (`/`)
- Public entry point with role selection (Admin / Analyst)
- BNP Paribas corporate branding

#### Analyst Workspace (`/analyst/*`)
Read-only monitoring and analysis:

| Route | Page | Description |
|---|---|---|
| `/analyst/dashboard` | Dashboard | KPI cards, portfolio charts, upcoming actions |
| `/analyst/portfolios` | My Portfolios | Holdings browser with live market values |
| `/analyst/actions` | Corporate Actions | Event calendar with status tracking |
| `/analyst/impact` | Impact Analysis | Portfolio-level impact simulation |
| `/analyst/elections` | Elections | View voluntary action elections |
| `/analyst/settlements` | Settlements | Settlement tracking with T+2 dates |
| `/analyst/reports` | Reports | PDF/CSV export, portfolio summaries |
| `/analyst/audit` | Audit History | Immutable audit trail viewer |
| `/analyst/ai` | AI Assistant | Full-page NL query interface |
| `/analyst/settings` | Settings | Profile settings |

#### Admin Workspace (`/admin/*`)
Full operations control:

| Route | Page | Description |
|---|---|---|
| `/admin/dashboard` | Dashboard | System-wide KPIs, processing queue |
| `/admin/portfolios` | Portfolios | All portfolios with drill-down |
| `/admin/corporate-actions` | Corporate Actions | Process, reverse, reject actions |
| `/admin/elections` | Elections | Record voluntary election instructions |
| `/admin/reconciliation` | Reconciliation | Before/after valuation, resolve discrepancies |
| `/admin/audits-controls` | Audits & Controls | Complete audit log with filters |
| `/admin/reports` | Reports | Generate reports across all portfolios |
| `/admin/import-dataset` | Import Dataset | Data ingestion interface |
| `/admin/ai-assistant` | AI Assistant | Full-page operations AI copilot |
| `/admin/profile` | Profile | Admin profile settings |

### Floating AI Copilot
A persistent floating chat button (bottom-right corner) is available on **every page** in both workspaces. It provides instant natural language access to all database-backed queries.

---

## AI Copilot — Natural Language Query Engine

The AI Copilot queries **live PostgreSQL data** across all tables. No hardcoded responses — every answer is computed from real database records.

### Supported Query Types

| Category | Example Questions | Tables Queried |
|---|---|---|
| **Portfolios** | "Show all portfolios", "P001 AUM and cash balance" | `portfolios`, `cash_balances`, `current_positions` |
| **Securities** | "List all securities with prices", "Tell me about SEC006" | `securities`, `prices` |
| **Holdings** | "Show holdings for P003" | `current_positions`, `securities` |
| **Corporate Actions** | "Which actions are processed?", "Details of CA001" | `corporate_action_events`, `ca_processing` |
| **Elections** | "Show all election records", "Elections for CA008" | `ca_elections` |
| **Settlements** | "Settlements for P001" | `settlements`, `ca_processing` |
| **Reconciliation** | "Show reconciliation records" | `processing_reconciliation` |
| **Impact Analysis** | "How many portfolios impacted by stock split of SEC006?" | `current_positions` |
| **Cash Totals** | "Total cash paid for CA001" | `current_positions`, `corporate_action_events` |
| **Price History** | "Price history of Vertex Technologies" | `prices` |
| **Audit Trail** | "Show audit logs for CA001" | `audit_logs` |

### Architecture

```
User Question → Intent Detection (regex patterns) → Entity Extraction (P###, CA###, SEC###)
                     ↓
              Route to Handler → Live SQL Query → Format Response (Markdown)
                     ↓
              Return { question, answer (markdown), data (JSON) }
```

The engine has a **fallback local engine** (`corporateActionsEngine.js`) on the frontend that provides deterministic answers when the backend is unreachable.

---

## Corporate Actions Lifecycle

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  EVENT   │────>│  EVENT TERMS │────>│  PROCESSING   │────>│  SETTLEMENT  │
│ INGESTED │     │   REVIEW     │     │ (Transactional)│     │  GENERATION  │
│          │     │              │     │               │     │              │
│ CA001-   │     │ Block/Approve│     │ Position adj. │     │ Cash legs    │
│ CA016    │     │ Policy check │     │ Cash adj.     │     │ Security legs│
└──────────┘     └──────────────┘     │ Cost basis    │     │ T+2 dates   │
                                      └───────┬───────┘     └──────────────┘
                                              │
                                    ┌─────────┴─────────┐
                                    │                   │
                              ┌─────┴─────┐      ┌─────┴─────┐
                              │  AUDIT    │      │  RECONCI- │
                              │  LOGGING  │      │  LIATION  │
                              │           │      │           │
                              │ Before/   │      │ Before vs │
                              │ After     │      │ After     │
                              │ snapshots │      │ portfolio │
                              │ Immutable │      │ valuation │
                              └───────────┘      └───────────┘
```

### Processing Rules by Action Type

| Action Type | Position Impact | Cash Impact | Special Logic |
|---|---|---|---|
| Cash Dividend | No change | +dividend per share | Tax withholding calculation |
| Stock Split | qty × ratio | No change | avg_cost ÷ ratio |
| Bonus Issue | +bonus shares | No change | Cost basis reallocation |
| Stock Dividend | +dividend shares | No change | Fair value distribution |
| Merger | Remove old, add new | +cash component | Multi-leg settlement |
| Spin-Off | +spin-off shares | No change | Parent cost basis % realloc |
| Delisting | Remove shares | +liquidation cash | Final settlement |
| Name Change | Symbol update | No change | No economic impact |
| Rights Issue | +subscribed shares | -subscription cost | Entitlement = holding × ratio |
| Tender Offer | -tendered shares | +offer price × qty | Pro-rata cap enforcement |
| Reverse Split | qty ÷ ratio | +fractional cash | Fractional share handling |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **PostgreSQL** ≥ 15

### 1. Database Setup

```bash
# Create database
createdb bnp_hackathon

# Run seed script
cd BNP-hackathon/backend
python3 supabase_migration/seed_supabase.py
```

### 2. Backend

```bash
cd BNP-hackathon/backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn sqlalchemy psycopg2-binary pydantic python-dotenv reportlab

# Configure environment
# Edit .env:
#   DATABASE_URL=postgresql://localhost:5432/bnp_hackathon
#   ACTILEDGER_AUTH_MODE=development
#   CORS_ORIGINS=http://localhost:5173,http://localhost:5174

# Start server
PYTHONPATH="$(pwd)/..:$(pwd)" uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Backend available at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd main-frontend/analyst-frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend available at: `http://localhost:5173` (or `5174` if 5173 is occupied)

---

## Project Structure

```
BNP-hackathon/
├── backend/
│   ├── app.py                    # FastAPI application entry point
│   ├── config.py                 # Environment configuration (DB, CORS, auth)
│   ├── .env                      # Environment variables
│   │
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── portfolio.py          # Portfolio model
│   │   ├── security.py           # Security model
│   │   ├── position.py           # Position model
│   │   ├── cash_balance.py       # Cash balance model
│   │   ├── price.py              # Price model
│   │   ├── corporate_action.py   # CorporateActionEvent model
│   │   ├── event_term.py         # EventTerm model
│   │   ├── ca_processing.py      # CaProcessing model
│   │   ├── ca_election.py        # CaElection model
│   │   ├── settlement.py         # Settlement model
│   │   ├── audit_log.py          # AuditLog model
│   │   ├── user.py               # User model
│   │   └── user_portfolio.py     # UserPortfolio model
│   │
│   ├── routes/                   # API route handlers
│   │   ├── auth_routes.py        # /login, /me, auth middleware
│   │   ├── portfolio_routes.py   # /portfolios, /holdings, /cash
│   │   ├── action_routes.py      # /actions, /process, /elections, /reconciliation, /settlements
│   │   ├── audit_routes.py       # /audit, /audit/ask (AI)
│   │   └── report_routes.py      # /reports (PDF, summaries)
│   │
│   ├── services/                 # Business logic layer
│   │   ├── process_service.py    # Corporate action processing engine
│   │   ├── reconciliation_service.py  # Reconciliation queries
│   │   ├── audit_service.py      # Audit log queries & serialization
│   │   ├── portfolio_service.py  # Portfolio data aggregation
│   │   └── csv_loader.py         # CSV seed data loader
│   │
│   ├── ai/                       # AI/NL query engine
│   │   ├── nl_query.py           # Natural language → SQL query engine
│   │   └── notice_extractor.py   # Corporate action notice text extraction
│   │
│   ├── reports/                  # Report generation
│   │   ├── pdf_generator.py      # ReportLab PDF builder
│   │   └── report_service.py     # Report data aggregation
│   │
│   ├── database/
│   │   └── db.py                 # SQLAlchemy engine & session factory
│   │
│   └── supabase_migration/
│       └── seed_supabase.py      # Database seed script
│
main-frontend/
└── analyst-frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    │
    └── src/
        ├── App.jsx               # React Router configuration
        ├── main.jsx              # Application entry point
        │
        ├── api/
        │   └── client.js         # API client (fetch wrapper with auth headers)
        │
        ├── context/
        │   ├── AuthContext.jsx    # Authentication state management
        │   └── ThemeContext.jsx   # Theme state
        │
        ├── components/
        │   ├── layout/
        │   │   ├── DashboardLayout.jsx   # Shell with sidebar + topbar + floating AI
        │   │   ├── Sidebar.jsx           # Role-aware navigation sidebar
        │   │   └── Topbar.jsx            # Top navigation bar
        │   │
        │   ├── ai/
        │   │   └── CorporateActionsChatWidget.jsx  # Floating AI chat widget
        │   │
        │   ├── dashboard/
        │   │   ├── StatCard.jsx           # KPI metric cards
        │   │   ├── PortfolioValueChart.jsx # Recharts portfolio chart
        │   │   ├── UpcomingActions.jsx     # Upcoming actions list
        │   │   └── RecentImpacts.jsx       # Recent impact feed
        │   │
        │   └── common/
        │       ├── StatusBadge.jsx        # Status pill component
        │       └── EmptyState.jsx         # Empty state placeholder
        │
        ├── pages/
        │   ├── public/
        │   │   └── LandingPage.jsx        # Public landing with role selection
        │   │
        │   ├── analyst/                   # Analyst workspace (10 pages)
        │   │   ├── AnalystDashboard.jsx
        │   │   ├── MyPortfolios.jsx
        │   │   ├── CorporateActions.jsx
        │   │   ├── ImpactAnalysis.jsx
        │   │   ├── Elections.jsx
        │   │   ├── Settlements.jsx
        │   │   ├── Reports.jsx
        │   │   ├── AuditHistory.jsx
        │   │   ├── AIAssistantPage.jsx
        │   │   └── Settings.jsx
        │   │
        │   └── admin/                     # Admin workspace (10 pages)
        │       ├── AdminDashboard.jsx
        │       ├── AdminPortfolios.jsx
        │       ├── AdminCorporateActions.jsx
        │       ├── AdminElections.jsx
        │       ├── AdminReconciliation.jsx
        │       ├── AdminAuditsControls.jsx
        │       ├── AdminReports.jsx
        │       ├── AdminImportDataset.jsx
        │       ├── AdminAIChat.jsx
        │       └── AdminProfile.jsx
        │
        ├── services/
        │   └── corporateActionsEngine.js  # Local fallback NL query engine
        │
        └── utils/
            └── exportCsv.js              # CSV export utility
```

---

## Data Model

### Securities (14)

| ID | Symbol | Name | Type |
|---|---|---|---|
| SEC001 | GBC | GlobalBank Corp | EQUITY |
| SEC002 | NWI | Northwind Industries | EQUITY |
| SEC003 | APX | Apex Pharma | EQUITY |
| SEC004 | SLE | Solstice Energy | EQUITY |
| SEC005 | HBR | Harbor Retail | EQUITY |
| SEC006 | VTX | Vertex Technologies | EQUITY |
| SEC007 | MRF | Meridian Foods | EQUITY |
| SEC008 | CSM | Cascade Materials | EQUITY |
| SEC009 | UNF | Union Freight | EQUITY |
| SEC010 | FLC | Falcon Insurance | EQUITY |
| SEC011 | UNF-CB28 | Union Freight 5% Conv Bond 2028 | CONVERTIBLE_BOND |
| SEC012 | FLC-PFD | Falcon Insurance Pref Shares | PREFERENCE_SHARE |
| SEC013 | SPN | SpinCo Renewables | EQUITY |
| SEC014 | AQC | Acquirer Corp | EQUITY |

### Portfolios (8)

| ID | Name | Client Type | Opening Cash |
|---|---|---|---|
| P001 | Alice Wealth Growth | INDIVIDUAL | $15,000 |
| P002 | Bob Retirement Fund | PENSION | $42,000 |
| P003 | Carol Balanced Portfolio | INDIVIDUAL | $8,000 |
| P004 | Delta Pension Trust | PENSION | $120,000 |
| P005 | Echo Family Office | FAMILY_OFFICE | $65,000 |
| P006 | Foxtrot Income Fund | MUTUAL_FUND | $30,000 |
| P007 | Golf Endowment | ENDOWMENT | $95,000 |
| P008 | Hotel Trading Book | PROP_DESK | $250,000 |

### Corporate Actions (16)

| ID | Type | Security | Tier | Key Terms |
|---|---|---|---|---|
| CA001 | CASH_DIVIDEND | SEC001 (GBC) | 1 | $0.50/share, 15% tax |
| CA002 | STOCK_SPLIT | SEC006 (VTX) | 1 | 2:1 ratio |
| CA003 | BONUS_ISSUE | SEC003 (APX) | 1 | 1:5 ratio |
| CA004 | STOCK_DIVIDEND | SEC005 (HBR) | 1 | 1:20 ratio |
| CA005 | MERGER | SEC002 (NWI) | 1 | 3:4 + $2.00 cash → SEC014 |
| CA006 | SPIN_OFF | SEC004 (SLE) | 1 | 1:10 → SEC013, 15% cost realloc |
| CA007 | DELISTING | SEC007 (MRF) | 1 | $1.10/share liquidation |
| CA008 | RIGHTS_ISSUE | SEC008 (CSM) | 2 | 1:4 @ $8.00 subscription |
| CA009 | TENDER_OFFER | SEC009 (UNF) | 2 | $25.00, 30% cap |
| CA010 | DRIP_ELECTION | SEC001 (GBC) | 2 | Reinvest @ $42.00 |
| CA011 | CONVERSION | SEC011 (UNF-CB28) | 2 | 25:1 → SEC009 equity |
| CA012 | CONVERSION | SEC012 (FLC-PFD) | 2 | 1:1 → SEC010 common |
| CA013 | REVERSE_SPLIT | SEC010 (FLC) | 3 | 1:5 reverse |
| CA014 | NAME_CHANGE | SEC005 (HBR→HRG) | 1 | Symbol change only |
| CA015 | CASH_DIVIDEND | SEC001 (GBC) | 1 | $0.55/share Q2 |
| CA016 | RIGHTS_ISSUE | SEC008 (CSM) | 3 | Reversed (duplicate) |

---

## Screenshots & UI Flow

### User Journey

```
Landing Page (/) → Select Role
    │
    ├── "Enter as Analyst" → /analyst/dashboard
    │       └── Sidebar: Dashboard · Portfolios · Actions · Impact
    │                     Elections · Settlements · Reports · Audit · AI
    │
    └── "Enter as Admin" → /admin/dashboard
            └── Sidebar: Dashboard · Portfolios · Corporate Actions
                          Elections · Reconciliation · Audits · Reports
                          Import · AI Assistant · Profile
```

### Design System

- **Primary Color:** `#126b45` (BNP Paribas corporate green)
- **Background:** `#f4faf6` (light green tint)
- **Cards:** White with `#dceee3` borders
- **Typography:** System font stack, bold headings
- **Mode:** Light-only (professional corporate aesthetic)

---

## License

Built for the **BNP Paribas Hackathon 2026**. Internal use only.
