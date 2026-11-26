"""Write overhead: same data (value=1..5000, name='Product i') as SQL reference.
Only deletes the dedicated Topic2WriteNoIndexBench and Topic2WriteWithIndexBench labels.
"""
from statistics import median
from time import perf_counter
from common import open_driver, DB_NAME, RESULTS, save_csv, one

NODES=5000
WARMUPS=1
ROUNDS=7
LABELS={'no_index':'Topic2WriteNoIndexBench','with_index':'Topic2WriteWithIndexBench'}
INDEX_NAME='idx_topic2_writebench_value'

def clear(session,label):
    # label is fixed in source code, not from user input
    session.run(f'MATCH (p:{label}) DETACH DELETE p').consume()

def insert(session,label):
    query=f"""UNWIND range(1,$n) AS i
CREATE (p:{label} {{value:i, name:'Product ' + toString(i)}})
RETURN count(p) AS inserted"""
    start=perf_counter()
    n=session.run(query,n=NODES).single(strict=True)['inserted']
    ms=(perf_counter()-start)*1000
    return n,ms

def main():
    print('Will clean ONLY the two test labels and create a single test index.')
    print('Never deletes IndexDemoProduct, Product or the 3 main topic indexes.')
    if input('Type YES to confirm: ').strip()!='YES':return
    rows=[]; measured={'no_index':[],'with_index':[]}
    with open_driver() as driver, driver.session(database=DB_NAME) as session:
        for label in LABELS.values():
            current=one(session,f'MATCH (p:{label}) RETURN count(p) AS n')['n']
            if current:print('Warning:',label,'has',current,'previous test nodes; cleanup follows.')
        session.run(f'CREATE RANGE INDEX {INDEX_NAME} IF NOT EXISTS FOR (p:{LABELS["with_index"]}) ON (p.value)').consume()
        session.run('CALL db.awaitIndex($name, 300)',name=INDEX_NAME).consume()
        for name in LABELS.values():clear(session,name)
        try:
            for trial in range(0,ROUNDS+1):
                warmup=trial==0
                order=('no_index','with_index') if trial%2 else ('with_index','no_index')
                for mode in order:
                    label=LABELS[mode]
                    clear(session,label)
                    n,ms=insert(session,label)
                    if n!=NODES:raise RuntimeError(f'{mode}: inserted={n}, expected={NODES}')
                    clear(session,label)  # excluded from timed region
                    if not warmup:
                        measured[mode].append(ms)
                        rows.append({'trial':trial,'mode':mode,'inserted':n,'client_wall_ms':round(ms,4)})
                        print(f'Trial {trial} {mode}: {ms:.3f}ms')
        finally:
            for label in LABELS.values(): clear(session,label)
    summary=[{'mode':mode,'nodes_per_trial':NODES,'median_client_wall_ms':round(median(samples),4)}
             for mode,samples in measured.items()]
    save_csv('neo4j_write_runs.csv',['trial','mode','inserted','client_wall_ms'],rows)
    save_csv('neo4j_write_summary.csv',list(summary[0].keys()),summary)
    print('Saved results/neo4j_write_runs.csv and neo4j_write_summary.csv')
    print('Note: within-Neo4j overhead only; different from SQL Server server-side duration measurement.')

if __name__=='__main__':main()
