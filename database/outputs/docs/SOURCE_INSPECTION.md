# Supplied CSV schema inspection
Source files are read only. Detailed values, empty counts, row anomalies and SHA-256 hashes are in `data/source_inventory.json`.

## D1 securities.csv
14 data rows; 0 malformed rows; 0 duplicate complete valid rows.
```text
security_id,symbol,name,type,currency,underlying_security_id,status
```

## D2 portfolios.csv
8 data rows; 0 malformed rows; 0 duplicate complete valid rows.
```text
portfolio_id,portfolio_name,client_id,client_type,base_currency
```

## D3 positions.csv
27 data rows; 0 malformed rows; 0 duplicate complete valid rows.
```text
portfolio_id,security_id,qty,avg_cost,as_of_date
```

## D4 cash_balances.csv
8 data rows; 0 malformed rows; 0 duplicate complete valid rows.
```text
portfolio_id,currency,balance,as_of_date
```

## D5 prices.csv
41 data rows; 1 malformed rows; 0 duplicate complete valid rows.
```text
security_id,price_date,close_price,note
```

## D6 corporate_actions.csv
16 data rows; 2 malformed rows; 0 duplicate complete valid rows.
```text
ca_id,security_id,action_type,tier,status,ex_date,record_date,pay_date,election_deadline,ratio_numerator,ratio_denominator,cash_rate_per_share,subscription_price,offer_price,new_security_id,cost_basis_allocation_pct,tax_withholding_pct,notes
```

## D7 ca_elections.csv
9 data rows; 0 malformed rows; 0 duplicate complete valid rows.
```text
election_id,ca_id,portfolio_id,election_type,elected_qty,election_date,status,notes
```
