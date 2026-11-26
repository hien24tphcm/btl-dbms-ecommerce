#!/usr/bin/env node
/**
 * run_flashsale.mjs – Mô phỏng N người mua đồng thời cùng 1 sản phẩm còn ít tồn kho,
 * chạy trên MSSQL và/hoặc Neo4j, rồi kiểm chứng bất biến:
 *        stock cuối + tổng số lượng đã đặt = tồn kho ban đầu   (và stock >= 0)
 *
 * Chuẩn bị:  docker compose up -d   ;   npm install   ;   npm run setup:mssql   (xem README.md)
 * Chạy:
 *   node run_flashsale.mjs                                  # cả 2 DBMS, mọi chế độ
 *   node run_flashsale.mjs --db mssql --mode UPDLOCK
 *   node run_flashsale.mjs --db neo4j --mode all --buyers 50 --stock 5 --think 100 --repeat 5
 *   node run_flashsale.mjs --db mssql --mode REPEATABLE --retry 3
 *   node run_flashsale.mjs --db both --fail-every 4          # kiểm chứng Atomicity
 *   node run_flashsale.mjs --db mssql --mode NAIVE --check   # CHECK (stock>=0) không chữa lost update
 *
 * Tham số:
 *   --db          mssql | neo4j | both       (mặc định both)
 *   --mode        all | tên chế độ           MSSQL: NAIVE ATOMIC UPDLOCK REPEATABLE SNAPSHOT
 *                                            Neo4j: NAIVE SINGLE_STMT LOCK_FIRST
 *   --buyers      số người mua đồng thời     (mặc định 20)
 *   --stock       tồn kho ban đầu            (mặc định 5)
 *   --think       ms "xử lý" trong giao dịch (mặc định 200; nên chạy thêm với 0)
 *   --qty         số lượng mỗi đơn           (mặc định 1)
 *   --retry       số lần thử lại khi deadlock/conflict (mặc định 0) – áp dụng GIỐNG NHAU cho
 *                 cả 2 DBMS (Neo4j dùng unmanaged transaction để tắt retry ngầm của driver)
 *   --repeat      số lần lặp mỗi chế độ      (mặc định 1; race không tất định nên nên lặp >= 5)
 *   --fail-every  N > 0: người mua thứ N, 2N, ... gặp sự cố SAU khi đã trừ kho (Atomicity)
 *   --check       (chỉ MSSQL) bật CHECK (stock_qty >= 0)
 *   --verbose     in nguyên văn thông điệp deadlock/conflict đầu tiên của mỗi lần chạy (để trích dẫn)
 *
 * Biến môi trường (có mặc định khớp docker-compose.yml):
 *   MSSQL_HOST MSSQL_PORT MSSQL_USER MSSQL_PASSWORD MSSQL_DB
 *   NEO4J_URI NEO4J_USER NEO4J_PASSWORD NEO4J_DB
 */

const MSSQL_MODES = ['NAIVE', 'ATOMIC', 'UPDLOCK', 'REPEATABLE', 'SNAPSHOT'];
const NEO4J_MODES = ['NAIVE', 'SINGLE_STMT', 'LOCK_FIRST'];
const PID = 1;

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { o[key] = next; i++; } else { o[key] = true; }
  }
  return o;
}

