Corporate Actions Processing & Portfolio Impact Hub

> A controlled corporate-actions workflow for validating events,
> determining portfolio eligibility, previewing before/after impact,
> processing settlements, reconciling results, and maintaining an
> explainable audit trail.

------------------------------------------------------------------------

## 1. Overview

Corporate actions can change the quantity, cost basis, cash balance, and
market value of portfolio holdings. In operational environments, these
events may be distributed across notices, spreadsheets, holdings files,
price data, and separate workflows.

The **Corporate Actions Processing & Portfolio Impact Hub** brings this
lifecycle into a single application.

The platform is designed around the following flow:

``` text
Source Data
    ↓
Import & Validation
    ↓
Corporate Action Review
    ↓
Eligibility Determination
    ↓
Impact Preview
    ↓
Deterministic Processing
    ↓
Settlement
    ↓
Reconciliation
    ↓
Audit Trail
```

The project supports two primary user roles:

-   **Admin** --- operational control across relevant portfolios,
    including processing, rejection, reconciliation, and audit review.
-   **Analyst** --- portfolio-scoped analysis, impact review, voluntary
    elections, comparisons, and reporting.

AI is treated as an **assistive layer** for unstructured notice
extraction, natural-language audit queries, and report summaries.
Authoritative financial calculations remain in the deterministic
processing layer.

------------------------------------------------------------------------

## 2. Problem Statement

Corporate actions such as dividends, bonus issues, stock splits, rights
issues, and security name changes can materially affect portfolios.

A reliable processing workflow must answer:

1.  Is the event valid and complete?
2.  Which portfolios are eligible?
3.  What security and cash movements should occur?
4.  What will the portfolio look like before and after processing?
5.  Has the event already been processed?
6.  Do the resulting holdings and cash reconcile?
7.  Can every processing decision be explained later?

The application is designed to make these decisions visible, controlled,
and auditable.

------------------------------------------------------------------------

## 3. Objectives

The system is designed to:

-   Import and validate supplied datasets.
-   Maintain portfolio positions by portfolio and security.
-   Track corporate-action events and processing status.
-   Determine portfolio eligibility using the configured business rules.
-   Preview before/after quantity, cost basis, cash, and market value.
-   Process supported mandatory and voluntary corporate actions.
-   Produce cash and security settlement information.
-   Prevent duplicate processing and invalid state transitions.
-   Reconcile portfolio results after processing.
-   Maintain an auditable processing history.
-   Support portfolio comparison between selected dates.
-   Generate analyst reports in PDF format.
-   Extract structured information from raw corporate-action notices.
-   Support natural-language queries over audit information.
-   Support controlled reversal/correction workflows where implemented.

------------------------------------------------------------------------

## 4. Core Capabilities

### Data Management

-   Dataset import and validation
-   Security master management
-   Portfolio master management
-   Opening positions
-   Opening cash balances
-   Historical/reference prices
-   Corporate-action event data
-   Voluntary-action elections
-   Raw corporate-action notices for NLP workflows

### Portfolio Impact

For applicable events, the system is designed to expose:

-   Quantity before / after
-   Average cost before / after
-   Cash before / after
-   Market value before / after
-   Security entitlement
-   Cash entitlement
-   Settlement information

### Processing Controls

The processing layer is designed to prevent:

-   Incomplete events
-   Invalid events
-   Duplicate events
-   Cancelled events
-   Already processed events
-   Invalid status transitions
-   Repeated or invalid reversals

### Auditability

Each successful or controlled processing outcome should retain
information such as:

-   Corporate-action ID
-   Security
-   Portfolio
-   Processing date
-   Rule applied
-   Quantity before / after
-   Cost basis before / after
-   Cash movement
-   Processing status
-   Related reversal/correction information where applicable

------------------------------------------------------------------------

## 5. Supported Corporate Actions

  -----------------------------------------------------------------------
  Corporate Action                    Processing Concept
  ----------------------------------- -----------------------------------
  **Cash Dividend**                   Calculates cash entitlement from
                                      eligible holdings.

  **Bonus Issue**                     Allocates additional securities
                                      according to the configured ratio.

  **Name Change**                     Updates the security identity while
                                      preserving the position history.

  **Stock Split**                     Adjusts quantity and per-unit cost
                                      according to the split ratio.

  **Rights Issue**                    Uses eligibility and analyst
                                      election to determine the resulting
                                      security/cash movement.
  -----------------------------------------------------------------------

