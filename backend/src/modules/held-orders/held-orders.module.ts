import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeldOrder } from './held-order.entity';
import { HeldOrdersService } from './held-orders.service';
import { HeldOrdersController } from './held-orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HeldOrder])],
  providers: [HeldOrdersService],
  controllers: [HeldOrdersController],
  exports: [HeldOrdersService],
})
export class HeldOrdersModule {}
