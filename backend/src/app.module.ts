import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CarriersModule } from './modules/carriers/carriers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CashierSessionsModule } from './modules/cashier-sessions/cashier-sessions.module';
import { HeldOrdersModule } from './modules/held-orders/held-orders.module';
import { SettingsModule } from './modules/settings/settings.module';
import { GmailShippingModule } from './modules/gmail-shipping/gmail-shipping.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Task scheduling (required by GmailShippingModule cron jobs)
    ScheduleModule.forRoot(),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: false, // schema managed by init.sql
        logging: config.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),

    // Feature modules
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    OrdersModule,
    CustomersModule,
    ShipmentsModule,
    AuditModule,
    ReportsModule,
    CarriersModule,
    InventoryModule,
    CashierSessionsModule,
    HeldOrdersModule,
    SettingsModule,
    GmailShippingModule,
  ],
})
export class AppModule {}