The detailed calculation and validation rules supplied with the
hackathon take precedence over assumptions made by the implementation.

------------------------------------------------------------------------

## 6. Role-Based Access

### Admin

The Admin represents the corporate-actions operations function.

Typical responsibilities:

-   View relevant portfolios.
-   Review new corporate-action events.
-   Inspect affected portfolios.
-   Validate incoming events.
-   Process eligible events.
-   Reject invalid events.
-   Review settlement results.
-   Run reconciliation/control checks.
-   Review audit history.

### Analyst

The Analyst represents a portfolio-analysis role.

Typical responsibilities:

-   View assigned portfolios.
-   Review current portfolio holdings.
-   Review upcoming and historical actions.
-   Inspect portfolio-level impact.
-   Review cash and security settlements.
-   Submit voluntary-action elections where eligible.
-   Compare portfolio values across dates.
-   Generate portfolio/action reports.
-   Query audit information using supported AI functionality.

> Analysts are portfolio-scoped users; they do not own the underlying
> portfolios.

------------------------------------------------------------------------

## 7. Processing Lifecycle

A corporate action follows a controlled lifecycle:

``` text
1. Import
   ↓
2. Validate
   ↓
3. Review Event
   ↓
4. Determine Eligibility
   ↓
5. Preview Portfolio Impact
   ↓
6. Process / Elect
   ↓
7. Apply Business Rule
   ↓
8. Update Portfolio Book
   ↓
9. Calculate Settlement
   ↓
10. Reconcile
   ↓
11. Write Audit Record
```

The same lifecycle is intended to be observable from the application UI.

------------------------------------------------------------------------

## 8. Architecture

The project follows a layered architecture:

``` text
┌───────────────────────────────────────────────┐
│                 React / Vite                  │
│                                               │
│ Dashboard • Portfolios • Actions • Reports   │
│ Elections • Audit • AI • Role-based Access    │
└───────────────────────┬───────────────────────┘
                        │ HTTP / API
                        ▼
┌───────────────────────────────────────────────┐
│                    FastAPI                    │
│                                               │
│ Validation • Authentication • API Layer       │
│ Orchestration • Error Handling                │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│          Deterministic Rules Engine           │
│                                               │
│ Eligibility • Entitlements • Quantity         │
│ Cost Basis • Cash • Market Value • Reversal    │
└───────────────────────┬───────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────┐
│             PostgreSQL / Supabase             │
│                                               │
│ Securities • Portfolios • Positions           │
│ Cash • Prices • Actions • Elections           │
│ Audit / Processing Records                    │
└───────────────────────────────────────────────┘

              ┌───────────────────────┐
              │      AI / NLP         │
              │                       │
              │ Notice extraction     │
              │ NL audit queries      │
              │ Report summaries      │
              └───────────────────────┘

              ┌───────────────────────┐
              │     PDF Reporting     │
              │       ReportLab       │
              └───────────────────────┘
```

### Architectural principle

**AI does not own authoritative portfolio calculations.**

The AI layer can interpret, extract, summarize, and help query
information. The deterministic processing layer is responsible for
financial calculations and state changes.

------------------------------------------------------------------------

## 9. Technology Stack

  Layer              Technology
  ------------------ -------------------------------------
  Frontend           React
  Build Tool         Vite
  Styling            Tailwind CSS
  Icons              Lucide React
  Charts             Recharts
  Routing            React Router
  API                FastAPI
  Backend Language   Python
  Validation         Pydantic
  Data Processing    Pandas
  Database           PostgreSQL / Supabase
  Database Driver    PostgreSQL-compatible Python driver
  PDF Reporting      ReportLab
  Testing            Pytest
  AI / NLP           Python-based NLP/LLM components
  Mobile Packaging   Capacitor, where applicable

------------------------------------------------------------------------

## 10. Dataset

The supplied project dataset contains the following logical inputs:

``` text
securities.csv
portfolios.csv
positions.csv
cash_balances.csv
prices.csv
corporate_actions.csv
ca_elections.csv
ca_notices_raw.csv
```

