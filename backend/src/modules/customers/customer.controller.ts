import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { CustomerService } from "./customer.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../users/user.entity";

@ApiTags("Customers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("customers")
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Get()
  findAll(
    @Query("search") search?: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ) {
    return this.service.findAll(search, Number(page) || 1, Number(limit) || 20);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Put(":id")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  update(@Param("id") id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Patch(":id")
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  patch(@Param("id") id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