const a = parseArgs(process.argv.slice(2));
const opt = {
  db: String(a.db ?? 'both').toLowerCase(),
  mode: String(a.mode ?? 'all').toUpperCase(),
  buyers: Number(a.buyers ?? 20),
  stock: Number(a.stock ?? 5),
  think: Number(a.think ?? 200),
  qty: Number(a.qty ?? 1),
  retry: Number(a.retry ?? 0),
  repeat: Number(a.repeat ?? 1),
  failEvery: Number(a['fail-every'] ?? 0),
  check: Boolean(a.check),
  verbose: Boolean(a.verbose),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shouldFail = (buyerId) => opt.failEvery > 0 && buyerId % opt.failEvery === 0;
const rows = [];

// --verbose: in thông điệp lỗi deadlock/conflict đầu tiên của mỗi lần chạy
let printedThisRun = false;
function logFirst(tag, message) {
  if (!opt.verbose || printedThisRun) return;
  printedThisRun = true;
  console.log(`\n[${tag}] thông điệp lỗi đầu tiên:\n${message}\n`);
}

/** Chạy 1 kịch bản: reset -> N người mua đồng thời -> verify. */
async function runScenario({ db, mode, reset, buy, verify }) {
  await reset();
  printedThisRun = false;
  const stats = { OK: 0, SOLD_OUT: 0, DEADLOCK: 0, CONFLICT: 0, FAILED: 0, CHECK: 0, OTHER: 0 };
  // Đếm MỌI lần gặp deadlock/conflict, kể cả lần đã được thử lại thành công sau đó
  // (stats.DEADLOCK/CONFLICT chỉ đếm người mua thất bại ở lần thử cuối cùng)
  const events = { deadlock: 0, conflict: 0 };
  let retries = 0;
  const t0 = performance.now();

  await Promise.all(
    Array.from({ length: opt.buyers }, (_, i) => (async () => {
      for (let attempt = 0; ; attempt++) {
        const r = await buy(i + 1);
        if (r === 'DEADLOCK') events.deadlock++;
        if (r === 'CONFLICT') events.conflict++;
        if ((r === 'DEADLOCK' || r === 'CONFLICT') && attempt < opt.retry) {
          retries++;
          await sleep(20 + Math.random() * 60);
          continue;
        }
        stats[r] = (stats[r] ?? 0) + 1;
        break;
      }
    })())
  );

  const ms = Math.round(performance.now() - t0);
  const v = await verify();
  return {
    db, mode, buyers: opt.buyers, stock: opt.stock,
    ok: stats.OK, soldOut: stats.SOLD_OUT, deadlock: stats.DEADLOCK,
    conflict: stats.CONFLICT, failed: stats.FAILED, checkErr: stats.CHECK,
    other: stats.OTHER, retries, dlEvents: events.deadlock, cfEvents: events.conflict,
    orders: v.orders, finalStock: v.finalStock, oversold: v.oversold,
    verdict: v.verdict, ms,
  };
}

/** Phân loại giống dbo.demo_Verify bên MSSQL. */
function verdictOf(initial, finalStock, units) {
  if (finalStock + units === initial && finalStock >= 0) return 'CONSISTENT';
  const v = [];
  if (finalStock + units > initial) v.push('LOST_UPDATE');
  if (finalStock + units < initial) v.push('LEAKED_STOCK');
  if (finalStock < 0) v.push('NEGATIVE_STOCK');
  return v.join(' + ');
}

/* ============================== MSSQL ============================== */
async function runMssql() {
  const sql = (await import('mssql')).default;
  const modes = opt.mode === 'ALL' ? MSSQL_MODES : MSSQL_MODES.filter((m) => m === opt.mode);
  if (modes.length === 0) { console.log(`[mssql] bỏ qua: chế độ ${opt.mode} không áp dụng`); return; }

  const pool = await new sql.ConnectionPool({
    server: process.env.MSSQL_HOST || 'localhost',
    port: Number(process.env.MSSQL_PORT || 1433),
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD || 'Password_123#',
    database: process.env.MSSQL_DB || 'TxDemoDB',
    options: { encrypt: true, trustServerCertificate: true },
    pool: { min: opt.buyers, max: opt.buyers + 2 },
    requestTimeout: 120000,
  }).connect();

  try {
    // khởi động sẵn connection pool để thời gian mở kết nối không làm sai lệch số đo
    await Promise.all(Array.from({ length: opt.buyers }, () => pool.request().query('SELECT 1')));

    for (const mode of modes) {
      for (let rep = 1; rep <= opt.repeat; rep++) {
        const row = await runScenario({
          db: 'MSSQL', mode,
          reset: () => pool.request()
            .input('product_id', sql.Int, PID).input('stock', sql.Int, opt.stock)
            .input('with_check', sql.Bit, opt.check)
            .execute('dbo.demo_Reset'),
          buy: async (buyerId) => {
            try {
              await pool.request()
                .input('product_id', sql.Int, PID)
                .input('buyer_id', sql.Int, buyerId)
                .input('qty', sql.Int, opt.qty)
                .input('mode', sql.VarChar(12), mode)
                .input('think_ms', sql.Int, opt.think)
                .input('fail_after_write', sql.Bit, shouldFail(buyerId))
                .execute('dbo.demo_Checkout');
              return 'OK';
            } catch (e) {
              const n = e.number ?? e.originalError?.info?.number;
              if (n === 50003) return 'SOLD_OUT';
              if (n === 50099) return 'FAILED';
              if (n === 1205) { logFirst(`mssql/${mode}`, `Msg ${n}: ${e.message}`); return 'DEADLOCK'; }
              if (n === 3960) { logFirst(`mssql/${mode}`, `Msg ${n}: ${e.message}`); return 'CONFLICT'; }
              if (n === 547) return 'CHECK';
              console.error(`[mssql/${mode}] lỗi không phân loại (${n}):`, e.message);
              return 'OTHER';
            }
          },
          verify: async () => {
            const r = (await pool.request().input('product_id', sql.Int, PID)
              .execute('dbo.demo_Verify')).recordset[0];
            return {
              orders: r.orders, finalStock: r.final_stock,
              oversold: r.oversold_units, verdict: r.verdict,
            };
          },
        });
        rows.push(row);
      }
    }
  } finally {
    await pool.close();
  }
}

/* ============================== Neo4j ============================== */
class SoldOut extends Error {}
class SimulatedFailure extends Error {}

async function runNeo4j() {
  const neo4j = (await import('neo4j-driver')).default;
  const modes = opt.mode === 'ALL' ? NEO4J_MODES : NEO4J_MODES.filter((m) => m === opt.mode);
  if (modes.length === 0) { console.log(`[neo4j] bỏ qua: chế độ ${opt.mode} không áp dụng (Neo4j không có mức cô lập này)`); return; }
  if (opt.check) console.log('[neo4j] --check bị bỏ qua: Neo4j không có ràng buộc miền giá trị (CHECK)');

  const DB = process.env.NEO4J_DB || 'neo4j';
  const driver = neo4j.driver(
    process.env.NEO4J_URI || 'neo4j://localhost:7687',
    neo4j.auth.basic(process.env.NEO4J_USER || 'neo4j', process.env.NEO4J_PASSWORD || 'password123'),
    { maxConnectionPoolSize: opt.buyers + 5, connectionAcquisitionTimeout: 120000 }
  );
  const I = (n) => neo4j.int(n); // BẮT BUỘC: số JS mặc định bị gửi dạng FLOAT
  const toNum = (x) => (neo4j.isInt(x) ? x.toNumber() : Number(x));

  const ORDER = `CREATE (b)-[:PLACED]->(o:Order {id: randomUUID(), qty: $qty, createdAt: datetime()})-[:FOR]->(p)`;

  try {
    await driver.verifyConnectivity();

    // schema tách riêng, không trộn với giao dịch dữ liệu
    let s = driver.session({ database: DB });
    try {
      await s.run('CREATE CONSTRAINT product_id_unique IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE');
      await s.run('CREATE CONSTRAINT buyer_id_unique IF NOT EXISTS FOR (b:Buyer) REQUIRE b.id IS UNIQUE');
    } finally { await s.close(); }

    const reset = async () => {
      const ss = driver.session({ database: DB });
      try {
        await ss.run('MATCH (o:Order) DETACH DELETE o');
        // Xoá hẳn rồi tạo mới node Product (không MERGE): node từng có >= 50 quan hệ sẽ ở dạng "dense"
        // và có thể dùng cơ chế khoá khác khi tạo quan hệ – tránh để lần chạy trước ảnh hưởng lần sau.
        await ss.run('MATCH (p:Product {id: $pid}) DETACH DELETE p', { pid: I(PID) });
        await ss.run(
          `CREATE (p:Product {id: $pid, name: 'Flash Sale Phone', stock: $stock, initialStock: $stock})`,
          { pid: I(PID), stock: I(opt.stock) });
        await ss.run('UNWIND range(1, $n) AS i MERGE (:Buyer {id: i})', { n: I(opt.buyers) });
      } finally { await ss.close(); }
    };

    const verify = async () => {
      const ss = driver.session({ database: DB });
      try {
        const r = await ss.run(
          `MATCH (p:Product {id: $pid})
           OPTIONAL MATCH (o:Order)-[:FOR]->(p)
           RETURN p.initialStock AS initial, p.stock AS finalStock,
                  count(o) AS orders, coalesce(sum(o.qty), 0) AS units`,
          { pid: I(PID) });
        const rec = r.records[0];
        const initial = toNum(rec.get('initial'));
        const finalStock = toNum(rec.get('finalStock'));
        const units = toNum(rec.get('units'));
        return {
          orders: toNum(rec.get('orders')), finalStock,
          oversold: Math.max(0, units - initial),
          verdict: verdictOf(initial, finalStock, units),
        };
      } finally { await ss.close(); }
    };

    // Nội dung giao dịch (giống hệt nhau giữa các lần thử)
    const body = (mode, buyerId) => async (tx) => {
      const p = { pid: I(PID), bid: I(buyerId), qty: I(opt.qty) };
      const failHere = () => { if (shouldFail(buyerId)) throw new SimulatedFailure(); };

      // ---- SINGLE_STMT: kiểm tra + trừ kho trong 1 câu Cypher ----
      if (mode === 'SINGLE_STMT') {
        // Tách CREATE Order ra sau để có chỗ chèn sự cố giữa "trừ kho" và "tạo đơn"
        const r = await tx.run(
          `MATCH (p:Product {id: $pid})
           WHERE p.stock >= $qty
           SET p.stock = p.stock - $qty
           RETURN p.stock AS stock`, p);
        if (r.records.length === 0) throw new SoldOut();
        if (opt.think > 0) await sleep(opt.think);
        failHere();
        await tx.run(`MATCH (p:Product {id: $pid}) MATCH (b:Buyer {id: $bid}) ${ORDER}`, p);
        return;
      }

      // ---- LOCK_FIRST: lấy write-lock tường minh trước khi đọc ----
      if (mode === 'LOCK_FIRST') {
        await tx.run('MATCH (p:Product {id: $pid}) SET p._lock = true', p);
      }

      // Bước 1: ĐỌC
      const r = await tx.run('MATCH (p:Product {id: $pid}) RETURN p.stock AS stock', p);
      const stock = toNum(r.records[0].get('stock'));
      // Bước 2: KIỂM TRA
      if (stock < opt.qty) throw new SoldOut();
      // Bước 3: "xử lý"
      if (opt.think > 0) await sleep(opt.think);
      // Bước 4: GHI (trừ kho)
      if (mode === 'NAIVE') {
        await tx.run('MATCH (p:Product {id: $pid}) SET p.stock = $newStock',
          { ...p, newStock: I(stock - opt.qty) });                       // giá trị tính từ lần đọc cũ
      } else {
        await tx.run('MATCH (p:Product {id: $pid}) SET p.stock = p.stock - $qty REMOVE p._lock', p);
      }
      failHere();
      // Bước 5: tạo đơn
      await tx.run(`MATCH (p:Product {id: $pid}) MATCH (b:Buyer {id: $bid}) ${ORDER}`, p);
    };

    // Unmanaged transaction: KHÔNG dùng executeWrite vì driver sẽ tự retry ngầm các lỗi transient
    // (deadlock...) => số liệu không so sánh được với MSSQL. Retry do runScenario điều khiển (--retry).
    const buyFn = (mode) => async (buyerId) => {
      const session = driver.session({ database: DB, defaultAccessMode: neo4j.session.WRITE });
      const tx = session.beginTransaction();
      try {
        await body(mode, buyerId)(tx);
        await tx.commit();
        return 'OK';
      } catch (e) {
        if (tx.isOpen()) await tx.rollback().catch(() => {});
        if (e instanceof SoldOut) return 'SOLD_OUT';
        if (e instanceof SimulatedFailure) return 'FAILED';
        const code = String(e.code || '');
        if (code.includes('DeadlockDetected')) { logFirst(`neo4j/${mode}`, `${code}\n${e.message}`); return 'DEADLOCK'; }
        console.error(`[neo4j/${mode}] lỗi không phân loại:`, code, e.message);
        return 'OTHER';
      } finally {
        await session.close();
      }
    };

    // khởi động pool
    await Promise.all(Array.from({ length: opt.buyers }, async () => {
      const ss = driver.session({ database: DB });
      try { await ss.run('RETURN 1'); } finally { await ss.close(); }
    }));

    for (const mode of modes) {
      for (let rep = 1; rep <= opt.repeat; rep++) {
        rows.push(await runScenario({ db: 'Neo4j', mode, reset, buy: buyFn(mode), verify }));
      }
    }
  } finally {
    await driver.close();
  }
}

/* ============================== main ============================== */
console.log(`Cấu hình: ${JSON.stringify(opt)}`);
try {
  if (opt.db === 'mssql' || opt.db === 'both') await runMssql();
  if (opt.db === 'neo4j' || opt.db === 'both') await runNeo4j();
} catch (e) {
  console.error('Lỗi chạy demo:', e.message ?? e);
  if (e.code === 'ESOCKET' || e.code === 'ServiceUnavailable')
    console.error('=> Kiểm tra container đã chạy chưa: docker compose ps  (xem README.md)');
  process.exitCode = 1;
}

if (rows.length) {
  console.table(rows);

  if (opt.repeat > 1) {
    const groups = new Map();
    for (const r of rows) {
      const k = `${r.db}|${r.mode}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const summary = [...groups.values()].map((g) => ({
      db: g[0].db, mode: g[0].mode, runs: g.length,
      anomalyRuns: g.filter((r) => r.verdict !== 'CONSISTENT').length,
      avgOk: +(g.reduce((s, r) => s + r.ok, 0) / g.length).toFixed(1),
      avgOversold: +(g.reduce((s, r) => s + r.oversold, 0) / g.length).toFixed(1),
      avgDeadlock: +(g.reduce((s, r) => s + r.dlEvents, 0) / g.length).toFixed(1),   // mọi lần gặp, kể cả đã retry
      avgConflict: +(g.reduce((s, r) => s + r.cfEvents, 0) / g.length).toFixed(1),
      avgFinalFail: +(g.reduce((s, r) => s + r.deadlock + r.conflict, 0) / g.length).toFixed(1), // hết lượt retry
      avgMs: Math.round(g.reduce((s, r) => s + r.ms, 0) / g.length),
      verdicts: [...new Set(g.map((r) => r.verdict))].join(' | '),
    }));
    console.log('\nTỔNG HỢP theo chế độ (đưa vào báo cáo):');
    console.table(summary);
  }

  console.log(
`Cách đọc kết quả:
  ok        số đơn commit thành công            soldOut   bị từ chối vì hết hàng (50003)
  deadlock  người mua thất bại cuối cùng vì deadlock (1205 / Neo4j) – sau khi hết lượt retry
  conflict  như trên với snapshot update conflict (3960)
  dlEvents / cfEvents  tổng số LẦN gặp deadlock / conflict, kể cả lần đã retry
  (bảng TỔNG HỢP: avgDeadlock / avgConflict = TB dlEvents / cfEvents; avgFinalFail = TB deadlock + conflict)
  failed    sự cố giả lập sau khi trừ kho (--fail-every) – phải được rollback
  checkErr  bị CHECK (stock_qty >= 0) chặn (547) other     lỗi khác (xem log)
  oversold  số đơn vị bán VƯỢT tồn kho ban đầu
  verdict   CONSISTENT | LOST_UPDATE | NEGATIVE_STOCK | LEAKED_STOCK
  ms        tổng thời gian cả đợt – chỉ so sánh giữa các chế độ TRONG CÙNG một DBMS`);
}
