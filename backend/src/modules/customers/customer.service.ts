import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Customer } from "./customer.entity";

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(Customer)
    private readonly repo: Repository<Customer>,
  ) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const qb = this.repo.createQueryBuilder("customer");

    if (search) {
      qb.where(
        "customer.name ILIKE :search OR customer.nickname ILIKE :search OR customer.phone LIKE :search OR customer.line_id ILIKE :search OR customer.facebook_id ILIKE :search",
        {
        search: `%${search}%`,
        },
      );
    }

    qb.orderBy("customer.name", "ASC")
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException("ไม่พบข้อมูลลูกค้า");
    return customer;
  }

  create(dto: any) {
    const customer = this.repo.create(dto);
    return this.repo.save(customer);
  }

  async update(id: string, dto: any) {
    const customer = await this.findOne(id);
    Object.assign(customer, dto);
    return this.repo.save(customer);
  }

  async remove(id: string) {
    const customer = await this.findOne(id);
    return this.repo.remove(customer);
  }
}
