"""OPTIONAL: mirror EXACT SQL 03_seed.sql snapshot (24 Products + 16 Reviews) into
ISOLATED Neo4j labels; never updates the team's :Product/:Review graph or IndexDemoProduct.
Only demonstrates read/filter/aggregation parity, not full FR-06 order authorization.
"""
import json
from pathlib import Path
from common import open_driver, DB_NAME, one
DATA=Path(__file__).resolve().parents[1]/'app_reference_data'
TABLES={'sellers':('Topic2SQLSeller','seller_id',5),
        'categories':('Topic2SQLCategory','category_id',8),
        'products':('Topic2SQLProduct','product_id',24),
        'reviews':('Topic2SQLReview','review_id',16)}

def main():
    arrays={}
    for table,(_,key,expected) in TABLES.items():
        arr=json.loads((DATA/(table+'.json')).read_text(encoding='utf8'))
        if len(arr)!=expected or len({item[key] for item in arr})!=expected:
            raise RuntimeError(f'{table}: invalid seed data')
        arrays[table]=arr
    print('Will MERGE 5 sellers, 8 categories, 24 products, 16 reviews into labels Topic2SQL*.')
    print('This will NOT change the project :Product / :Review / :Seller / :Category nodes.')
    if input('Type MERGE to continue: ').strip()!='MERGE':return
    with open_driver() as driver, driver.session(database=DB_NAME) as session:
        for table,(label,key,expected) in TABLES.items():
            constr=f'topic2_sql_{table}_{key}'
            session.run(f'CREATE CONSTRAINT {constr} IF NOT EXISTS FOR (n:{label}) REQUIRE n.{key} IS UNIQUE').consume()
            session.run(f'UNWIND $rows AS row MERGE (n:{label} {{{key}:row.{key}}}) SET n += row',rows=arrays[table]).consume()
            n=one(session,f'MATCH (n:{label}) RETURN count(n) AS n')['n']
            if n!=expected: raise RuntimeError(f'Found {n} total {label}; expected {expected}. Check prior stale data.')
        session.run('''UNWIND $rows AS row
MATCH (p:Topic2SQLProduct {product_id:row.product_id})
MATCH (s:Topic2SQLSeller {seller_id:row.seller_id})
MATCH (c:Topic2SQLCategory {category_id:row.category_id})
MERGE (p)-[:SOLD_BY]->(s)
MERGE (p)-[:IN_CATEGORY]->(c)''', rows=arrays['products']).consume()
        session.run('''UNWIND $rows AS row
WITH row WHERE row.parent_id IS NOT NULL
MATCH (c:Topic2SQLCategory {category_id:row.category_id})
MATCH (parent:Topic2SQLCategory {category_id:row.parent_id})
MERGE (c)-[:CHILD_OF]->(parent)''',rows=arrays['categories']).consume()
        session.run('''UNWIND $rows AS row
MATCH (r:Topic2SQLReview {review_id:row.review_id})
MATCH (p:Topic2SQLProduct {product_id:row.product_id})
MERGE (r)-[:REVIEW_OF]->(p)''',rows=arrays['reviews']).consume()
        print('App reference graph populated. See cypher/08_fr01_fr06_reference.cypher for queries.')

if __name__=='__main__':main()
