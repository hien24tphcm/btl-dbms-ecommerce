import { Module } from '@nestjs/common';
import { CartOrderController } from './cart-order.controller';
import { CartOrderService } from './cart-order.service';

@Module({
  controllers: [CartOrderController],
  providers: [CartOrderService],
  exports: [CartOrderService],
})
export class CartOrderModule {}
