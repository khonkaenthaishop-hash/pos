import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsUUID,
  IsNotEmpty,
} from "class-validator";
import { Transform } from "class-transformer";
import {
  StockTransaction,
  TransactionType,
  REASON_CODES,
} from "./stock-transaction.entity";
import { InventoryMovement, MovementType } from "./inventory-movement.entity";
import { Supplier } from "./supplier.entity";
import { Product } from "../products/product.entity";
import { ProductLocation } from "../products/product-location.entity";
import { Location } from "../products/location.entity";

export class ReceiveDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.01, { message: "จำนวนต้องมากกว่า 0" })
  quantity: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  unit?: string;

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  referenceNo?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  notes?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name?: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  unit?: string;
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  wholesaleUnit?: string;
  @IsOptional()
  @IsNumber()
  conversionFactor?: number;
}

export class AdjustDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  physicalCount: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  unit?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  reasonCode?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  notes?: string;
}

export interface DiscardDto {
  productId: string;
  quantity: number;
  unit?: string;
  reasonCode: string;
  notes?: string;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(StockTransaction)
    private txnRepo: Repository<StockTransaction>,
    @InjectRepository(InventoryMovement)
    private movRepo: Repository<InventoryMovement>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Reason codes ──────────────────────────────────────────────────
  getReasonCodes(type?: string) {
    if (type && (type === "IN" || type === "ADJUST" || type === "OUT")) {
      return REASON_CODES[type];
    }
    return REASON_CODES;
  }

  // ── Goods Receipt (รับสินค้าเข้า) ──────────────────────────────────
  async receive(dto: ReceiveDto, userId: string): Promise<InventoryMovement> {
    if (dto.quantity <= 0) {
      throw new BadRequestException("quantity ต้องมากกว่า 0");
    }

    return this.dataSource.transaction(async (manager) => {
      // Lock the product row to prevent concurrent stock races
      const product = await manager
        .createQueryBuilder(Product, "p")
        .setLock("pessimistic_write")
        .where("p.id = :id", { id: dto.productId })
        .getOne();

      if (!product) throw new NotFoundException("ไม่พบสินค้า");

      const qtyBase = this.toBaseUnits(dto.quantity, dto.unit, product);
      const balanceBefore = Number(product.currentStock);
      const balanceAfter = balanceBefore + qtyBase;

      // Update product stock and optionally cost price
      product.currentStock = balanceAfter;
      let unitCostBase: number | null = null;
      if (dto.costPrice != null) {
        unitCostBase = this.toBaseUnitCost(dto.costPrice, dto.unit, product);
        const oldCost = Number(product.costPrice || 0);
        const newCost = this.weightedAvgCost({
          oldStock: balanceBefore,
          oldCost,
          addStock: qtyBase,
          addUnitCost: unitCostBase,
        });
        product.costPrice = newCost;
      }
      await manager.save(Product, product);

      // Keep product_location in sync for POS multi-location deduction.
      // If no location rows exist yet, create one holding the full stock (single pool).
      const existingLocs = await manager.find(ProductLocation, {
        where: { productId: dto.productId },
        order: { priority: "ASC" },
        lock: { mode: "pessimistic_write" },
      });
      const fallbackCode = (product.locationCode || "FRONT").trim() || "FRONT";
      let fallbackLoc = await manager.findOne(Location, {
        where: { fullCode: fallbackCode },
      });
      if (!fallbackLoc) {
        fallbackLoc = await manager.save(
          Location,
          manager.create(Location, { fullCode: fallbackCode, isActive: true }),
        );
      }
      if (existingLocs.length === 0) {
        await manager.insert(ProductLocation, {
          productId: dto.productId,
          locationId: fallbackLoc.id,
          quantity: balanceAfter,
          priority: 1,
        });
      } else {
        const target =
          existingLocs.find((l) => l.locationId === fallbackLoc.id) ||
          existingLocs[0];
        target.quantity = Number(target.quantity) + qtyBase;
        await manager.save(ProductLocation, target);
      }

      // Write inventory movement record (primary audit for receive)
      const movement = manager.create(InventoryMovement, {
        productId: dto.productId,
        movementType: MovementType.IN,
        reasonCode: dto.reasonCode || "PO",
        quantityInput: dto.quantity,
        quantityBase: qtyBase,
        unitInput: dto.unit || product.unit,
        unitBase: product.unit,
        costPrice: unitCostBase ?? null, // store per-base-unit cost for consistent reporting
        referenceNo: dto.referenceNo || null,
        notes: dto.notes || null,
        balanceBefore,
        balanceAfter,
        userId,
        supplierId: dto.supplierId || null,
      });
      const savedMovement = await manager.save(InventoryMovement, movement);

      // Also write legacy stock_transaction for backward compat with reports/queries
      const txn = manager.create(StockTransaction, {
        productId: dto.productId,
        transactionType: TransactionType.IN,
        reasonCode: dto.reasonCode || "PO",
        quantity: qtyBase, // always base units in stock_transactions
        unit: product.unit,
        costPrice: unitCostBase ?? undefined,
        referenceNo: dto.referenceNo || undefined,
        notes: dto.notes || undefined,
        balanceAfter,
        userId,
        supplierId: dto.supplierId || undefined,
      });
      await manager.save(StockTransaction, txn);

      this.logger.log(
        `Receive: product=${dto.productId} qty=${dto.quantity}${dto.unit || ""} ` +
          `(base=${qtyBase}) ${balanceBefore} → ${balanceAfter} by user=${userId}` +
          (unitCostBase != null ? ` unitCost=${unitCostBase}` : ""),
      );

      return savedMovement;
    });
  }

