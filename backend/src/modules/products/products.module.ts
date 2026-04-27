// products.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { StockController } from './stock.controller';
import { AuditModule } from '../audit/audit.module';
import { LocationsModule } from './locations.module';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), AuditModule, LocationsModule],
  providers: [ProductsService],
  controllers: [ProductsController, StockController],
  exports: [ProductsService, LocationsModule],
})
export class ProductsModule {}
