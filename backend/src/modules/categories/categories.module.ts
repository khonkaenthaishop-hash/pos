// categories.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from './category.entity';
import {
  Injectable, Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, NotFoundException, HttpCode, HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Injectable()
export class CategoriesService {
  constructor(@InjectRepository(Category) private repo: Repository<Category>) {}

  findAll(search?: string) {
    if (search) {
      return this.repo.find({
        where: [
          { nameTh: ILike(`%${search}%`) },
          { nameEn: ILike(`%${search}%`) },
        ],
        order: { sortOrder: 'ASC' },
      });
    }
    return this.repo.find({ order: { sortOrder: 'ASC' } });
  }

  create(dto: Partial<Category>) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: Partial<Category>) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('ไม่พบหมวดหมู่');
    Object.assign(cat, dto);
    return this.repo.save(cat);
  }

  async remove(id: string) {
    const cat = await this.repo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('ไม่พบหมวดหมู่');
    await this.repo.delete(id);
  }
}

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private svc: CategoriesService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.svc.findAll(search);
  }

  @Post()
  @Roles(UserRole.OWNER)
  create(@Body() dto: any) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  update(@Param('id') id: string, @Body() dto: any) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Category])],
  providers: [CategoriesService],
  controllers: [CategoriesController],
  exports: [CategoriesService],
})
export class CategoriesModule {}
