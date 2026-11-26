"""Offline verification of existing Neo4j Topic 2 CSV evidence. No DB needed.
Run: py python/06_audit_local_outputs.py from the project root.
Does NOT modify benchmark results or rerun experiments.
"""
import csv
from collections import Counter
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / 'results'

def rows(name):
    with (RESULTS / name).open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

def approx(a,b,rel=0.00025):
    return abs(a-b) <= max(0.0002, abs(b)*rel)

def main():
    errors=[]
    r=rows('neo4j_read_runs.csv')
    rs=rows('neo4j_read_summary.csv')
    w=rows('neo4j_write_runs.csv')
    ws=rows('neo4j_write_summary.csv')
    if len(r)!=60:errors.append(f'read runs must be 60, got {len(r)}')
    if len(w)!=14:errors.append(f'write runs must be 14, got {len(w)}')
    rexp={'Range':300,'Composite':400,'TextSubstring':11}
    for summary in rs:
        name=summary['experiment']
        if name not in rexp: errors.append('Unexpected read experiment '+name);continue
        for mode,key in [('scan','median_scan_ms'),('index','median_index_ms')]:
            vals=[float(x['client_wall_ms']) for x in r if x['experiment']==name and x['mode']==mode]
            if len(vals)!=10:errors.append(f'{name}/{mode} expected 10 runs, got {len(vals)}');continue
            actual=median(vals)
            if not approx(actual,float(summary[key])):errors.append(f'{name}/{mode}: median mismatch')
            if any(int(x['row_count'])!=rexp[name] for x in r if x['experiment']==name and x['mode']==mode):
                errors.append(f'{name}/{mode}: query result mismatch')
        scan=float(summary['median_scan_ms']);index=float(summary['median_index_ms'])
        if not approx(scan/index,float(summary['scan_div_index_speedup'])):
            errors.append(f'{name}: speedup mismatch')
        print(f'{name}: scan={scan:.4f} ms, index={index:.4f} ms, speedup={scan/index:.2f}x')
    for summary in ws:
        mode=summary['mode'];vals=[float(x['client_wall_ms']) for x in w if x['mode']==mode]
        if len(vals)!=7:errors.append(f'{mode}: expected 7 write runs, got {len(vals)}');continue
        if any(int(x['inserted'])!=5000 for x in w if x['mode']==mode):errors.append(f'{mode}: inserted count differs from 5000')
        if not approx(median(vals),float(summary['median_client_wall_ms'])):errors.append(f'{mode}: median mismatch')
        print(f'{mode}: median={median(vals):.4f} ms over 7 runs')
    profile=rows('profile_da_do_tu_TXT.csv')
    expected={'Range':(200001,301,300),'Composite':(208101,401,400),'Text':(200001,12,11)}
    for x in profile:
        key=x['thí_nghiệm']; numbers=tuple(int(x[k]) for k in ('baseline_db_hits','indexed_db_hits','kết_quả'))
        if expected.get(key)!=numbers:errors.append(f'PROFILE evidence mismatch: {key} {numbers}')
    if len(profile)!=3:errors.append('PROFILE evidence must contain 3 cases')
    paths=[ROOT/'evidence_original'/grp/f'{prefix}_{mode}.{ext}'
           for grp,prefix in [('Range','range'),('Composite','composite'),('Text','text')]
           for mode in ('scan','index') for ext in ('txt','png')]
    missing=[str(p.relative_to(ROOT)) for p in paths if not p.exists()]
    if missing:errors.append('Missing evidence: '+', '.join(missing))
    if errors:
        print('FAIL:\n - ' + '\n - '.join(errors))
        raise SystemExit(1)
    print('PASS: 60 read runs; 14 write runs; 3 PROFILE records; 12 TXT/PNG evidence; summaries consistent.')

if __name__=='__main__':main()
