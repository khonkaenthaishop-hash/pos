import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { GmailCredential } from './gmail-credential.entity';
import { ShippingEmail } from './shipping-email.entity';
import { ShippingTracking } from './shipping-tracking.entity';
import { GmailService } from './gmail.service';
import { ShippingEmailParserService } from './shipping-email-parser.service';
import { ShippingSyncService } from './shipping-sync.service';
import { GmailShippingController } from './gmail-shipping.controller';
import { AuditModule } from '../audit/audit.module';
import { OrdersModule } from '../orders/orders.module';
import { Order } from '../orders/order.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([GmailCredential, ShippingEmail, ShippingTracking, Order]),
    ScheduleModule.forFeature(),
    AuditModule,
    OrdersModule,
  ],
  providers: [GmailService, ShippingEmailParserService, ShippingSyncService],
  controllers: [GmailShippingController],
  exports: [ShippingSyncService],
})
export class GmailShippingModule {}
