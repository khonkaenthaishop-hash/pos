import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { Order, OrderItem, OrderStatus } from "../orders/order.entity";
import { InventoryMovement } from "../inventory/inventory-movement.entity";
import { Product } from "../products/product.entity";

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private orderItemRepo: Repository<OrderItem>,
    @InjectRepository(InventoryMovement)
    private moveRepo: Repository<InventoryMovement>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
  ) {}

  private parseDateOnlyOrThrow(value: string, field: string): Date {
    // Accept YYYY-MM-DD only (avoid timezone surprises)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`Invalid ${field} (expected YYYY-MM-DD)`);
    }
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid ${field} date`);
    }
    return date;
  }

  private addDaysUtc(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86400_000);
  }

  private toDateOnlyStringUtc(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Dashboard helper:
   * - Returns last 7 days (inclusive) sales summary ending at `date` (YYYY-MM-DD) or today.
   * - Shape matches frontend Dashboard expectations: { date, totalRevenue, totalOrders }[]
   */
  async getDailyDashboardSummary(date?: string): Promise<
    { date: string; totalRevenue: number; totalOrders: number }[]
  > {
    const end = date
      ? this.parseDateOnlyOrThrow(date, "date")
      : new Date(Date.UTC(
          new Date().getUTCFullYear(),
          new Date().getUTCMonth(),
          new Date().getUTCDate(),
        ));

    const start = this.addDaysUtc(end, -6);
    const toExclusive = this.addDaysUtc(end, 1);

    const raw = await this.orderRepo
      .createQueryBuilder("o")
      .select(`TO_CHAR(o.created_at, 'YYYY-MM-DD')`, "date")
      .addSelect("SUM(o.total_amount)", "totalRevenue")
      .addSelect("COUNT(o.id)", "totalOrders")
      .where("o.created_at >= :from AND o.created_at < :to", { from: start, to: toExclusive })
      .andWhere("o.status != :status", { status: OrderStatus.CANCELLED })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany<{
        date: string;
        totalRevenue: string;
        totalOrders: string;
      }>();

    const map = new Map(
      raw.map((r) => [
        r.date,
        {
          date: r.date,
          totalRevenue: Number(r.totalRevenue || 0),
          totalOrders: Number(r.totalOrders || 0),
        },
      ]),
    );

    const out: { date: string; totalRevenue: number; totalOrders: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = this.toDateOnlyStringUtc(this.addDaysUtc(start, i));
      out.push(map.get(d) ?? { date: d, totalRevenue: 0, totalOrders: 0 });
    }
    return out;
  }

  /**
   * Dashboard helper:
   * - Top products by quantity within [from,to] (YYYY-MM-DD), inclusive.
   * - Shape matches frontend Dashboard expectations.
   */
  async getTopProductsDashboardSummary(params: {
    limit: number;
    from?: string;
    to?: string;
  }): Promise<{ productNameTh: string; totalQty: number; totalRevenue: number }[]> {
    const todayUtc = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    ));

    const end = params.to
      ? this.parseDateOnlyOrThrow(params.to, "to")
      : todayUtc;

    const start = params.from
      ? this.parseDateOnlyOrThrow(params.from, "from")
      : this.addDaysUtc(end, -6);

    const toExclusive = this.addDaysUtc(end, 1);

    const rows = await this.orderItemRepo
      .createQueryBuilder("oi")
      .innerJoin(Order, "o", "o.id = oi.order_id")
      .select("oi.product_name_th", "productNameTh")
      .addSelect("SUM(oi.quantity)", "totalQty")
      .addSelect("SUM(oi.quantity * oi.unit_price)", "totalRevenue")
      .where("o.created_at >= :from AND o.created_at < :to", { from: start, to: toExclusive })
      .andWhere("o.status != :status", { status: OrderStatus.CANCELLED })
      .groupBy("oi.product_name_th")
      .orderBy("SUM(oi.quantity)", "DESC")
      .limit(params.limit)
      .getRawMany<{ productNameTh: string; totalQty: string; totalRevenue: string }>();

    return rows.map((r) => ({
      productNameTh: String(r.productNameTh ?? ""),
      totalQty: Number(r.totalQty || 0),
      totalRevenue: Number(r.totalRevenue || 0),
    }));
  }

  /**
   * Aggregates sales revenue and order counts by day or month.
   */
  async getSalesReport(
    from: Date,
    to: Date,
    period: "daily" | "monthly" = "daily",
  ) {
    const dateFormat = period === "daily" ? "YYYY-MM-DD" : "YYYY-MM";

    return this.orderRepo
      .createQueryBuilder("o")
      .select(`TO_CHAR(o.created_at, '${dateFormat}')`, "period")
      .addSelect(
        `CONCAT(TO_CHAR(o.created_at, '${dateFormat}'), '-sales')`,
        "id",
      ) // Reliable React key
      .addSelect("SUM(o.total_amount)", "totalSales")
      .addSelect("COUNT(o.id)", "orderCount")
      .where("o.created_at BETWEEN :from AND :to", { from, to })
      .andWhere("o.status != :status", { status: OrderStatus.CANCELLED })
      .groupBy("period")
      .orderBy("period", "ASC")
      .getRawMany();
  }

  /**
   * Calculates profit by comparing sale prices in OrderItems against product cost prices.
   */
  async getProfitReport(from: Date, to: Date) {
    return this.orderRepo
      .createQueryBuilder("o")
      .leftJoin("o.items", "oi") // Assuming 'items' is the relation name in Order entity
      // NOTE: order_items has cost_price; keep join-less to avoid relying on missing relation
      .select("o.id", "id") // Unique ID for React keys
      .addSelect("o.order_no", "orderNo")
      .addSelect("o.created_at", "date")
      .addSelect("SUM(oi.quantity * oi.unit_price)", "revenue")
      .addSelect(
        "SUM(oi.quantity * oi.cost_price)",
        "cost",
      )
      .addSelect(
        "SUM(oi.quantity * (oi.unit_price - oi.cost_price))",
        "profit",
      )
      .where("o.created_at BETWEEN :from AND :to", { from, to })
      .andWhere("o.status != :status", { status: OrderStatus.CANCELLED })
      .groupBy("o.id, o.order_no, o.created_at")
      .orderBy("o.created_at", "DESC")
      .getRawMany();
  }

  /**
   * Fetches raw stock movement history for auditing.
   */
  async getStockMovementReport(from: Date, to: Date) {
    return this.moveRepo.find({
      where: {
        createdAt: Between(from, to),
      },
      relations: ["product", "user"],
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Summarizes performance metrics for each cashier.
   */
  async getCashierReport(from: Date, to: Date) {
    return this.orderRepo
      .createQueryBuilder("o")
      .leftJoin("users", "u", "u.id = o.user_id")
      .select("u.username", "cashier")
      .addSelect("COUNT(o.id)", "totalOrders")
      .addSelect("SUM(o.total_amount)", "totalSales")
      .where("o.created_at BETWEEN :from AND :to", { from, to })
      .andWhere("o.status != :status", { status: OrderStatus.CANCELLED })
      .groupBy("u.username")
      .getRawMany();
  }

  /**
   * Utility to convert JSON arrays to CSV format.
   */
  convertToCSV(data: any[]): string {
    if (data.length === 0) return "";
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
      Object.values(row)
        .map((value) => {
          const str = String(value ?? "");
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    return [headers, ...rows].join("\n");
  }
}
