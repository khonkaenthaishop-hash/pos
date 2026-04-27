import {
  Module, Injectable, Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
  NotFoundException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Customer } from './customer.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Customer) private repo: Repository<Customer>) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 20;

    if (!search) {
      const [items, total] = await this.repo.findAndCount({
        order: { createdAt: 'DESC' },
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      });
      return {
        items,
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        totalPages: Math.ceil(total / normalizedLimit),
      };
    }

    const qb = this.repo.createQueryBuilder('c');
    qb.where(
      'c.name ILIKE :s OR c.nickname ILIKE :s OR c.phone LIKE :s OR c.line_id ILIKE :s OR c.facebook_id ILIKE :s',
      { s: `%${search}%` },
    );
    qb.orderBy('c.created_at', 'DESC')
      .skip((normalizedPage - 1) * normalizedLimit)
      .take(normalizedLimit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page: normalizedPage,
      limit: normalizedLimit,
      totalPages: Math.ceil(total / normalizedLimit),
    };
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

  async remove(id: string) {
    const customer = await this.findById(id);
    await this.repo.remove(customer);
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private svc: CustomersService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAll(
      search,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  create(@Body() dto: CreateCustomerDto) {
    return this.svc.create(dto as any);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  update(@Param('id') id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Customer])],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
