"""Run before benchmarking; READ ONLY; does not create/destroy nodes or indexes."""
from common import open_driver, DB_NAME, one

CHECK = """
MATCH (p:IndexDemoProduct)
WITH p, toInteger(split(p.sku,'-')[1]) AS i
RETURN count(p) AS total,
       count(DISTINCT p.sku) AS distinct_sku,
       min(i) AS min_id, max(i) AS max_id,
       sum(CASE WHEN i >= 1 AND i <= 100000
          AND p.sku = 'SKU-' + toString(i)
          AND p.name = CASE WHEN i % 5 = 0
              THEN 'Laptop Model ' + toString(i)
              ELSE 'Phone Model ' + toString(i) END
          AND p.description = 'Product description ' + toString(i)
          AND p.category_id = i % 20
          AND p.price = 100000 + (i % 1000) * 1000
          AND p.is_active = true
         THEN 0 ELSE 1 END) AS invalid_rows
"""
INDEX_NAMES = ['idx_demo_price', 'idx_demo_category_price', 'idx_demo_name']


def main():
    with open_driver() as driver, driver.session(database=DB_NAME) as session:
        r = one(session, CHECK)
        data = dict(r)
        print('DATASET:', data)
        if data != {'total':100000, 'distinct_sku':100000, 'min_id':1, 'max_id':100000, 'invalid_rows':0}:
            raise RuntimeError('Dataset khong khop SQL benchmark. KHONG do benchmark; kiem tra seed truoc.')
        rows = list(session.run('SHOW INDEXES YIELD name, type, state RETURN name, type, state'))
        by_name = {x['name']: x for x in rows}
        for name in INDEX_NAMES:
            item = by_name.get(name)
            if item is None or item['state'] != 'ONLINE':
                raise RuntimeError(f'Index {name} khong ton tai/khong ONLINE.')
            print('INDEX:', name, item['type'], item['state'])
        expected = {'idx_demo_price':'RANGE','idx_demo_category_price':'RANGE','idx_demo_name':'TEXT'}
        for name,t in expected.items():
            if by_name[name]['type'] != t:
                raise RuntimeError(f'Index {name}: mong doi {t}, nhan duoc {by_name[name]["type"]}')
        cases = {
            'Range': ('MATCH (p:IndexDemoProduct) WHERE p.price >= 154000 AND p.price <= 156000 RETURN count(p) AS total', 300),
            'Composite': ('MATCH (p:IndexDemoProduct) WHERE p.category_id = 7 AND p.price >= 155000 AND p.price <= 235000 RETURN count(p) AS total', 400),
            'Text': ("MATCH (p:IndexDemoProduct) WHERE p.name CONTAINS 'Model 7777' RETURN count(p) AS total", 11),
        }
        for label,(query,expected_n) in cases.items():
            number=one(session,query)['total']
            print('COUNT:',label,number)
            if number!=expected_n:
                raise RuntimeError(f'{label}: so dong {number}, mong doi {expected_n}')
    print('PASS: 100000 records; exact seed formula, 3 indexes ONLINE, expected result counts 300/400/11.')

if __name__=='__main__': main()