  // ── Stock Adjustment (นับสต็อก) ────────────────────────────────────
  async adjust(dto: AdjustDto, userId: string): Promise<InventoryMovement> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager
        .createQueryBuilder(Product, "p")
        .setLock("pessimistic_write")
        .where("p.id = :id", { id: dto.productId })
        .getOne();

      if (!product) throw new NotFoundException("ไม่พบสินค้า");

      const balanceBefore = Number(product.currentStock);
      const physicalCountBase = this.toBaseUnits(
        dto.physicalCount,
        dto.unit,
        product,
      );
      const varianceBase = physicalCountBase - balanceBefore;

      if (varianceBase === 0)
        throw new BadRequestException("ยอดไม่ต่างจากในระบบ ไม่ต้องปรับ");

      // Update product stock to reflect real count
      product.currentStock = physicalCountBase;
      await manager.save(Product, product);

      const movement = manager.create(InventoryMovement, {
        productId: dto.productId,
        movementType: MovementType.ADJUST,
        reasonCode: dto.reasonCode || "STOCK_TAKE",
        quantityInput: dto.physicalCount,
        quantityBase: varianceBase,
        unitInput: dto.unit || product.unit,
        unitBase: product.unit,
        costPrice: product.costPrice,
        notes:
          dto.notes ||
          `ยอดในระบบ ${balanceBefore} → นับจริง ${physicalCountBase} ${product.unit}`,
        balanceBefore,
        balanceAfter: physicalCountBase,
        userId,
      });
      const savedMovement = await manager.save(InventoryMovement, movement);

      // Legacy record
      const txn = manager.create(StockTransaction, {
        productId: dto.productId,
        transactionType: TransactionType.ADJUST,
        reasonCode: dto.reasonCode || "STOCK_TAKE",
        quantity: varianceBase,
        costPrice: product.costPrice ? Number(product.costPrice) : undefined,
        unit: product.unit,
        notes:
          dto.notes ||
          `ยอดในระบบ ${balanceBefore} → นับจริง ${physicalCountBase} ${product.unit}`,
        balanceAfter: physicalCountBase,
        userId,
      });
      await manager.save(StockTransaction, txn);

      this.logger.log(
        `Adjust: product=${dto.productId} ${balanceBefore} → ${physicalCountBase} (${varianceBase > 0 ? "+" : ""}${varianceBase}) by user=${userId}`,
      );

