import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { IsString, IsOptional, IsNotEmpty } from "class-validator";
import { Shipment } from "./shipment.entity";
import { Order, OrderStatus } from "../orders/order.entity";
import { OrdersService } from "../orders/orders.service";

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty({ message: "กรุณาระบุเลขออร์เดอร์" })
  orderNumber: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

@Injectable()
export class ShipmentService {
  constructor(
    @InjectRepository(Shipment)
    private shipmentRepo: Repository<Shipment>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    private ordersService: OrdersService,
    private dataSource: DataSource,
  ) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const qb = this.shipmentRepo
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.order", "order")
      .orderBy("s.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.andWhere(
        "(s.orderNumber ILIKE :search OR s.trackingNumber ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOrdersToShip(search?: string) {
    const qb = this.orderRepo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.customer", "customer")
      .where("o.status IN (:...statuses)", {
        statuses: [OrderStatus.PENDING, OrderStatus.CONFIRMED],
      });

    if (search) {
      qb.andWhere("o.orderNo ILIKE :search", { search: `%${search}%` });
    }

    return qb.limit(20).getMany();
  }

  async create(dto: CreateShipmentDto, userId: string) {
    const order = await this.orderRepo.findOne({
      where: { orderNo: dto.orderNumber },
      relations: ["items"],
    });

    if (!order) throw new NotFoundException("ไม่พบเลขออร์เดอร์นี้");

    // Existing status check
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(
        "ไม่สามารถส่งสินค้าสำหรับออร์เดอร์ที่ถูกยกเลิก",
      );
    }

    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(order.status)) {
      throw new BadRequestException("ออร์เดอร์นี้ถูกดำเนินการจัดส่งไปแล้ว");
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Update order status using existing logic (this triggers stock deduction)
      await this.ordersService.updateStatus(
        order.id,
        OrderStatus.SHIPPED,
        userId,
      );

      // 2. Create or Update Shipment record
      let shipment = await manager.findOne(Shipment, {
        where: { orderNumber: dto.orderNumber },
      });

      if (!shipment) {
        shipment = manager.create(Shipment, {
          orderNumber: dto.orderNumber,
          trackingNumber: dto.trackingNumber,
          carrier: dto.carrier,
          notes: dto.notes,
        });
      } else {
        Object.assign(shipment, dto);
      }

      return manager.save(Shipment, shipment);
    });
  }
}
