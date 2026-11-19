import { Injectable } from '@nestjs/common';
import * as sql from 'mssql';
import { MssqlService } from '../../database/mssql.service';

@Injectable()
export class CartOrderService {
  constructor(private readonly db: MssqlService) {}

  /**
   * FR-03: Retrieve cart items for a user grouped by seller
   */
  async getCart(userId: number) {
    const res = await this.db.query(
      `
      SELECT 
        ci.cart_item_id,
        ci.user_id,
        ci.product_id,
        ci.quantity,
        ci.added_at,
        p.name AS product_name,
        p.price AS unit_price,
        (ci.quantity * p.price) AS subtotal,
        p.stock_quantity,
        p.status AS product_status,
        p.seller_id,
        s.shop_name
      FROM dbo.Cart_Items ci
      JOIN dbo.Products p ON ci.product_id = p.product_id
      JOIN dbo.Sellers s ON p.seller_id = s.seller_id
      WHERE ci.user_id = @user_id
      ORDER BY s.seller_id ASC, ci.added_at DESC;
      `,
      { user_id: userId },
    );
    return res.recordset;
  }

  /**
   * FR-03 | Query (a) Insert / (c) Update: dbo.sp_AddToCart
   */
  async addToCart(params: {
    userId: number;
    productId: number;
    quantity: number;
  }) {
    await this.db.executeProcedure('dbo.sp_AddToCart', {
      user_id: params.userId,
      product_id: params.productId,
      quantity: params.quantity ?? 1,
    });
    return this.getCart(params.userId);
  }

  /**
   * FR-03 | Query (b) Delete: dbo.sp_RemoveFromCart
   */
  async removeFromCart(params: {
    userId: number;
    productId?: number;
    cartItemId?: number;
    clearAll?: boolean;
  }) {
    await this.db.executeProcedure('dbo.sp_RemoveFromCart', {
      user_id: params.userId,
      product_id: params.productId ?? null,
      cart_item_id: params.cartItemId ?? null,
      clear_all: params.clearAll ? 1 : 0,
    });
    return this.getCart(params.userId);
  }

  /**
   * FR-04 Helper: List active vouchers from dbo.Vouchers
   */
  async getActiveVouchers() {
    const res = await this.db.query(`
      SELECT 
        voucher_code,
        discount_percent,
        min_order_value,
        max_discount,
        valid_from,
        expired_at,
        usage_limit,
        used_count,
        (usage_limit - used_count) AS remaining_uses
      FROM dbo.Vouchers
      ORDER BY min_order_value ASC;
    `);
    return res.recordset;
  }

  /**
   * FR-04 | Query (a) Insert, (b) Delete, (c) Update in ACID Transaction: dbo.sp_PlaceOrder
   */
  async placeOrder(params: {
    buyerId: number;
    sellerId: number;
    productId?: number;
    quantity?: number;
    voucherCode?: string;
    shippingAddress: string;
    paymentMethod?: string;
  }) {
    const res = await this.db.executeProcedure(
      'dbo.sp_PlaceOrder',
      {
        buyer_id: params.buyerId,
        seller_id: params.sellerId,
        product_id: params.productId ?? null,
        quantity: params.quantity ?? null,
        voucher_code:
          params.voucherCode && params.voucherCode.trim() !== ''
            ? params.voucherCode.trim()
            : null,
        shipping_address: params.shippingAddress,
        payment_method: params.paymentMethod || 'COD',
      },
      {
        new_order_id: { type: sql.Int, sqlTypeName: 'Int', value: null },
      },
    );

    const newOrderId = res.output?.new_order_id;
    const details = newOrderId
      ? await this.getOrderDetailsJoin(newOrderId, params.buyerId)
      : [];

    return {
      orderId: newOrderId,
      lineItems: details,
    };
  }

  /**
   * FR-05: List buyer orders from View dbo.v_OrderFulfillmentSummary
   */
  async getBuyerOrders(buyerId: number, status?: string) {
    const res = await this.db.query(
      `
      SELECT *
      FROM dbo.v_OrderFulfillmentSummary
      WHERE buyer_id = @buyer_id
        AND (@status IS NULL OR order_status = @status)
      ORDER BY order_date DESC, order_id DESC;
      `,
      {
        buyer_id: buyerId,
        status: status && status !== 'all' ? status : null,
      },
    );
    return res.recordset;
  }

  /**
   * FR-05 | Query (f) 5-Table JOIN: dbo.sp_GetOrderDetailsJoin
   * Joins Orders + Users + Sellers + Order_Details + Products
   * Plus checks existing reviews on each order_detail_id
   */
  async getOrderDetailsJoin(orderId: number, userId?: number) {
    const [joinRes, reviewsRes] = await Promise.all([
      this.db.executeProcedure('dbo.sp_GetOrderDetailsJoin', {
        order_id: orderId,
        user_id: userId ?? null,
      }),
      this.db.query(
        `
        SELECT r.review_id, r.order_detail_id, r.product_id, r.rating, r.comment, r.created_at
        FROM dbo.Reviews r
        JOIN dbo.Order_Details od ON r.order_detail_id = od.order_detail_id
        WHERE od.order_id = @order_id;
        `,
        { order_id: orderId },
      ),
    ]);

    const reviewByDetailId = new Map<number, any>();
    for (const r of reviewsRes.recordset) {
      reviewByDetailId.set(r.order_detail_id, r);
    }

    return joinRes.recordset.map((item: any) => ({
      ...item,
      existing_review: reviewByDetailId.get(item.order_detail_id) || null,
    }));
  }

  /**
   * FR-05 | Query (c) Update Transaction: dbo.sp_CancelOrder
   * Atomically cancels order (if pending/processing) and restores stock_quantity
   */
  async cancelOrder(orderId: number, buyerId: number) {
    await this.db.executeProcedure('dbo.sp_CancelOrder', {
      order_id: orderId,
      buyer_id: buyerId,
    });
    return this.getOrderDetailsJoin(orderId, buyerId);
  }

  /**
   * FR-06 | Query (a) Insert & (c) Update: dbo.sp_AddReview
   * Inserts customer review for a delivered order item and recalculates seller composite rating
   */
  async addReview(params: {
    userId: number;
    orderDetailId: number;
    rating: number;
    comment?: string;
  }) {
    await this.db.executeProcedure('dbo.sp_AddReview', {
      user_id: params.userId,
      order_detail_id: params.orderDetailId,
      rating: params.rating,
      comment: params.comment || null,
    });
    return {
      success: true,
      message:
        'Review submitted and seller composite rating updated in transaction.',
    };
  }
}
