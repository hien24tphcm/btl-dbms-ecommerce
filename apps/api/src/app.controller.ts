import { Controller, Get, Inject } from '@nestjs/common';
import { MssqlService } from './database/mssql.service';

@Controller()
export class AppController {
  constructor(@Inject(MssqlService) private readonly db: MssqlService) {}

  @Get()
  async getApiRoot() {
    const dbRes = await this.db.query(`
      SELECT 
        DB_NAME() AS database_name,
        (SELECT COUNT(*) FROM dbo.Users) AS total_users,
        (SELECT COUNT(*) FROM dbo.Sellers) AS total_sellers,
        (SELECT COUNT(*) FROM dbo.Products) AS total_products,
        (SELECT COUNT(*) FROM dbo.Orders) AS total_orders
    `);

    return {
      status: 'OK',
      service: 'Multi-Vendor E-Commerce NestJS Backend (6 Modules)',
      database: dbRes.recordset[0] || { database_name: 'ECommerceDB' },
      frontendUrl: 'http://localhost:3005',
      modules: {
        '1_AuthModule': ['/api/auth/users', 'POST /api/auth/login'],
        '2_CatalogModule (FR-01, FR-02)': [
          '/api/categories',
          '/api/products',
          '/api/products/1',
          '/api/products/1/rating-stats',
        ],
        '3_CartOrderModule (FR-03..FR-06)': [
          '/api/cart?userId=7',
          '/api/vouchers',
          '/api/buyer/orders?buyerId=7',
          '/api/orders/1?userId=7',
        ],
        '4_SellerModule (FR-07..FR-10)': [
          '/api/seller/products?sellerId=1',
          '/api/seller/orders?sellerId=1',
          '/api/seller/analytics?sellerId=1',
        ],
        '5_AdminModule (FR-11, FR-12)': [
          '/api/admin/users',
          '/api/admin/sellers',
          '/api/admin/analytics?adminId=1',
        ],
        '6_DbmsLabModule (5 DBMS Topics)': [
          '/api/dbms-lab/introspection',
          'POST /api/dbms-lab/integrity-check',
        ],
      },
    };
  }
}
