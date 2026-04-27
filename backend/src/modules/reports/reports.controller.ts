import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { Response } from "express";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "../users/user.entity";

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.MANAGER)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("daily")
  async daily(@Query("date") date?: string) {
    return this.reportsService.getDailyDashboardSummary(date);
  }

  @Get("top-products")
  async topProducts(
    @Query("limit") limit?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const l = Number(limit) || 10;
    return this.reportsService.getTopProductsDashboardSummary({
      limit: Math.min(Math.max(l, 1), 50),
      from,
      to,
    });
  }

  @Get("sales")
  async getSales(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("period") period: "daily" | "monthly",
    @Query("export") isExport: string,
    @Res() res: Response,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException("Invalid date format provided");
    }

    const data = await this.reportsService.getSalesReport(
      fromDate,
      toDate,
      period,
    );
    if (isExport === "true") {
      const csv = this.reportsService.convertToCSV(data);
      res.header("Content-Type", "text/csv");
      res.attachment(`sales_report_${from}_to_${to}.csv`);
      return res.send(csv);
    }
    return res.json(data);
  }

  @Get("profit")
  async getProfit(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("export") isExport: string,
    @Res() res: Response,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException("Invalid date format provided");
    }

    const data = await this.reportsService.getProfitReport(fromDate, toDate);

    if (isExport === "true") {
      const csv = this.reportsService.convertToCSV(data);
      res.header("Content-Type", "text/csv");
      res.attachment(`profit_report_${from}_to_${to}.csv`);
      return res.send(csv);
    }
    return res.json(data);
  }

  @Get("stock-movement")
  async getStockMovement(
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("export") isExport: string,
    @Res() res: Response,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException("Invalid date format provided");
    }

    const data = await this.reportsService.getStockMovementReport(
      fromDate,
      toDate,
    );

    if (isExport === "true") {
      const csv = this.reportsService.convertToCSV(data);
      res.header("Content-Type", "text/csv");
      res.attachment(`stock_movement_${from}_to_${to}.csv`);
      return res.send(csv);
    }
    return res.json(data);
  }

  @Get("cashier-summary")
  async getCashierSummary(
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException("Invalid date format provided");
    }

    return this.reportsService.getCashierReport(fromDate, toDate);
  }
}
