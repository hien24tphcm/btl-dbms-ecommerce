"""Read-only Neo4j demo: validates three indexes and records six PROFILE plans.

Neo4j Python Driver 6.x exposes ResultSummary.profile as a dict. Older
versions may supply a plan object. Support BOTH; do not silently export
'unknown' plans. Run from project root: py python/05_demo_readonly.py
"""
from collections.abc import Mapping
from common import open_driver, DB_NAME, save_csv

EXPERIMENTS = [
    ("Range", "Scan", "MATCH (p:IndexDemoProduct) USING SCAN p:IndexDemoProduct WHERE p.price >= 154000 AND p.price <= 156000 RETURN count(p) AS total", 300),
    ("Range", "Index", "MATCH (p:IndexDemoProduct) USING RANGE INDEX p:IndexDemoProduct(price) WHERE p.price >= 154000 AND p.price <= 156000 RETURN count(p) AS total", 300),
    ("Composite", "Scan", "MATCH (p:IndexDemoProduct) USING SCAN p:IndexDemoProduct WHERE p.category_id=7 AND p.price>=155000 AND p.price<=235000 RETURN count(p) AS total", 400),
    ("Composite", "Index", "MATCH (p:IndexDemoProduct) USING RANGE INDEX p:IndexDemoProduct(category_id, price) WHERE p.category_id=7 AND p.price>=155000 AND p.price<=235000 RETURN count(p) AS total", 400),
    ("Text", "Scan", "MATCH (p:IndexDemoProduct) USING SCAN p:IndexDemoProduct WHERE p.name CONTAINS 'Model 7777' RETURN count(p) AS total", 11),
    ("Text", "Index", "MATCH (p:IndexDemoProduct) USING TEXT INDEX p:IndexDemoProduct(name) WHERE p.name CONTAINS 'Model 7777' RETURN count(p) AS total", 11),
]

def field(plan, *names):
    if isinstance(plan, Mapping):
        for name in names:
            if name in plan:
                return plan[name]
    for name in names:
        val = getattr(plan, name, None)
        if val is not None:
            return val
    return None

def flatten_plan(plan, depth=0):
    if not plan:
        return []
    operator = field(plan, 'operatorType', 'operator_type') or 'NOT_AVAILABLE'
    hits = field(plan, 'dbHits', 'db_hits')
    rows = field(plan, 'rows')
    details = field(plan, 'details') or ''
    part = ('  ' * depth) + str(operator)
    if rows is not None:
        part += f' [Rows={rows}]'
    if hits is not None:
        part += f' [DB Hits={hits}]'
    if details:
        part += ' :: ' + str(details)
    steps = [part]
    for child in field(plan, 'children') or []:
        steps.extend(flatten_plan(child, depth + 1))
    return steps

def main():
    records=[]
    with open_driver() as driver, driver.session(database=DB_NAME) as session:
        total = session.run('MATCH (p:IndexDemoProduct) RETURN count(p) AS n').single(strict=True)['n']
        if total != 100000:
            raise RuntimeError(f'Expected 100000 IndexDemoProduct; got {total}. Stop; do not delete any nodes.')
        indexes = {x['name']:(x['type'],x['state']) for x in session.run('SHOW INDEXES YIELD name,type,state RETURN name,type,state')}
        for name, typ in {'idx_demo_price':'RANGE','idx_demo_category_price':'RANGE','idx_demo_name':'TEXT'}.items():
            if indexes.get(name) != (typ, 'ONLINE'):
                raise RuntimeError(f'{name} is not {typ} ONLINE: {indexes.get(name)}')
        print('Dataset and three indexes: PASS')
        for experiment, method, body, expected in EXPERIMENTS:
            result = session.run('PROFILE ' + body)
            row = result.single(strict=True)
            summary = result.consume()
            actual = row['total']
            if actual != expected:
                raise RuntimeError(f'{experiment}/{method}: expected {expected}, got {actual}')
            plan = getattr(summary, 'profile', None)
            steps = flatten_plan(plan)
            if not steps:
                # Neo4j 6.x usually returns a dict. Some drivers may not
                # expose a PROFILE plan for certain query/runtime combinations.
                steps = ['PROFILE_NOT_EXPOSED_BY_DRIVER; capture Neo4j Query UI Plan']
            description = ' | '.join(steps)
            print(f'{experiment}/{method}: {actual}; {description[:220]}')
            records.append({'experiment':experiment,'method':method,'result':actual,
                            'plan_status':'OK' if 'PROFILE_NOT_EXPOSED' not in description else 'UI_REQUIRED',
                            'plan_description':description})
    save_csv('neo4j_demo_profile_current.csv', list(records[0].keys()), records)
    print('PASS: six queries returned expected counts.')
    print('Saved results/neo4j_demo_profile_current.csv; inspect plan_status and plan_description before citing.')
    print('For official screenshots/DB Hits, retain evidence_original/*.txt and *.png.')

if __name__ == '__main__':
    main()
