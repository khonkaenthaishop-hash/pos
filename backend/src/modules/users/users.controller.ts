import {
  Controller, Get, Post, Body, Param, Patch, UseGuards, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser } from '../auth/roles.decorator';
import { UserRole } from './user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';

class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username ใช้ได้เฉพาะตัวอักษร ตัวเลข และ _' })
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameTh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameZh?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private auditService: AuditService,
  ) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  @Roles(UserRole.OWNER)
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: any) {
    const user = await this.usersService.create(dto);
    await this.auditService.log({
      userId: actor.id,
      action: AuditAction.USER_CREATE,
      targetTable: 'users',
      targetId: user.id,
      newValue: { username: user.username, role: user.role },
    });
    return user;
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.OWNER)
  async deactivate(@Param('id') id: string, @CurrentUser() actor: any) {
    if (actor.id === id) {
      throw new BadRequestException('ไม่สามารถปิดใช้งานบัญชีตัวเองได้');
    }
    const user = await this.usersService.deactivate(id);
    await this.auditService.log({
      userId: actor.id,
      action: AuditAction.USER_DEACTIVATE,
      targetTable: 'users',
      targetId: id,
      newValue: { isActive: false, username: user.username },
    });
    return user;
  }

  @Patch(':id/activate')
  @Roles(UserRole.OWNER)
  async activate(@Param('id') id: string, @CurrentUser() actor: any) {
    const user = await this.usersService.activate(id);
    await this.auditService.log({
      userId: actor.id,
      action: AuditAction.USER_ACTIVATE,
      targetTable: 'users',
      targetId: id,
      newValue: { isActive: true, username: user.username },
    });
    return user;
  }
}
