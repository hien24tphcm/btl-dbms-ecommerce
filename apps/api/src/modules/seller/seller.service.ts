import { Injectable, Inject } from '@nestjs/common';
import * as sql from 'mssql';
import { MssqlService } from '../../database/mssql.service';

@Injectable()
export class SellerService {
  constructor(@Inject(MssqlService) private readonly db: MssqlService) {}

  /**
   * FR-07 & FR-08: List all products of a Seller with low-stock indicator
   */
  async getSellerProducts(sellerId: number, lowStockThreshold = 5) {
    const res = await this.db.query(
      `
      SELECT 
        p.product_id,
        p.seller_id,
        p.category_id,
        c.category_name,
        p.name,
        p.description,
        p.price,
        p.stock_quantity,
        p.sold_quantity,
        p.is_active,
        p.status,
        p.created_at,
        p.updated_at,
        CASE WHEN p.stock_quantity <= @threshold THEN 1 ELSE 0 END AS is_low_stock
      FROM dbo.Products p
      JOIN dbo.Categories c ON p.category_id = c.category_id
      WHERE p.seller_id = @seller_id
      ORDER BY p.product_id DESC;
      `,
      {
        seller_id: sellerId,
        threshold: lowStockThreshold,
      },
    );
    return res.recordset;
  }

  /**
   * FR-07 | Query (a) Insert & (c) Update: dbo.sp_UpsertProduct
   */
  async upsertProduct(params: {
    sellerId: number;
    productId?: number | null;
    categoryId: number;
    name: string;
    description?: string;
    price: number;
    stockQuantity: number;
    status?: string;
  }) {
    const res = await this.db.executeProcedure(
      'dbo.sp_UpsertProduct',
      {
        seller_id: params.sellerId,
        category_id: params.categoryId,
        name: params.name,
        description: params.description || null,
        price: params.price,
        stock_quantity: params.stockQuantity ?? 0,
        status: params.status || 'active',
      },
      {
        product_id: {
          type: sql.Int,
          sqlTypeName: 'Int',
          value: params.productId ?? null,
        },
      },
    );

    const productId = res.output?.product_id ?? params.productId;
    return {
      productId,
      products: await this.getSellerProducts(params.sellerId),
    };
  }

  /**
   * FR-08 | Query (c) Atomic Inventory Adjustment: dbo.sp_AdjustInventory
   */
  async adjustInventory(params: {
    sellerId: number;
    productId: number;
    stockDelta: number;
    lowStockThreshold?: number;
  }) {
    const res = await this.db.executeProcedure('dbo.sp_AdjustInventory', {
      seller_id: params.sellerId,
      product_id: params.productId,
      stock_delta: params.stockDelta,
      low_stock_threshold: params.lowStockThreshold ?? 5,
    });
    return res.recordset[0] || null;
  }

  /**
   * FR-09 | Query (f) 4-Table JOIN: dbo.sp_GetSellerOrders
   */
  async getSellerOrders(sellerId: number, status?: string) {
    const res = await this.db.executeProcedure('dbo.sp_GetSellerOrders', {
      seller_id: sellerId,
      status: status && status !== 'all' ? status : null,
    });
    return res.recordset;
  }

  /**
   * FR-09 | Query (c) Monotonic Order Status Progression: dbo.sp_UpdateOrderFulfillment
   * Enforces: pending -> processing -> shipped -> delivered
   */
  async updateOrderFulfillment(params: {
    sellerId: number;
    orderId: number;
    newStatus: string;
  }) {
    await this.db.executeProcedure('dbo.sp_UpdateOrderFulfillment', {
      seller_id: params.sellerId,
      order_id: params.orderId,
      new_status: params.newStatus,
    });
    return {
      orderId: params.orderId,
      newStatus: params.newStatus,
    };
  }

  /**
   * FR-10 | Query (h) Aggregate Functions: dbo.sp_GetSellerAnalytics
   * Returns 2 Result Sets: [0] Revenue & Order Summary, [1] Top 5 Best-Selling Products
   */
  async getSellerAnalytics(
    sellerId: number,
    startDate?: string,
    endDate?: string,
  ) {
    const res = await this.db.executeProcedure('dbo.sp_GetSellerAnalytics', {
      seller_id: sellerId,
      start_date: startDate || null,
      end_date: endDate || null,
    });

    return {
      summary: res.recordsets[0]?.[0] || {
        seller_id: sellerId,
        total_revenue: 0,
        completed_order_count: 0,
        total_items_sold: 0,
      },
      topProducts: res.recordsets[1] || [],
    };
  }
}