      return savedMovement;
    });
  }

  // ── Discard / Write-off (เคลียร์สินค้า) ──────────────────────────────
  async discard(dto: DiscardDto, userId: string): Promise<InventoryMovement> {
    if (dto.quantity <= 0) {
      throw new BadRequestException("quantity ต้องมากกว่า 0");
    }

    return this.dataSource.transaction(async (manager) => {
      const product = await manager
        .createQueryBuilder(Product, "p")
        .setLock("pessimistic_write")
        .where("p.id = :id", { id: dto.productId })
        .getOne();

      if (!product) throw new NotFoundException("ไม่พบสินค้า");

      const qtyBase = this.toBaseUnits(dto.quantity, dto.unit, product);
      const balanceBefore = Number(product.currentStock);

      if (qtyBase > balanceBefore) {
        throw new BadRequestException(
          `สินค้าในระบบมีแค่ ${balanceBefore} ${product.unit}`,
        );
      }

      const balanceAfter = balanceBefore - qtyBase;

      // Update product stock using entity to ensure consistency with history snapshot
      product.currentStock = balanceAfter;
      await manager.save(Product, product);

      const movement = manager.create(InventoryMovement, {
        productId: dto.productId,
        movementType: MovementType.OUT,
        reasonCode: dto.reasonCode,
        quantityInput: dto.quantity,
        quantityBase: qtyBase,
        unitInput: dto.unit || product.unit,
        unitBase: product.unit,
        costPrice: product.costPrice,
        notes: dto.notes || null,
        balanceBefore,
        balanceAfter,
        userId,
      });
      const savedMovement = await manager.save(InventoryMovement, movement);

      // Legacy record (quantity stored negative for OUT in stock_transactions)
      const txn = manager.create(StockTransaction, {
        productId: dto.productId,
        transactionType: TransactionType.OUT,
        reasonCode: dto.reasonCode,
        quantity: -qtyBase,
        costPrice: product.costPrice ? Number(product.costPrice) : undefined,
        unit: product.unit,
        notes: dto.notes,
        balanceAfter,
        userId,
      });
      await manager.save(StockTransaction, txn);

      this.logger.log(
        `Discard: product=${dto.productId} qty=${dto.quantity}${dto.unit || ""} ` +
          `(base=${qtyBase}) ${balanceBefore} → ${balanceAfter} by user=${userId}`,
      );

      return savedMovement;
    });
  }

  // ── Product Management ────────────────────────────────────────────
  async editProduct(
    productId: string,
    dto: UpdateProductDto,
    userId: string,
  ): Promise<Product> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException("ไม่พบสินค้า");
      }

      // Validation: price > 0 if provided
      if (dto.price !== undefined && dto.price <= 0) {
        throw new BadRequestException("ราคาขายต้องมากกว่า 0");
      }
      // Validation: costPrice > 0 if provided
      if (dto.costPrice !== undefined && dto.costPrice <= 0) {
        throw new BadRequestException("ราคาทุนต้องมากกว่า 0");
      }

      // Apply updates from DTO
      if (dto.name !== undefined) product.nameTh = dto.name;
      if (dto.price !== undefined) product.retailPrice = dto.price;
      if (dto.costPrice !== undefined) product.costPrice = dto.costPrice;
      if (dto.unit !== undefined) product.unit = dto.unit;
      if (dto.wholesaleUnit !== undefined)
        product.wholesaleUnit = dto.wholesaleUnit;
      if (dto.conversionFactor !== undefined)
        product.conversionFactor = dto.conversionFactor;

      const updatedProduct = await manager.save(Product, product);
      this.logger.log(`Edit: product=${productId} by user=${userId}`);
      return updatedProduct;
    });
  }

  async deleteProduct(productId: string, userId: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException("ไม่พบสินค้า");
      }

      // Check for existing inventory movements or stock transactions
      // This is crucial to maintain data integrity.
      const hasMovements = await manager.exists(InventoryMovement, {
        where: { productId: productId },
      });
      const hasTransactions = await manager.exists(StockTransaction, {
        where: { productId: productId },
      });

      if (hasMovements || hasTransactions) {
        throw new BadRequestException(
          "ไม่สามารถลบสินค้าได้เนื่องจากมีประวัติการเคลื่อนไหวสต็อกหรือรายการธุรกรรม. โปรดพิจารณาการทำ Soft Delete แทน.",
        );
      }

      await manager.remove(product);
      this.logger.log(`Delete: product=${productId} by user=${userId}`);
    });
  }

  // ── Transactions list (legacy) ────────────────────────────────────
  async listTransactions(query?: {
    productId?: string;
    type?: string;
    reasonCode?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const qb = this.txnRepo
      .createQueryBuilder("t")
      .leftJoinAndSelect("t.product", "product")
      .leftJoinAndSelect("t.user", "user")
      .orderBy("t.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (query?.productId)
      qb.andWhere("t.productId = :pid", { pid: query.productId });
    if (query?.type)
      qb.andWhere("t.transactionType = :type", { type: query.type });
    if (query?.reasonCode)
      qb.andWhere("t.reasonCode = :rc", { rc: query.reasonCode });
    if (query?.from && query?.to) {
      qb.andWhere("t.createdAt BETWEEN :from AND :to", {
        from: new Date(query.from),
        to: new Date(query.to + "T23:59:59"),
      });
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

  // ── Movements list (new) ──────────────────────────────────────────
  async listMovements(query?: {
    productId?: string;
    type?: MovementType;
    reasonCode?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const qb = this.movRepo
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.product", "product")
      .leftJoinAndSelect("m.user", "user")
      .orderBy("m.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (query?.productId)
      qb.andWhere("m.productId = :pid", { pid: query.productId });
    if (query?.type)
      qb.andWhere("m.movementType = :type", { type: query.type });
    if (query?.reasonCode)
      qb.andWhere("m.reasonCode = :rc", { rc: query.reasonCode });
    if (query?.from && query?.to) {
      qb.andWhere("m.createdAt BETWEEN :from AND :to", {
        from: new Date(query.from),
        to: new Date(query.to + "T23:59:59"),
      });
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

  // ── Discard summary report ────────────────────────────────────────
  async discardSummary(year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59);

    const rows = await this.movRepo
      .createQueryBuilder("m")
      .leftJoinAndSelect("m.product", "product")
      .where("m.movementType = :type", { type: MovementType.OUT })
      .andWhere("m.createdAt BETWEEN :from AND :to", { from, to })
      .orderBy("m.createdAt", "DESC")
      .getMany();

    const byReason: Record<
      string,
      { label: string; count: number; totalQty: number; totalCost: number }
    > = {};
    for (const row of rows) {
      const rc = row.reasonCode;
      if (!byReason[rc])
        byReason[rc] = { label: rc, count: 0, totalQty: 0, totalCost: 0 };
      byReason[rc].count++;
      byReason[rc].totalQty += Math.abs(Number(row.quantityBase));
      const cost = row.costPrice ?? row.product?.costPrice ?? 0;
      byReason[rc].totalCost +=
        Math.abs(Number(row.quantityBase)) * Number(cost);
    }

    return { rows, byReason, totalItems: rows.length };
  }

  // ── Suppliers CRUD ────────────────────────────────────────────────
  listSuppliers() {
    return this.supplierRepo.find({ order: { name: "ASC" } });
  }
  getSupplier(id: string) {
    return this.supplierRepo.findOne({ where: { id } });
  }
  createSupplier(dto: any) {
    return this.supplierRepo.save(this.supplierRepo.create(dto));
  }

  async updateSupplier(id: string, dto: any) {
    const s = await this.supplierRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException("ไม่พบ Supplier");
    Object.assign(s, dto);
    return this.supplierRepo.save(s);
  }

  // ── Private helpers ───────────────────────────────────────────────
  /** Convert user-entered quantity to product base unit quantity. */
  toBaseUnits(qty: number, unit: string | undefined, product: Product): number {
    if (
      unit &&
      product.wholesaleUnit &&
      unit.trim() === product.wholesaleUnit.trim() &&
      Number(product.conversionFactor) > 1
    ) {
      return qty * Number(product.conversionFactor);
    }
    return qty;
  }

  private round4(n: number): number {
    return Number(Number(n).toFixed(4));
  }

  private isWholesaleUnit(unit: string | undefined, product: Product): boolean {
    return !!(
      unit &&
      product.wholesaleUnit &&
      unit.trim() === product.wholesaleUnit.trim() &&
      Number(product.conversionFactor) > 1
    );
  }

  /** Convert input cost into per-base-unit cost (for accurate profit). */
  private toBaseUnitCost(costInput: number, unit: string | undefined, product: Product): number {
    const c = Number(costInput);
    if (!Number.isFinite(c) || c < 0) return 0;
    if (this.isWholesaleUnit(unit, product)) {
      const ratio = Number(product.conversionFactor) || 1;
      return this.round4(c / Math.max(1, ratio));
    }
    return this.round4(c);
  }

  private weightedAvgCost(args: {
    oldStock: number;
    oldCost: number;
    addStock: number;
    addUnitCost: number;
  }): number {
    const oldStock = Math.max(0, Number(args.oldStock) || 0);
    const addStock = Math.max(0, Number(args.addStock) || 0);
    const oldCost = Math.max(0, Number(args.oldCost) || 0);
    const addUnitCost = Math.max(0, Number(args.addUnitCost) || 0);
    const denom = oldStock + addStock;
    if (denom <= 0) return this.round4(addUnitCost);
    return this.round4(((oldStock * oldCost) + (addStock * addUnitCost)) / denom);
  }
}
