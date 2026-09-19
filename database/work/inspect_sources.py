import csv, json, hashlib
from pathlib import Path
src=Path('/Users/likki/Downloads/UC 4 data32a2081')
result={}
for p in sorted(src.glob('*.csv')):
 with p.open(newline='',encoding='utf-8-sig') as f: rows=list(csv.reader(f,strict=True))
 h=rows[0]; good=[r for r in rows[1:] if len(r)==len(h)]
 result[p.name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'header':h,'row_count':len(rows)-1,'malformed_rows':[{'line':i,'fields':len(r),'raw_fields':r} for i,r in enumerate(rows[1:],2) if len(r)!=len(h)],'duplicate_complete_rows':len(good)-len(set(map(tuple,good))),'columns':{c:{'empty_count_among_structurally_valid_rows':sum(r[j]=='' for r in good),'distinct_values':sorted(set(r[j] for r in good))} for j,c in enumerate(h)}}
Path('outputs/database/data/source_inventory.json').write_text(json.dumps(result,indent=2))
text=['# Supplied CSV schema inspection','Source files are read only. Detailed values, empty counts, row anomalies and SHA-256 hashes are in `data/source_inventory.json`.']
for name,v in result.items():
 text += ['\n## '+name, f"{v['row_count']} data rows; {len(v['malformed_rows'])} malformed rows; {v['duplicate_complete_rows']} duplicate complete valid rows.", '```text',','.join(v['header']),'```']
Path('outputs/database/docs/SOURCE_INSPECTION.md').write_text('\n'.join(text)+'\n')
