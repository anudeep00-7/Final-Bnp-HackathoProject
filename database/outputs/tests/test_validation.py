import csv
from datetime import date
from decimal import Decimal as D, ROUND_HALF_EVEN
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from validate_csvs import validate,CONTRACT,scalar,semantic
from core_rules import preview,CalculationPolicy

FIXTURE=Path(__file__).parent/'fixtures'

class ValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder=Path(self.temp.name)
        for p in FIXTURE.glob('*.csv'): shutil.copyfile(p,self.folder/p.name)

    def mutate(self,table,fn):
        p=self.folder/CONTRACT[table]['filename']
        with p.open(newline='') as f: rows=list(csv.reader(f))
        fn(rows)
        with p.open('w',newline='') as f: csv.writer(f).writerows(rows)

    def test_supplied_known_repairs(self):
        data,r=validate(self.folder,'known')
        self.assertEqual(r['error_count'],0);self.assertEqual(r['repair_count'],3)
        self.assertEqual(sum(map(len,data.values())),123)
        self.assertEqual(next(x for x in data['corporate_action_events'] if x['ca_id']=='CA010')['tax_withholding_pct'],D(15))

    def test_strict_quarantines_dependents(self):
        data,r=validate(self.folder)
        self.assertEqual(r['error_count'],6)
        self.assertEqual(len(data['ca_elections']),6)

    def test_sources_unchanged(self):
        before={p.name:p.read_bytes() for p in self.folder.glob('*.csv')}
        validate(self.folder,'known')
        self.assertEqual(before,{p.name:p.read_bytes() for p in self.folder.glob('*.csv')})

    def test_duplicate_key_quarantines_all(self):
        self.mutate('positions',lambda rows: rows.append(rows[1]))
        data,r=validate(self.folder,'known')
        self.assertEqual(len(data['positions']),26)
        self.assertTrue(any('Duplicate key' in i['message'] for i in r['issues']))

    def test_invalid_foreign_key(self):
        self.mutate('positions',lambda rows: rows[1].__setitem__(1,'MISSING'))
        data,r=validate(self.folder,'known')
        self.assertEqual(len(data['positions']),26)
        self.assertTrue(any('missing or invalid parent' in i['message'] for i in r['issues']))

    def test_invalid_date(self):
        with self.assertRaises(ValueError): scalar('2026-02-30','date')
        with self.assertRaises(ValueError): scalar('01/02/2026','date')

    def test_nonfinite_numbers(self):
        for v in ['NaN','Infinity','-Infinity','1e3','1,000']:
            with self.subTest(v=v), self.assertRaises(ValueError): scalar(v,'numeric')

    def test_required_field(self):
        self.mutate('positions',lambda rows: rows[1].__setitem__(2,''))
        _,r=validate(self.folder,'known')
        self.assertTrue(any('qty: required' in i['message'] for i in r['issues']))

    def test_header_mismatch(self):
        self.mutate('portfolios',lambda rows: rows[0].__setitem__(0,'portfolio'))
        data,r=validate(self.folder,'known')
        self.assertEqual(len(data['portfolios']),0)
        self.assertTrue(any('Headers differ' in i['message'] for i in r['issues']))

    def test_malformed_quote(self):
        p=self.folder/CONTRACT['positions']['filename']
        p.write_text(p.read_text()+'"unterminated')
        _,r=validate(self.folder,'known')
        self.assertTrue(any('Parsing stopped' in i['message'] for i in r['issues']))

    def test_wrong_election_type(self):
        self.mutate('ca_elections',lambda rows: rows[1].__setitem__(3,'TENDER'))
        _,r=validate(self.folder,'known')
        self.assertTrue(any('incompatible' in i['message'] for i in r['issues']))

    def test_late_election(self):
        self.mutate('ca_elections',lambda rows: rows[1].__setitem__(5,'2026-04-21'))
        _,r=validate(self.folder,'known')
        self.assertTrue(any('exceeds deadline' in i['message'] for i in r['issues']))

    def test_unknown_version_not_repaired(self):
        p=self.folder/CONTRACT['corporate_action_events']['filename'];p.write_bytes(p.read_bytes()+b'\n')
        _,r=validate(self.folder,'known')
        self.assertTrue(any(i['table']=='corporate_action_events' and 'Expected 18' in i['message'] for i in r['issues']))

class RuleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        data,r=validate(FIXTURE,'known')
        assert not r['error_count']
        cls.events={x['ca_id']:x for x in data['corporate_action_events']}
        cls.elections={x['election_id']:x for x in data['ca_elections']}
        cls.policy=CalculationPolicy(2,ROUND_HALF_EVEN,'Test demonstration policy; not specified by workbook')

    def run_preview(self,ca,q,c,cash='0',**kwargs):
        return preview(self.events[ca],D(q),D(c),D(cash),policy=self.policy,**kwargs)

    def test_cash_dividend(self):
        r=self.run_preview('CA001','500','38','15000')
        self.assertEqual((r['gross_cash'],r['withholding'],r['cash_movement'],r['cash']),(D('250'),D('37.50'),D('212.50'),D('15212.50')))
        self.assertEqual(r['cost_basis'],D(19000))

    def test_bonus(self):
        r=self.run_preview('CA003','1000','22')
        self.assertEqual(r['qty'],1200); self.assertEqual(r['cost_basis'],22000)
        self.assertEqual(D(1000)*24,r['qty']*20)

    def test_split(self):
        r=self.run_preview('CA002','200','150')
        self.assertEqual((r['qty'],r['avg_cost']),(400,75))
        self.assertEqual(D(200)*152,r['qty']*76)

    def test_name_change(self):
        r=self.run_preview('CA014','1200','19.50',terms={'new_name':'Harbor Retail Group','new_symbol':'HRG'})
        self.assertEqual((r['qty'],r['avg_cost'],r['cash_movement']),(1200,D('19.5'),0))
        self.assertEqual(r['new_symbol'],'HRG')

    def test_rights_full(self):
        r=self.run_preview('CA008','600','32','8000',election=self.elections['E001'])
        self.assertEqual((r['qty'],r['cost_basis'],r['cash']),(750,20400,6800))
        self.assertEqual(r['avg_cost'],D('27.2'))

    def test_rights_partial(self):
        e=dict(self.elections['E001'],elected_qty=D(50))
        r=self.run_preview('CA008','600','32','8000',election=e)
        self.assertEqual((r['qty'],r['cost_basis'],r['cash']),(650,19600,7600))

    def test_rights_lapse(self):
        r=self.run_preview('CA008','2000','31','30000',election=self.elections['E002'])
        self.assertEqual((r['qty'],r['cash_movement']),(2000,0))

    def test_rights_insufficient_cash(self):
        with self.assertRaisesRegex(ValueError,'Insufficient'): self.run_preview('CA008','600','32','10',election=self.elections['E001'])

    def test_rights_excess(self):
        e=dict(self.elections['E001'],elected_qty=D(151))
        with self.assertRaisesRegex(ValueError,'entitlement'): self.run_preview('CA008','600','32','8000',election=e)

    def test_reversed_event(self):
        with self.assertRaisesRegex(ValueError,'ACTIVE'): self.run_preview('CA016','600','32','8000',election=self.elections['E001'])

    def test_fraction_requires_policy(self):
        with self.assertRaisesRegex(ValueError,'Fraction'): self.run_preview('CA013','401','60')

    def test_cash_missing_tax_policy(self):
        e=dict(self.events['CA001'],tax_withholding_pct=None)
        with self.assertRaisesRegex(ValueError,'Withholding'):
            preview(e,D(500),D(38),D(15000),policy=self.policy)

    def test_bonus_fraction(self):
        with self.assertRaisesRegex(ValueError,'Fraction'): self.run_preview('CA003','1001','22')

    def test_name_missing_terms(self):
        with self.assertRaisesRegex(ValueError,'Reviewed'): self.run_preview('CA014','1200','19.50')

    def test_split_invalid_ratio(self):
        e=dict(self.events['CA002'],ratio_denominator=D(0))
        with self.assertRaisesRegex(ValueError,'ratio'):
            preview(e,D(200),D(150),D(0),policy=self.policy)

    def test_negative_holding_rejected(self):
        with self.assertRaisesRegex(ValueError,'Negative'): self.run_preview('CA001','-500','38')

    def test_unknown_rule_not_guessed(self):
        with self.assertRaisesRegex(ValueError,'dedicated'): self.run_preview('CA005','1500','18')

    def test_rounding_policy_required(self):
        with self.assertRaises(ValueError): CalculationPolicy(2,ROUND_HALF_EVEN,'')

if __name__=='__main__': unittest.main()