### Dataset responsibilities

  -----------------------------------------------------------------------
  File                                Purpose
  ----------------------------------- -----------------------------------
  `securities.csv`                    Security master/reference data

  `portfolios.csv`                    Portfolio/client master data

  `positions.csv`                     Opening portfolio positions

  `cash_balances.csv`                 Opening portfolio cash

  `prices.csv`                        Price marks for portfolio valuation

  `corporate_actions.csv`             Corporate-action event calendar

  `ca_elections.csv`                  Elections for voluntary actions

  `ca_notices_raw.csv`                Raw notices used by NLP
                                      extraction/classification workflows
  -----------------------------------------------------------------------

Raw notice data should be treated differently from transactional
portfolio data. It is primarily an NLP input rather than the
authoritative portfolio transaction store.

------------------------------------------------------------------------

## 11. Project Structure

The repository should follow a modular structure similar to:

``` text
.
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── services/
│   │   ├── data/
│   │   └── ...
│   ├── package.json
│   └── vite.config.*
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── rules/
│   │   └── ...
│   ├── tests/
│   ├── requirements.txt
│   └── ...
│
├── database/
│   ├── migrations/
│   ├── seed/
│   ├── outputs/
│   └── ...
│
├── data/
│   ├── securities.csv
│   ├── portfolios.csv
│   ├── positions.csv
│   └── ...
│
├── docs/
│
├── .env.example
├── .gitignore
└── README.md
```

> Keep generated environments such as `.venv`, `node_modules`, build
> outputs, caches, and secrets outside version-controlled source where
> possible.

------------------------------------------------------------------------

## 12. Prerequisites

Install the following before running the project:

-   Node.js
-   npm
-   Python 3.x
-   PostgreSQL/Supabase
-   Git

Recommended development environment:

-   VS Code
-   Git
-   Browser with developer tools

------------------------------------------------------------------------

## 13. Configuration

Create environment-specific configuration rather than hard-coding
credentials.

Example frontend environment variables:

``` env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_KEY=your_supabase_anon_or_publishable_key
VITE_API_BASE_URL=http://localhost:8000
```

Example backend configuration:

``` env
DATABASE_URL=your_database_connection_string
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_server_only_key
```

### Security rules

-   Never commit `.env` files containing secrets.
-   Never expose a Supabase service-role key in frontend code.
-   Keep server-side credentials in the backend environment.
-   Use `.env.example` for documentation.
-   Rotate credentials immediately if they are accidentally committed.

------------------------------------------------------------------------

## 14. Frontend Setup

From the frontend directory:

``` bash
npm install
```

Start the development server:

``` bash
npm run dev
```

Build the production bundle:

``` bash
npm run build
```

Preview the production build:

``` bash
npm run preview
```

The exact port should be taken from the Vite configuration or terminal
output rather than assumed.

------------------------------------------------------------------------

## 15. Backend Setup

Create a Python virtual environment:

### macOS / Linux

``` bash
python3 -m venv .venv
source .venv/bin/activate
```

### Windows

``` bash
python -m venv .venv
.venv\Scripts\activate
```

Install dependencies:

``` bash
pip install -r requirements.txt
```

Run the FastAPI application using the project's configured ASGI entry
point.

For example, when the backend entry point is `app.main:app`:

``` bash
uvicorn app.main:app --reload
```

> Use the actual entry point present in the repository if it differs.

------------------------------------------------------------------------

## 16. Database Setup

The persistent store should contain the core entities required by the
corporate-actions workflow.

Typical logical entities include:

``` text
securities
portfolios
users
positions
cash_balances
prices
corporate_actions
ca_elections
processing_records
settlements
audit_records
```

Database migrations and seed scripts should be run in the documented
order before starting the application.

The database schema should enforce appropriate relationships, uniqueness
constraints, and data integrity rules wherever practical.

------------------------------------------------------------------------

## 17. Business Rules

Corporate-action calculations must follow the supplied business-rules
workbook.

Important processing principles include:

-   Model announcement, ex-date, record date, and payment/settlement
    dates when supplied.
-   Determine eligibility using the configured date convention.
-   Use consistent security, event, and portfolio identifiers.
-   Do not process rejected, incomplete, duplicate, cancelled, or
    already processed events.
-   Preserve calculation precision.
-   Apply the specified rounding convention.
-   Record before/after portfolio state.
-   Record cash movements.
-   Reconcile portfolio valuation after applicable value-neutral
    mandatory actions.
