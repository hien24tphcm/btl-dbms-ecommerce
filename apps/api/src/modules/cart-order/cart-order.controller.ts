import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Inject,
} from '@nestjs/common';
import { CartOrderService } from './cart-order.service';

@Controller()
export class CartOrderController {
  constructor(@Inject(CartOrderService) private readonly cartOrderService: CartOrderService) {}

  @Get('cart')
  async getCart(@Query('userId', ParseIntPipe) userId: number) {
    return this.cartOrderService.getCart(userId);
  }

  @Post('cart/items')
  async addToCart(
    @Body()
    body: {
      userId: number;
      productId: number;
      quantity?: number;
    },
  ) {
    return this.cartOrderService.addToCart({
      userId: Number(body.userId),
      productId: Number(body.productId),
      quantity: Number(body.quantity ?? 1),
    });
  }

  @Delete('cart/items')
  async removeFromCart(
    @Body()
    body: {
      userId: number;
      productId?: number;
      cartItemId?: number;
      clearAll?: boolean;
    },
  ) {
    return this.cartOrderService.removeFromCart({
      userId: Number(body.userId),
      productId: body.productId !== undefined ? Number(body.productId) : undefined,
      cartItemId:
        body.cartItemId !== undefined ? Number(body.cartItemId) : undefined,
      clearAll: Boolean(body.clearAll),
    });
  }

  @Get('vouchers')
  async getVouchers() {
    return this.cartOrderService.getActiveVouchers();
  }

  @Post('orders/checkout')
  async placeOrder(
    @Body()
    body: {
      buyerId: number;
      sellerId: number;
      productId?: number;
      quantity?: number;
      voucherCode?: string;
      shippingAddress: string;
      paymentMethod?: string;
    },
  ) {
    return this.cartOrderService.placeOrder({
      buyerId: Number(body.buyerId),
      sellerId: Number(body.sellerId),
      productId: body.productId ? Number(body.productId) : undefined,
      quantity: body.quantity ? Number(body.quantity) : undefined,
      voucherCode: body.voucherCode,
      shippingAddress: body.shippingAddress,
      paymentMethod: body.paymentMethod,
    });
  }

  @Get('buyer/orders')
  async getBuyerOrders(
    @Query('buyerId', ParseIntPipe) buyerId: number,
    @Query('status') status?: string,
  ) {
    return this.cartOrderService.getBuyerOrders(buyerId, status);
  }

  @Get('orders/:id')
  async getOrderDetailsJoin(
    @Param('id', ParseIntPipe) id: number,
    @Query('userId') userId?: string,
  ) {
    return this.cartOrderService.getOrderDetailsJoin(
      id,
      userId ? Number(userId) : undefined,
    );
  }

  @Post('orders/:id/cancel')
  async cancelOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { buyerId: number },
  ) {
    return this.cartOrderService.cancelOrder(id, Number(body.buyerId));
  }

  @Post('reviews')
  async addReview(
    @Body()
    body: {
      userId: number;
      orderDetailId: number;
      rating: number;
      comment?: string;
    },
  ) {
    return this.cartOrderService.addReview({
      userId: Number(body.userId),
      orderDetailId: Number(body.orderDetailId),
      rating: Number(body.rating),
      comment: body.comment,
    });
  }
}
