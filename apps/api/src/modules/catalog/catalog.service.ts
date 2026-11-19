import { Injectable, Inject } from '@nestjs/common';
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
        c.created_at
      FROM dbo.Categories c
      LEFT JOIN dbo.Categories p ON c.parent_id = p.category_id
      ORDER BY ISNULL(c.parent_id, 0) ASC, c.category_id ASC;
    `);
    return res.recordset;
  }

  /**
   * FR-01 | Query (e): Composite Condition Filter via dbo.sp_SearchProducts
   */
  async searchProducts(filters: {
    keyword?: string;
    categoryId?: number;
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
    return res.recordset;
  }

  /**
   * FR-02 | Query (d): Single Condition Lookup via dbo.sp_GetProductDetails
   * Returns 2 Result Sets: [0] Product & Seller overview, [1] Reviews list
   * Combined with FR-06 | Query (h): Rating aggregation via dbo.sp_GetProductRatingStats
   */
  async getProductDetails(productId: number) {
    const [detailsRes, statsRes] = await Promise.all([
      this.db.executeProcedure('dbo.sp_GetProductDetails', {
        product_id: productId,
      }),
      this.db.executeProcedure('dbo.sp_GetProductRatingStats', {
        product_id: productId,
      }),
    ]);

    return {
      product: detailsRes.recordsets[0]?.[0] || null,
      reviews: detailsRes.recordsets[1] || [],
      ratingStats: statsRes.recordset?.[0] || null,
    };
  }

  /**
   * FR-06 | Query (h): Review Rating Aggregation via dbo.sp_GetProductRatingStats
   */
  async getProductRatingStats(productId: number) {
    const res = await this.db.executeProcedure('dbo.sp_GetProductRatingStats', {
      product_id: productId,
    });
    return res.recordset[0] || null;
  }
}
