"""OPTIONAL — only use if IndexDemoProduct does NOT exist. Never inserts duplicates."""
from common import open_driver, DB_NAME, one
TOTAL=100_000
BATCH=2_000
SEED="""
UNWIND $ids AS i
CREATE (:IndexDemoProduct {
 sku: 'SKU-' + toString(i),
 name: CASE WHEN i % 5 = 0 THEN 'Laptop Model ' + toString(i) ELSE 'Phone Model ' + toString(i) END,
 description: 'Product description ' + toString(i),
 category_id: i % 20,
 price: 100000 + (i % 1000) * 1000,
 is_active: true
})
"""
def main():
    with open_driver() as driver, driver.session(database=DB_NAME) as session:
        count=one(session,'MATCH (p:IndexDemoProduct) RETURN count(p) AS n')['n']
        if count==TOTAL:
            print('100000 Nodes da ton tai. Khong tao them. Chay 01_validate.py.')
            return
        if count:
            raise RuntimeError(f'Hien co {count} IndexDemoProduct! Script se KHONG ghi them, can kiem tra truoc.')
        print('Se tao dung 100000 Node; 2000 Node/transaction. KHONG goi lai khi chua kiem tra.')
        if input('Nhap TAO de bat dau: ').strip()!='TAO': return
        for low in range(1,TOTAL+1,BATCH):
            high=min(TOTAL,low+BATCH-1)
            session.run(SEED,ids=list(range(low,high+1))).consume()
            print('Created through',high)
        print('Hoan tat. Chay 01_validate.py.')
if __name__=='__main__':main()
