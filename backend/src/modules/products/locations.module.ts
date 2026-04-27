import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from './location.entity';
import { ProductLocation } from './product-location.entity';
import { Product } from './product.entity';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { WarehousesController } from './warehouses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Location, ProductLocation, Product])],
  controllers: [LocationsController, WarehousesController],
  providers: [LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
