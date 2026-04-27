import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, Like } from "typeorm";
import { Order } from "./order.entity";

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findAll(
    search?: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Order[]> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.customer", "customer")
      .leftJoinAndSelect("order.user", "user")
      .orderBy("order.createdAt", "DESC");

    if (search) {
      queryBuilder.andWhere(
        "(order.orderNumber ILIKE :search OR customer.name ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999); // Set to end of the day
      queryBuilder.andWhere("order.createdAt BETWEEN :from AND :to", {
        from,
        to,
      });
    }

    return queryBuilder.getMany();
  }
}
