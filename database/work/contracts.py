import json
from pathlib import Path
r=Path('outputs/database'); inv=json.loads((r/'data/source_inventory.json').read_text())
pks={'securities':['security_id'],'portfolios':['portfolio_id'],'positions':['portfolio_id','security_id','as_of_date'],'cash_balances':['portfolio_id','currency','as_of_date'],'prices':['security_id','price_date'],'corporate_action_events':['ca_id'],'ca_elections':['election_id']}
optional={'underlying_security_id','note','record_date','pay_date','election_deadline','ratio_numerator','ratio_denominator','cash_rate_per_share','subscription_price','offer_price','new_security_id','cost_basis_allocation_pct','tax_withholding_pct','notes','elected_qty'}
nums={'qty','avg_cost','balance','close_price','ratio_numerator','ratio_denominator','cash_rate_per_share','subscription_price','offer_price','cost_basis_allocation_pct','tax_withholding_pct','elected_qty'}
contracts={}
for file,v in inv.items():
 table=file[3:-4]; table='corporate_action_events' if table=='corporate_actions' else table
 contracts[table]={'filename':file,'sha256':v['sha256'],'headers':v['header'],'pk':pks[table],'types':{c:'numeric' if c in nums else 'integer' if c=='tier' else 'date' if c.endswith('_date') or c=='election_deadline' else 'text' for c in v['header']},'required':[c for c in v['header'] if c not in optional]}
(r/'scripts/source_contract.json').write_text(json.dumps(contracts,indent=2)+'\n')
