import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CartOrderModule } from './modules/cart-order/cart-order.module';
import { SellerModule } from './modules/seller/seller.module';
import { AdminModule } from './modules/admin/admin.module';
import { DbmsLabModule } from './modules/dbms-lab/dbms-lab.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CatalogModule,
    CartOrderModule,
    SellerModule,
    AdminModule,
    DbmsLabModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
