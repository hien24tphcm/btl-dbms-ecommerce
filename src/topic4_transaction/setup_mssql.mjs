#!/usr/bin/env node
/**
 * setup_mssql.mjs – Nạp mssql_flashsale_demo.sql (tạo TxDemoDB + bảng + procedure) vào SQL Server.
 * Tách script theo dòng "GO" như sqlcmd/SSMS, chạy tuần tự trên MỘT kết nối (để "USE TxDemoDB" có hiệu lực).
 * Dùng được với container txdemo_mssql hoặc container MSSQL có sẵn (vd ecommerce_mssql).
 *
 *   npm run setup:mssql
 *   MSSQL_PORT=1434 npm run setup:mssql        # nếu SQL Server map ra cổng khác
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';

const file = fileURLToPath(new URL('./mssql_flashsale_demo.sql', import.meta.url));
const text = await readFile(file, 'utf8');
const batches = text.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);

const cfg = {
  server: process.env.MSSQL_HOST || 'localhost',
  port: Number(process.env.MSSQL_PORT || 1433),
  user: process.env.MSSQL_USER || 'sa',
  password: process.env.MSSQL_PASSWORD || 'Password_123#',
  database: 'master',
  options: { encrypt: true, trustServerCertificate: true },
  pool: { min: 1, max: 1 },
  connectionTimeout: 30000,
};

let pool;
for (let attempt = 1; ; attempt++) {           // SQL Server cần ~10-30s sau khi container khởi động
  try { pool = await new sql.ConnectionPool(cfg).connect(); break; }
  catch (e) {
    if (attempt >= 10) {
      console.error(`Không kết nối được ${cfg.server}:${cfg.port} – ${e.message}`);
      console.error('=> docker compose --profile mssql up -d   (hoặc bật container MSSQL sẵn có)');
      process.exit(1);
    }
    console.log(`Chờ SQL Server sẵn sàng... (${attempt}/10)`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

try {
  for (const [i, b] of batches.entries()) {
    const r = await pool.request().batch(b);
    if (r.recordset?.length) console.table(r.recordset);
    process.stdout.write(`batch ${i + 1}/${batches.length} OK\r`);
  }
  const v = await pool.request().query(
    "SELECT DB_NAME() AS db, COUNT(*) AS demo_procs FROM sys.procedures WHERE name LIKE 'demo[_]%'");
  console.log('\nĐã nạp xong:', v.recordset[0]);
} catch (e) {
  console.error('\nLỗi khi nạp script:', e.message);
  process.exitCode = 1;
} finally {
  await pool.close();
}
