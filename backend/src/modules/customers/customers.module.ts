import {
  Module, Injectable, Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Customer } from './customer.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Customer) private repo: Repository<Customer>) {}

  findAll(search?: string) {
    if (!search) return this.repo.find({ order: { createdAt: 'DESC' } });
    return this.repo.createQueryBuilder('c')
      .where(
        'c.name ILIKE :s OR c.nickname ILIKE :s OR c.phone LIKE :s OR c.code ILIKE :s',
        { s: `%${search}%` },
      )
      .getMany();
  }

  async findById(id: string) {
    const customer = await this.repo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('ไม่พบลูกค้า');
    return customer;
  }

  create(dto: Partial<Customer>) {
    return this.repo.save(this.repo.create(dto));
  }

  update(id: string, dto: Partial<Customer>) {
    return this.repo.save({ ...dto, id });
  }

  async updateStats(id: string, orderTotal: number) {
    await this.repo.increment({ id }, 'totalOrders', 1);
    await this.repo.increment({ id }, 'totalSpent', orderTotal);
  }

  async addDebt(id: string, amount: number) {
    await this.repo.increment({ id }, 'totalDebt', amount);
  }

  async addPoints(id: string, points: number) {
    await this.repo.increment({ id }, 'loyaltyPoints', points);
  }
}

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private svc: CustomersService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.svc.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.svc.create(dto as any);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Customer])],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
