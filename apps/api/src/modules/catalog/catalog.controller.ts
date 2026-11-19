import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  async getCategories() {
    return this.catalogService.getCategories();
  }

  @Get('products')
  async searchProducts(
    @Query('keyword') keyword?: string,
    @Query('categoryId') categoryId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('minRating') minRating?: string,
    @Query('inStockOnly') inStockOnly?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.catalogService.searchProducts({
      keyword: keyword || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      minPrice: minPrice !== undefined && minPrice !== '' ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined && maxPrice !== '' ? Number(maxPrice) : undefined,
      minRating: minRating !== undefined && minRating !== '' ? Number(minRating) : undefined,
      inStockOnly: inStockOnly === '1' || inStockOnly === 'true',
      sortBy: sortBy || 'newest',
    });
  }

  @Get('products/:id')
  async getProductDetails(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.getProductDetails(id);
  }

  @Get('products/:id/rating-stats')
  async getProductRatingStats(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.getProductRatingStats(id);
  }
}
