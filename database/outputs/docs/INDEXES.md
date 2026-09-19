# Index rationale

Primary and UNIQUE constraints automatically supply B-tree indexes. No duplicate indexes are created for their exact prefixes.
Composite position/cash keys start with portfolio; price keys start with security/date; elections have action/portfolio and election-ID keys.
Measure production EXPLAIN plans before adding broader JSON indexes or indexes for low-volume foreign keys.

| Index | Purpose |
|---|---|
| one_original_processing | Only one pending, successful or reversed original per action/portfolio; failed/rejected attempts remain retryable. |
| positions_security_date | Find affected portfolios at eligibility/reference dates. |
| events_calendar | Date calendar and status filtering. |
| events_security | Security-to-event joins. |
| events_action_status | Action type/status filters. |
| events_record_date | Record-date workload. |
| events_pay_date | Payment calendar. |
| events_election_deadline | Upcoming election cutoff queues. |
| elections_portfolio | Portfolio elections without scanning action-first unique key. |
| processing_portfolio_date | Historical before/after portfolio reports. |
| processing_status | Pending/failed operations queues. |
| settlement_forecast | Portfolio/date/status cash and security forecasts. |
| settlement_security | Settlement security impact lookup. |
| audit_portfolio_date | Portfolio audit timeline. |
| audit_event | Action-wide audit search. |
| audit_processing | Processing detail and inverse audit linkage. |
| audit_security | Security audit history. |
| assignments_portfolio | Find assigned Analysts for a portfolio. |
