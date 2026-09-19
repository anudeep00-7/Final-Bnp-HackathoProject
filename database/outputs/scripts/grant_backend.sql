-- Optional psql script. Create an application role separately using your credential manager.
-- psql -X -v ON_ERROR_STOP=1 -v backend_role=your_existing_role -f scripts/grant_backend.sql "$DATABASE_URL"
\if :{?backend_role}
 GRANT USAGE ON SCHEMA corporate_actions TO :"backend_role";
 GRANT SELECT ON ALL TABLES IN SCHEMA corporate_actions TO :"backend_role";
 GRANT INSERT,UPDATE ON corporate_actions.positions,corporate_actions.cash_balances,
  corporate_actions.ca_elections,corporate_actions.ca_processing,corporate_actions.settlements,
  corporate_actions.securities,corporate_actions.corporate_action_events,corporate_actions.event_terms TO :"backend_role";
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA corporate_actions TO :"backend_role";
 GRANT EXECUTE ON FUNCTION corporate_actions.can_view_portfolio(text,text) TO :"backend_role";
\else
 \echo 'Supply -v backend_role=existing_role'
 \quit 1
\endif
