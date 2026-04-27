import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReportsService } from "./reports.service";
import { ReportsController } from "./reports.controller";
import { Order, OrderItem } from "../orders/order.entity";
import { InventoryMovement } from "../inventory/inventory-movement.entity";
import { Product } from "../products/product.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, InventoryMovement, Product])],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