-   Reversal must roll back the exact adjustment created by the original
    event.

The external business-rules workbook takes precedence over assumptions
made in application code.

------------------------------------------------------------------------

## 18. Voluntary Actions

For voluntary events such as rights issues, the workflow can include:

``` text
Eligible Position
       ↓
Entitlement Calculation
       ↓
Analyst Election
   ┌───┼───────────┐
   ↓   ↓           ↓
FULL  PARTIAL    DECLINE
   └───┼───────────┘
       ↓
Security / Cash Result
       ↓
Settlement
       ↓
Audit
```

The election must be validated against the eligibility and event rules
before the resulting portfolio movement is committed.

------------------------------------------------------------------------

## 19. AI / NLP

The AI layer supports three primary use cases.

### 19.1 Corporate-action notice extraction

Input:

``` text
Unstructured corporate-action announcement
```

Output:

``` text
Action Type
Security
Announcement Date
Ex-Date
Record Date
Payment Date
Terms / Ratio
Other extracted fields
```

The extracted result should be validated before it becomes a trusted
application event.

### 19.2 Natural-language audit queries

Example:

``` text
How many portfolios were impacted by the stock split of security X?
```

The AI layer translates the user's intent into a query/analysis workflow
and presents the result.

### 19.3 Analyst report summaries

The system can summarize:

-   Past corporate actions
-   Upcoming corporate actions
-   Portfolio impact
-   Settlement information
-   Relevant audit information

AI-generated summaries should remain traceable to the underlying
application data.

------------------------------------------------------------------------

## 20. Reporting

Analyst reporting is designed to provide PDF output containing relevant
portfolio and corporate-action information.

Typical report sections may include:

-   Portfolio identification
-   Portfolio cost
-   Portfolio value
-   Cash position
-   Past actions
-   Upcoming actions
-   Corporate-action impact
-   Security/cash settlements
-   Reconciliation results
-   Visual summaries where applicable

------------------------------------------------------------------------

## 21. Validation & Error Handling

The application should fail safely.

Examples include:

``` text
Invalid input
     ↓
Validation error
     ↓
Clear user-facing message
     ↓
No partial portfolio update
```

Processing should not silently mutate the portfolio when an event fails
validation.

Errors should be logged with enough operational context to support
troubleshooting without exposing secrets.

------------------------------------------------------------------------

## 22. Testing

The project should include both positive and negative test scenarios.

### Positive scenarios

-   Valid Cash Dividend
-   Valid Bonus Issue
-   Valid Name Change
-   Valid Stock Split
-   Valid Rights Issue
-   Valid voluntary election
-   Successful reconciliation
-   Successful report generation

### Negative scenarios

-   Missing required event fields
-   Invalid identifiers
-   Duplicate event
-   Already processed event
-   Cancelled event
-   Invalid status transition
-   Invalid election
-   Invalid reversal
-   Reconciliation mismatch

Run the project's configured test suite using the repository's test
command.

For a standard Pytest setup:

``` bash
pytest
```

------------------------------------------------------------------------

## 23. Reconciliation

Reconciliation is a core control rather than a cosmetic dashboard
metric.

For applicable actions, the system should verify that:

``` text
Expected Portfolio Movement
             =
Actual Portfolio Movement
```

The check may involve:

-   Quantity
-   Security entitlement
-   Cash movement
-   Market value
-   Cost basis
-   Settlement amount

Any mismatch should be surfaced as an exception rather than silently
accepted.

------------------------------------------------------------------------

## 24. Development Standards

The project follows professional software-development practices:

### Version control

Use Git with meaningful commits.

Examples:

``` text
feat: add corporate action validation
feat: implement cash dividend processing
fix: prevent duplicate action processing
feat: add analyst settlement report
test: add negative stock split scenarios
docs: update local setup instructions
```

### Code quality

-   Keep modules focused.
-   Avoid duplicated business logic.
-   Use typed/request schemas where appropriate.
-   Keep UI components reusable.
-   Keep business rules independent from UI rendering.
-   Centralize configuration.
-   Handle errors explicitly.
-   Add tests around core calculations.

### Configuration

Never hard-code:

-   API keys
-   Database passwords
-   Supabase service credentials
-   LLM credentials
-   Environment-specific URLs

