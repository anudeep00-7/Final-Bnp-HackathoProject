"""Reference preview calculations, not a posting engine.
Workbook formulas; caller MUST provide rounding and eligibility policy explicitly.
Unknown fractional/disposal terms fail closed. Use Decimal throughout.
"""
from dataclasses import dataclass
from decimal import Decimal, localcontext, ROUND_HALF_EVEN, ROUND_HALF_UP

D=Decimal

@dataclass(frozen=True)
class CalculationPolicy:
    cash_scale: int
    rounding: str
    source: str

    def __post_init__(self):
        if not 0 <= self.cash_scale <= 8 or self.rounding not in (ROUND_HALF_EVEN,ROUND_HALF_UP) or not self.source.strip():
            raise ValueError('Explicit documented rounding policy required')

    def cash(self,value):
        return value.quantize(D(1).scaleb(-self.cash_scale),rounding=self.rounding)


def preview(event, qty, avg_cost, cash, *, policy, election=None, terms=None):
    """qty is caller-validated eligible/current quantity (no intervening trade assumption).
    No DB writes; caller must perform date, authorization and source status checks too.
    """
    if event['status']!='ACTIVE': raise ValueError('Event is not ACTIVE')
    for v in (qty,avg_cost,cash):
        if not isinstance(v,D) or not v.is_finite(): raise ValueError('Finite Decimal inputs required')
    if qty<0 or avg_cost<0: raise ValueError('Negative holdings/cost are unsupported')
    with localcontext() as ctx:
        ctx.prec=50
        basis=qty*avg_cost
        result={'qty':qty,'avg_cost':avg_cost,'cost_basis':basis,'cash_movement':D(0),'gross_cash':D(0),'withholding':D(0),'policy_source':policy.source}
        a=event['action_type']
        if a=='CASH_DIVIDEND':
            if event.get('tax_withholding_pct') is None: raise ValueError('Withholding policy missing')
            gross=policy.cash(qty*event['cash_rate_per_share'])
            withholding=policy.cash(gross*event['tax_withholding_pct']/100)
            result.update(gross_cash=gross,withholding=withholding,cash_movement=gross-withholding)
        elif a in ('STOCK_SPLIT','REVERSE_SPLIT','BONUS_ISSUE'):
            n,d=event['ratio_numerator'],event['ratio_denominator']
            if n is None or d is None or n<=0 or d<=0: raise ValueError('Positive ratio required')
            ratio=n/d
            new_qty=qty*ratio if a!='BONUS_ISSUE' else qty*(1+ratio)
            if new_qty!=new_qty.to_integral_value(): raise ValueError('Fraction requires reviewed cash-in-lieu/fraction policy')
            result.update(qty=new_qty,avg_cost=basis/new_qty if new_qty else D(0))
        elif a=='NAME_CHANGE':
            if not terms or not terms.get('new_name') or not terms.get('new_symbol'): raise ValueError('Reviewed new name and symbol required')
            result.update(new_name=terms['new_name'],new_symbol=terms['new_symbol'])
        elif a=='RIGHTS_ISSUE':
            if not election or election['ca_id']!=event['ca_id'] or election['status']!='CONFIRMED': raise ValueError('Confirmed matching election required')
            if election['election_date']>event['election_deadline']: raise ValueError('Election after deadline')
            elected=election['elected_qty']
            entitlement=qty*event['ratio_numerator']/event['ratio_denominator']
            if election['election_type']=='LAPSE':
                if elected!=0: raise ValueError('LAPSE requires zero')
            elif election['election_type']=='SUBSCRIBE':
                if elected is None or elected<=0 or elected>entitlement: raise ValueError('Election exceeds entitlement or is not positive')
                if elected!=elected.to_integral_value(): raise ValueError('Fraction policy missing')
                cost=policy.cash(elected*event['subscription_price'])
                if cost>cash: raise ValueError('Insufficient cash')
                new_qty=qty+elected
                result.update(qty=new_qty,cost_basis=basis+cost,avg_cost=(basis+cost)/new_qty,cash_movement=-cost)
            else: raise ValueError('Rights sale requires separately reviewed sale price/basis')
        else:
            raise ValueError('Action requires a dedicated reviewed service calculator')
        result['cash']=cash+result['cash_movement']
        return result
