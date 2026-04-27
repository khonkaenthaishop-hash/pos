import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CashierSession } from './cashier-session.entity';
import { CashierSessionsService } from './cashier-sessions.service';
import { CashierSessionsController } from './cashier-sessions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CashierSession])],
  providers: [CashierSessionsService],
  controllers: [CashierSessionsController],
  exports: [CashierSessionsService],
})
export class CashierSessionsModule {}
