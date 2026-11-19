import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Inject,
} from '@nestjs/common';
import { SellerService } from './seller.service';

@Controller('seller')
export class SellerController {
  constructor(@Inject(SellerService) private readonly sellerService: SellerService) {}

  @Get('products')
  async getSellerProducts(
    @Query('sellerId', ParseIntPipe) sellerId: number,
    @Query('threshold') threshold?: string,
  ) {
    return this.sellerService.getSellerProducts(
      sellerId,
      threshold ? Number(threshold) : 5,
    );
  }

  @Post('products')
  async createProduct(
    @Body()
    body: {
      sellerId: number;
      categoryId: number;
      name: string;
      description?: string;
      price: number;
      stockQuantity: number;
      status?: string;
    },
  ) {
    return this.sellerService.upsertProduct({
      sellerId: Number(body.sellerId),
      productId: null,
      categoryId: Number(body.categoryId),
      name: body.name,
      description: body.description,
      price: Number(body.price),
      stockQuantity: Number(body.stockQuantity ?? 0),
      status: body.status || 'active',
    });
  }

  @Put('products/:id')
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      sellerId: number;
      categoryId: number;
      name: string;
      description?: string;
      price: number;
      stockQuantity: number;
      status?: string;
    },
  ) {
    return this.sellerService.upsertProduct({
      sellerId: Number(body.sellerId),
      productId: id,
      categoryId: Number(body.categoryId),
      name: body.name,
      description: body.description,
      price: Number(body.price),
      stockQuantity: Number(body.stockQuantity ?? 0),
      status: body.status || 'active',
    });
  }

  @Patch('products/:id/inventory')
  async adjustInventory(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      sellerId: number;
      stockDelta: number;
      lowStockThreshold?: number;
    },
  ) {
    return this.sellerService.adjustInventory({
      sellerId: Number(body.sellerId),
      productId: id,
      stockDelta: Number(body.stockDelta),
      lowStockThreshold: body.lowStockThreshold
        ? Number(body.lowStockThreshold)
        : 5,
    });
  }

  @Get('orders')
  async getSellerOrders(
    @Query('sellerId', ParseIntPipe) sellerId: number,
    @Query('status') status?: string,
  ) {
    return this.sellerService.getSellerOrders(sellerId, status);
  }

  @Patch('orders/:id/status')
  async updateOrderFulfillment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { sellerId: number; newStatus: string },
  ) {
    return this.sellerService.updateOrderFulfillment({
      sellerId: Number(body.sellerId),
      orderId: id,
      newStatus: body.newStatus,
    });
  }

  @Get('analytics')
  async getSellerAnalytics(
    @Query('sellerId', ParseIntPipe) sellerId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.sellerService.getSellerAnalytics(sellerId, startDate, endDate);
  }
}
