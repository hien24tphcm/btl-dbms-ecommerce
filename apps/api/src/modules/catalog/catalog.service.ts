import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { MssqlService } from '../../database/mssql.service';

@Injectable()
export class CatalogService {
  constructor(@Inject(MssqlService) private readonly db: MssqlService) {}

  async getCategories() {
    const res = await this.db.query(`
      SELECT 
        c.category_id,
        c.category_name,
        c.description,
        c.parent_id,
        p.category_name AS parent_category_name,
        (SELECT COUNT(*) FROM dbo.Products pr WHERE pr.category_id = c.category_id AND pr.is_active = 1) AS product_count,
        c.created_at
      FROM dbo.Categories c
      LEFT JOIN dbo.Categories p ON c.parent_id = p.category_id
      ORDER BY ISNULL(c.parent_id, 0) ASC, c.category_id ASC;
    `);
    return res.recordset;
  }

  async getShops() {
    const res = await this.db.query(`
      SELECT 
        s.seller_id,
        s.shop_name,
        s.store_description,
        s.rating,
        s.is_approved,
        s.address,
        (SELECT COUNT(*) FROM dbo.Products p WHERE p.seller_id = s.seller_id AND p.is_active = 1) AS product_count
      FROM dbo.Sellers s
      WHERE s.is_approved = 1
      ORDER BY s.rating DESC, s.seller_id ASC;
    `);
    return res.recordset;
  }

  async getShopDetails(sellerId: number) {
    const [shopRes, productsRes] = await Promise.all([
      this.db.query(
        `
        SELECT 
          s.seller_id,
          s.shop_name,
          s.store_description,
          s.rating,
          s.is_approved,
          s.address,
          s.created_at,
          (SELECT COUNT(*) FROM dbo.Products p WHERE p.seller_id = s.seller_id AND p.is_active = 1) AS product_count,
          (SELECT ISNULL(SUM(p.sold_quantity), 0) FROM dbo.Products p WHERE p.seller_id = s.seller_id) AS total_sold
        FROM dbo.Sellers s
        WHERE s.seller_id = @seller_id;
        `,
        { seller_id: sellerId },
      ),
      this.db.query(
        `
        SELECT 
          p.product_id,
          p.seller_id,
          s.shop_name,
          s.rating AS seller_rating,
          p.category_id,
          c.category_name,
          p.name,
          p.description,
          p.price,
          p.stock_quantity,
          p.sold_quantity,
          p.status,
          p.created_at
        FROM dbo.Products p
        JOIN dbo.Sellers s ON p.seller_id = s.seller_id
        JOIN dbo.Categories c ON p.category_id = c.category_id
        WHERE p.seller_id = @seller_id AND p.is_active = 1 AND p.status = 'active'
        ORDER BY p.sold_quantity DESC, p.product_id DESC;
        `,
        { seller_id: sellerId },
      ),
    ]);

    if (!shopRes.recordset[0]) {
      throw new NotFoundException('Không tìm thấy gian hàng.');
    }

    return {
      shop: shopRes.recordset[0],
      products: productsRes.recordset,
    };
  }

  async searchProducts(filters: {
    keyword?: string;
    categoryId?: number;
    sellerId?: number;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    inStockOnly?: boolean;
    sortBy?: string;
  }) {
    const res = await this.db.executeProcedure('dbo.sp_SearchProducts', {
      keyword: filters.keyword ? filters.keyword.trim() : null,
      category_id:
        filters.categoryId !== undefined && !Number.isNaN(filters.categoryId)
          ? filters.categoryId
          : null,
      min_price:
        filters.minPrice !== undefined && !Number.isNaN(filters.minPrice)
          ? filters.minPrice
          : null,
      max_price:
        filters.maxPrice !== undefined && !Number.isNaN(filters.maxPrice)
          ? filters.maxPrice
          : null,
      min_rating:
        filters.minRating !== undefined && !Number.isNaN(filters.minRating)
          ? filters.minRating
          : null,
      in_stock_only: filters.inStockOnly ? 1 : 0,
      sort_by: filters.sortBy || 'newest',
    });

    if (filters.sellerId && !Number.isNaN(filters.sellerId)) {
      return res.recordset.filter(
        (p: any) => Number(p.seller_id) === Number(filters.sellerId),
      );
    }
    return res.recordset;
  }

  async getProductDetails(productId: number) {
    const [detailsRes, statsRes] = await Promise.all([
      this.db.executeProcedure('dbo.sp_GetProductDetails', {
        product_id: productId,
      }),
      this.db.executeProcedure('dbo.sp_GetProductRatingStats', {
        product_id: productId,
      }),
    ]);

    const product = detailsRes.recordsets[0]?.[0] || null;
    let relatedProducts: any[] = [];

    if (product) {
      const relRes = await this.db.query(
        `
        SELECT TOP 4
          p.product_id,
          p.seller_id,
          s.shop_name,
          s.rating AS seller_rating,
          p.category_id,
          c.category_name,
          p.name,
          p.description,
          p.price,
          p.stock_quantity,
          p.sold_quantity,
          p.status
        FROM dbo.Products p
        JOIN dbo.Sellers s ON p.seller_id = s.seller_id
        JOIN dbo.Categories c ON p.category_id = c.category_id
        WHERE p.is_active = 1
          AND p.status = 'active'
          AND p.product_id <> @product_id
          AND (p.category_id = @category_id OR p.seller_id = @seller_id)
        ORDER BY CASE WHEN p.category_id = @category_id THEN 0 ELSE 1 END, p.sold_quantity DESC;
        `,
        {
          product_id: productId,
          category_id: product.category_id,
          seller_id: product.seller_id,
        },
      );
      relatedProducts = relRes.recordset;
    }

    return {
      product,
      reviews: detailsRes.recordsets[1] || [],
      ratingStats: statsRes.recordset?.[0] || null,
      relatedProducts,
    };
  }

  async getProductRatingStats(productId: number) {
    const res = await this.db.executeProcedure('dbo.sp_GetProductRatingStats', {
      product_id: productId,
    });
    return res.recordset[0] || null;
  }
}
