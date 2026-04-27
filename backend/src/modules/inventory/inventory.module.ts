import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockTransaction } from './stock-transaction.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { Supplier } from './supplier.entity';
import { Product } from '../products/product.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StockTransaction, InventoryMovement, Supplier, Product])],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
