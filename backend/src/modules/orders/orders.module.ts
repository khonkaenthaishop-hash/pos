// orders.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, OrderItem } from './order.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ProductsModule } from '../products/products.module';
import { AuditModule } from '../audit/audit.module';
import { CashierSession } from '../cashier-sessions/cashier-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, CashierSession]),
    ProductsModule,
    AuditModule,
  ],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
