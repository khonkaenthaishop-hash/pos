import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Order } from "./order.entity";
import { OrderService } from "./order.service";
import { OrderController } from "./order.controller";
import { Customer } from "../customers/customer.entity"; // Import Customer entity
import { User } from "../users/user.entity"; // Import User entity

@Module({
  imports: [TypeOrmModule.forFeature([Order, Customer, User])], // Include Customer and User for relations
  providers: [OrderService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