------------------------------------------------------------------------

## 25. Git Workflow

Recommended workflow:

``` bash
git status
git checkout -b feature/<short-description>

# make changes

git add .
git commit -m "feat: <description>"
git push -u origin feature/<short-description>
```

Keep commits small enough that another developer can understand what
changed and why.

------------------------------------------------------------------------

## 26. Local Development Checklist

Before a demo or evaluation:

``` text
[ ] Dependencies install successfully
[ ] Environment variables configured
[ ] Database is reachable
[ ] Seed/supplied datasets are loaded
[ ] Backend starts successfully
[ ] Frontend starts successfully
[ ] Admin login works
[ ] Analyst login works
[ ] Corporate actions are visible
[ ] Portfolio holdings are visible
[ ] Impact preview works
[ ] Processing controls work
[ ] Reconciliation works
[ ] Audit records are visible
[ ] Reports can be generated
[ ] AI features return controlled results
[ ] Positive tests pass
[ ] Negative tests pass
[ ] No secrets are committed
[ ] Production/demo build starts cleanly
```

------------------------------------------------------------------------

## 27. Security Considerations

This is a financial-domain prototype, so security and data integrity
should be treated as design requirements.

Key principles:

-   Role-based authorization
-   Server-side authorization for sensitive operations
-   Environment-based secrets
-   No service-role database credentials in frontend code
-   Input validation
-   Database constraints
-   Controlled state transitions
-   Audit logging
-   Safe error messages
-   No silent partial processing
-   Clear separation between AI output and authoritative calculations

------------------------------------------------------------------------

## 28. Demo Narrative

The recommended demonstration follows one event from beginning to end:

``` text
1. Login
      ↓
2. Open Corporate Action
      ↓
3. Validate Event
      ↓
4. Determine Eligible Portfolios
      ↓
5. Preview Before / After Impact
      ↓
6. Process or Submit Election
      ↓
7. Show Security / Cash Settlement
      ↓
8. Reconcile
      ↓
9. Open Audit Record
      ↓
10. Generate / Explain Report
```

The purpose of the demo is to demonstrate one connected workflow rather
than showing isolated screens.

------------------------------------------------------------------------

## 29. Project Status

This repository is being developed as a hackathon implementation of the
Corporate Actions Processing & Portfolio Impact Hub.

Feature status should be maintained against the actual repository
implementation rather than assumed from the product vision.

Recommended status convention:

  Status          Meaning
  --------------- -----------------------------------
  `Implemented`   Working and demonstrable
  `In Progress`   Partially implemented
  `Planned`       Designed but not yet implemented
  `Validated`     Tested against expected scenarios

Avoid claiming functionality in documentation or presentations that
cannot be demonstrated in the current build.

------------------------------------------------------------------------

## 30. Documentation

Maintain the following project documentation where applicable:

``` text
README.md
docs/
├── architecture.md
├── business-rules.md
├── database.md
├── api.md
├── testing.md
└── demo-guide.md
```

The README should remain the starting point for a new developer.

------------------------------------------------------------------------

## 31. Contributing

1.  Create a feature branch.
2.  Make focused changes.
3.  Add or update tests.
4.  Run the relevant validation commands.
5.  Update documentation when behavior changes.
6.  Commit with a meaningful message.
7.  Open a pull request for review.

------------------------------------------------------------------------

## 32. License

This project was developed as a hackathon prototype.

Add the appropriate license here if the team decides to publish the
source code under an open-source license.

------------------------------------------------------------------------

## 33. Acknowledgements

Developed as a hackathon implementation of the **Corporate Actions
Processing and Portfolio Impact Hub** use case.

The supplied business-rules workbook and hackathon specification are
authoritative references for detailed corporate-action calculations and
validation behavior.

------------------------------------------------------------------------

## Quick Start

For an experienced developer, the intended workflow is:

``` bash
# 1. Clone
git clone <repository-url>
cd <repository-directory>

# 2. Configure environment
cp .env.example .env

# 3. Install frontend
cd frontend
npm install

# 4. Start frontend
npm run dev

# 5. In another terminal, configure backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 6. Start backend using the project's ASGI entry point
uvicorn <module>:app --reload

# 7. Run tests
pytest
```

Replace placeholder paths and the ASGI module with the actual repository
structure before publishing the final README.
