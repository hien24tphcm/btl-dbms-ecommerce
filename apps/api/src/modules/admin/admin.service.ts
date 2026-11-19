import { Injectable, Inject } from '@nestjs/common';
import { MssqlService } from '../../database/mssql.service';

@Injectable()
export class AdminService {
  constructor(@Inject(MssqlService) private readonly db: MssqlService) {}

  /**
   * FR-11: List all users with seller association
   */
  async getUsers() {
    const res = await this.db.query(`
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.full_name,
        u.phone_number,
        u.address,
        u.role,
        u.is_active,
        u.created_at,
        u.updated_at,
        s.seller_id,
        s.shop_name,
        s.is_approved
      FROM dbo.Users u
      LEFT JOIN dbo.Sellers s ON u.user_id = s.user_id
      ORDER BY u.user_id ASC;
    `);
    return res.recordset;
  }

  /**
   * FR-11 | Query (c) Update in Transaction: dbo.sp_ModerateUserAccount
   * If deactivating a seller user, automatically cascades deactivation to all their products.
   */
  async moderateUserAccount(params: {
    adminId: number;
    targetUserId: number;
    isActive: boolean;
  }) {
    await this.db.executeProcedure('dbo.sp_ModerateUserAccount', {
      admin_id: params.adminId,
      target_user_id: params.targetUserId,
      is_active: params.isActive ? 1 : 0,
    });
    return this.getUsers();
  }

  /**
   * FR-11 & FR-12: Query View dbo.v_SellerPerformanceMetrics
   */
  async getSellers() {
    const res = await this.db.query(`
      SELECT 
        v.seller_id,
        v.shop_name,
        v.rating,
        v.is_approved,
        v.total_products,
        v.completed_orders,
        v.delivered_revenue,
        s.user_id,
        u.username,
        u.email,
        u.is_active AS user_is_active,
        s.address
      FROM dbo.v_SellerPerformanceMetrics v
      JOIN dbo.Sellers s ON v.seller_id = s.seller_id
      JOIN dbo.Users u ON s.user_id = u.user_id
      ORDER BY v.delivered_revenue DESC, v.seller_id ASC;
    `);
    return res.recordset;
  }

  /**
   * FR-11 | Query (c) Update: dbo.sp_ApproveSeller
   */
  async approveSeller(params: {
    adminId: number;
    sellerId: number;
    isApproved: boolean;
  }) {
    await this.db.executeProcedure('dbo.sp_ApproveSeller', {
      admin_id: params.adminId,
      seller_id: params.sellerId,
      is_approved: params.isApproved ? 1 : 0,
    });
    return this.getSellers();
  }

  /**
   * FR-12 | Query (g) Subquery & Query (h) Aggregate Functions:
   * - Calls dbo.sp_GetAboveAverageSellers
   * - Computes platform GMV, average seller revenue, and category consumption metrics
   */
  async getPlatformAnalytics(adminId?: number) {
    const [aboveAvgRes, allSellers, categoryStatsRes, gmvRes] =
      await Promise.all([
        this.db.executeProcedure('dbo.sp_GetAboveAverageSellers', {
          admin_id: adminId ?? null,
        }),
        this.getSellers(),
        this.db.query(`
          SELECT 
            c.category_id,
            c.category_name,
            COUNT(DISTINCT p.product_id) AS product_count,
            ISNULL(SUM(od.quantity), 0) AS total_units_sold,
            ISNULL(SUM(od.subtotal), 0.00) AS gross_category_revenue
          FROM dbo.Categories c
          LEFT JOIN dbo.Products p ON c.category_id = p.category_id
          LEFT JOIN dbo.Order_Details od ON p.product_id = od.product_id
          LEFT JOIN dbo.Orders o ON od.order_id = o.order_id AND o.order_status = 'delivered'
          GROUP BY c.category_id, c.category_name
          ORDER BY total_units_sold DESC, gross_category_revenue DESC;
        `),
        this.db.query(`
          SELECT 
            COUNT(order_id) AS total_orders,
            SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
            ISNULL(SUM(final_amount), 0.00) AS total_gmv,
            ISNULL(SUM(CASE WHEN order_status = 'delivered' THEN final_amount ELSE 0 END), 0.00) AS delivered_gmv,
            ISNULL(CAST(SUM(CASE WHEN order_status = 'delivered' THEN final_amount ELSE 0 END) * 0.05 AS DECIMAL(18,2)), 0.00) AS platform_commission_5pct
          FROM dbo.Orders;
        `),
      ]);

    const activeDeliveredSellers = allSellers.filter(
      (s: any) => Number(s.delivered_revenue) > 0,
    );
    const avgSellerDeliveredRevenue =
      activeDeliveredSellers.length > 0
        ? activeDeliveredSellers.reduce(
            (acc: number, s: any) => acc + Number(s.delivered_revenue),
            0,
          ) / activeDeliveredSellers.length
        : 0;

    return {
      gmvSummary: {
        ...(gmvRes.recordset[0] || {}),
        avg_seller_delivered_revenue: Number(
          avgSellerDeliveredRevenue.toFixed(2),
        ),
      },
      aboveAverageSellers: aboveAvgRes.recordset,
      allSellers,
      categoryConsumption: categoryStatsRes.recordset,
    };
  }
}
