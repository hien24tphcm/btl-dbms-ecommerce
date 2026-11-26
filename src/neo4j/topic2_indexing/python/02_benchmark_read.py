"""SQL-aligned benchmark, same business predicates and deterministic dataset.
Compares FORCED LABEL SCAN vs FORCED PROPERTY INDEX, NOT physically absent indexes.
Output is client-observed wall time, not Neo4j server-only query time.
"""
import json
import platform
from statistics import median
from time import perf_counter
from datetime import datetime,timezone
from common import open_driver, DB_NAME, BOLT_URI, RESULTS, save_csv, one

WARMUPS=3
ROUNDS=10
CASES={
 'Range': {
  'expected':300,
  'scan': """MATCH (p:IndexDemoProduct) USING SCAN p:IndexDemoProduct
WHERE p.price >= 154000 AND p.price <= 156000 RETURN count(p) AS total""",
  'index': """MATCH (p:IndexDemoProduct) USING RANGE INDEX p:IndexDemoProduct(price)
WHERE p.price >= 154000 AND p.price <= 156000 RETURN count(p) AS total""",
 },
 'Composite': {
  'expected':400,
  'scan': """MATCH (p:IndexDemoProduct) USING SCAN p:IndexDemoProduct
WHERE p.category_id = 7 AND p.price >= 155000 AND p.price <= 235000 RETURN count(p) AS total""",
  'index': """MATCH (p:IndexDemoProduct) USING RANGE INDEX p:IndexDemoProduct(category_id, price)
WHERE p.category_id = 7 AND p.price >= 155000 AND p.price <= 235000 RETURN count(p) AS total""",
 },
 'TextSubstring': {
  'expected':11,
  'scan': """MATCH (p:IndexDemoProduct) USING SCAN p:IndexDemoProduct
WHERE p.name CONTAINS 'Model 7777' RETURN count(p) AS total""",
  'index': """MATCH (p:IndexDemoProduct) USING TEXT INDEX p:IndexDemoProduct(name)
WHERE p.name CONTAINS 'Model 7777' RETURN count(p) AS total""",
 }
}

def timed(session,query):
    start=perf_counter()
    record=session.run(query).single(strict=True)  # consume single record
    elapsed=(perf_counter()-start)*1000
    return record['total'],elapsed


def main():
    with open_driver() as driver, driver.session(database=DB_NAME) as session:
        r=one(session,'MATCH (p:IndexDemoProduct) RETURN count(p) AS n')
        if r['n'] != 100000: raise RuntimeError(f'Expected 100000 IndexDemoProduct; got {r["n"]}')
        index_rows=list(session.run('SHOW INDEXES YIELD name,type,state RETURN name,type,state'))
        required={'idx_demo_price':'RANGE','idx_demo_category_price':'RANGE','idx_demo_name':'TEXT'}
        exists={x['name']:(x['type'],x['state']) for x in index_rows}
        for name,expected_type in required.items():
            if exists.get(name)!=(expected_type,'ONLINE'):
                raise RuntimeError(f'Index {name} must be {expected_type} ONLINE, got {exists.get(name)}')
        dbversion=list(session.run('CALL dbms.components() YIELD name, versions RETURN name,versions'))
        runs=[]; summary=[]
        for name,case in CASES.items():
            measurements={'scan':[],'index':[]}
            for mode in ('scan','index'):
                for _ in range(WARMUPS):
                    n,_=timed(session,case[mode])
                    if n!=case['expected']: raise RuntimeError(f'{name}-{mode} warmup got {n}, expected {case["expected"]}')
            for round_number in range(1,ROUNDS+1):
                order=('scan','index') if round_number%2 else ('index','scan')
                for mode in order:
                    n,ms=timed(session,case[mode])
                    if n!=case['expected']:raise RuntimeError(f'{name}-{mode}: got {n}, expected {case["expected"]}')
                    measurements[mode].append(ms)
                    runs.append({'experiment':name,'trial':round_number,'mode':mode,
                                 'row_count':n,'client_wall_ms':round(ms,4)})
            scan=median(measurements['scan']);indexed=median(measurements['index'])
            summary.append({'experiment':name,'result_count':case['expected'],
                            'median_scan_ms':round(scan,4),'median_index_ms':round(indexed,4),
                            'scan_div_index_speedup':round(scan/indexed,4) if indexed else ''})
            print(name, 'rows',case['expected'],f'scan={scan:.3f}ms',f'index={indexed:.3f}ms')
        save_csv('neo4j_read_runs.csv',['experiment','trial','mode','row_count','client_wall_ms'],runs)
        save_csv('neo4j_read_summary.csv',list(summary[0].keys()),summary)
        metadata={'time_utc':datetime.now(timezone.utc).isoformat(), 'platform':platform.platform(),
                  'python':platform.python_version(), 'uri':BOLT_URI,'database':DB_NAME,
                  'neo4j_components':[dict(x) for x in dbversion],
                  'method':'USING SCAN vs USING RANGE/TEXT INDEX; both indexes already exist',
                  'warmups':WARMUPS,'rounds':ROUNDS,
                  'measurement':'client wall ms incl. Bolt/driver/transaction; no PROFILE instrumentation',
                  'matching_sql_file':'sql_reference/01_mssql_create_100k.sql'}
        (RESULTS/'neo4j_environment.json').write_text(json.dumps(metadata,indent=2,ensure_ascii=False),encoding='utf8')
        print('Saved results/neo4j_read_runs.csv, neo4j_read_summary.csv, neo4j_environment.json')

if __name__=='__main__':main()
