import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from './product.entity';
import { ProductLocation } from './product-location.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { UserRole } from '../users/user.entity';
import { InventoryMovement, MovementType } from '../inventory/inventory-movement.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepo: Repository<Product>,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  private normalizeOptionalString(v: unknown): string | null {
    if (typeof v !== 'string') return v == null ? null : String(v);
    const s = v.trim();
    return s.length ? s : null;
  }

  async findAll(query?: {
    search?: string;
    categoryId?: string;
    locationCode?: string;
    lowStock?: boolean;
    pendingApproval?: boolean;
    includeInactive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const qb = this.productsRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'category');

    if (!query?.includeInactive) {
      qb.where('p.is_active = true');
    }

	    if (query?.search) {
	      const condition = '(p.name_th ILIKE :s OR p.barcode = :exact OR p.pack_barcode = :exact OR p.sku ILIKE :s)';
	      if (query?.includeInactive) {
	        qb.where(condition, { s: `%${query.search}%`, exact: query.search });
	      } else {
	        qb.andWhere(condition, { s: `%${query.search}%`, exact: query.search });
	      }
	    }
    if (query?.categoryId) {
      qb.andWhere('p.category_id = :cat', { cat: query.categoryId });
    }
    if (query?.locationCode) {
      qb.andWhere('p.location_code = :loc', { loc: query.locationCode });
    }
    if (query?.lowStock) {
      qb.andWhere('p.current_stock <= p.min_stock');
    }
    if (query?.pendingApproval !== undefined) {
      qb.andWhere('p.is_approved = :approved', { approved: !query.pendingApproval });
    }

    if (query?.page !== undefined || query?.limit !== undefined) {
      const page = Math.max(1, Number(query.page ?? 1));
      const limit = Math.max(1, Math.min(200, Number(query.limit ?? 20)));
      qb.skip((page - 1) * limit).take(limit);
    }

    return qb.orderBy('p.name_th', 'ASC').getMany();
  }

  async findByBarcode(
    barcode: string,
    opts?: { mode?: 'unit' | 'inventory' | 'any' },
  ): Promise<(Product & { scan?: { kind: 'unit' | 'pack'; unit: string; ratio: number; barcode: string } }) | null> {
    const code = this.normalizeOptionalString(barcode);
    if (!code) return null;

    const allowPack = opts?.mode === 'inventory' || opts?.mode === 'any';
    const where = allowPack
      ? [{ barcode: code, isActive: true } as any, { packBarcode: code, isActive: true } as any]
      : [{ barcode: code, isActive: true } as any];

    const product = await this.productsRepo.findOne({
      where,
      relations: ['category'],
    });
    if (!product) return null;

    const isPack = allowPack && this.normalizeOptionalString((product as any).packBarcode) === code;
    const kind: 'unit' | 'pack' = isPack ? 'pack' : 'unit';
    const unit = isPack ? (product.wholesaleUnit || product.unit) : product.unit;
    const ratio = isPack ? Math.max(1, Number(product.conversionFactor) || 1) : 1;
    (product as any).scan = { kind, unit, ratio, barcode: code };
    return product as any;
  }

  async findById(id: string): Promise<Product> {
    const product = await this.productsRepo.findOne({
      where: { id },
      relations: ['category', 'createdBy', 'approvedBy'],
    });
    if (!product) throw new NotFoundException('ไม่พบสินค้า');
    return product;
  }

  private generateSku(): string {
    const prefix = 'SKU';
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `${prefix}-${ts}-${rand}`;
  }

  async create(dto: Partial<Product>, createdById: string, role: UserRole): Promise<Product> {
    (dto as any).barcode = this.normalizeOptionalString((dto as any).barcode);
    (dto as any).packBarcode = this.normalizeOptionalString((dto as any).packBarcode);
    (dto as any).sku = this.normalizeOptionalString((dto as any).sku);
    (dto as any).wholesaleUnit = this.normalizeOptionalString((dto as any).wholesaleUnit);

    if ((dto as any).packBarcode) {
      const ratio = Number((dto as any).conversionFactor ?? 1);
      if (!Number.isFinite(ratio) || ratio <= 1) {
        throw new BadRequestException('Conversion Ratio ต้องมากกว่า 1 เมื่อระบุ Pack Barcode');
      }
      if (!(dto as any).wholesaleUnit) {
        throw new BadRequestException('กรุณาระบุหน่วยแพ็ค (wholesaleUnit) เมื่อระบุ Pack Barcode');
      }
      if ((dto as any).wholesalePrice == null || Number((dto as any).wholesalePrice) <= 0) {
        throw new BadRequestException('กรุณาระบุราคายกแพ็ค (wholesalePrice) เมื่อระบุ Pack Barcode');
      }
      if ((dto as any).barcode && (dto as any).barcode === (dto as any).packBarcode) {
        throw new BadRequestException('Barcode (Unit) และ Barcode (Pack) ต้องไม่ซ้ำกัน');
      }
    }

    const sku = dto.sku?.trim() || this.generateSku();
    const product = this.productsRepo.create({
      ...dto,
      sku,
      createdBy: { id: createdById } as any,
      isApproved: [UserRole.OWNER, UserRole.MANAGER].includes(role),
    });
    const saved = await this.productsRepo.save(product);
    await this.auditService.log({
      userId: createdById,
      action: AuditAction.PRODUCT_CREATE,
      targetTable: 'products',
      targetId: saved.id,
      newValue: { nameTh: saved.nameTh },
    });
    return saved;
  }

  async update(
    id: string,
    dto: Partial<Pick<Product, 'nameTh' | 'nameZh' | 'nameEn' | 'barcode' | 'categoryId' | 'unit' | 'minStock' | 'temperatureType' | 'descriptionTh'>>,
    userId: string,
  ): Promise<Product> {
    const product = await this.findById(id);
    if (dto && typeof dto === 'object') {
      (dto as any).barcode = this.normalizeOptionalString((dto as any).barcode);
      (dto as any).packBarcode = this.normalizeOptionalString((dto as any).packBarcode);
      (dto as any).sku = this.normalizeOptionalString((dto as any).sku);
      (dto as any).wholesaleUnit = this.normalizeOptionalString((dto as any).wholesaleUnit);
    }

    const nextPackBarcode = (dto as any).packBarcode ?? product.packBarcode;
    if (nextPackBarcode) {
      const nextWholesaleUnit = (dto as any).wholesaleUnit ?? product.wholesaleUnit;
      const nextRatio = (dto as any).conversionFactor != null ? Number((dto as any).conversionFactor) : Number(product.conversionFactor);
      if (!nextWholesaleUnit) {
        throw new BadRequestException('กรุณาระบุหน่วยแพ็ค (wholesaleUnit) เมื่อระบุ Pack Barcode');
      }
      if (!Number.isFinite(nextRatio) || nextRatio <= 1) {
        throw new BadRequestException('Conversion Ratio ต้องมากกว่า 1 เมื่อระบุ Pack Barcode');
      }
      const nextWholesalePrice = (dto as any).wholesalePrice ?? product.wholesalePrice;
      if (nextWholesalePrice == null || Number(nextWholesalePrice) <= 0) {
        throw new BadRequestException('กรุณาระบุราคายกแพ็ค (wholesalePrice) เมื่อระบุ Pack Barcode');
      }
      const nextUnitBarcode = (dto as any).barcode ?? product.barcode;
      if (nextUnitBarcode && nextUnitBarcode === nextPackBarcode) {
        throw new BadRequestException('Barcode (Unit) และ Barcode (Pack) ต้องไม่ซ้ำกัน');
      }
    }

    const oldValue = { nameTh: product.nameTh, categoryId: product.categoryId, unit: product.unit };
    Object.assign(product, dto);
    await this.productsRepo.save(product);
    await this.auditService.log({
      userId,
      action: AuditAction.PRODUCT_UPDATE,
      targetTable: 'products',
      targetId: id,
      oldValue,
      newValue: dto,
      reason: 'แก้ไขข้อมูลสินค้า',
    });
    return product;
  }

  async toggleActive(id: string, _userId: string): Promise<Product> {
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('ไม่พบสินค้า');
    product.isActive = !product.isActive;
    await this.productsRepo.save(product);
    return product;
  }

  async remove(id: string, userId: string): Promise<void> {
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('ไม่พบสินค้า');
    await this.productsRepo.delete(id);
    await this.auditService.log({
      userId,
      action: AuditAction.PRODUCT_DELETE,
      targetTable: 'products',
      targetId: id,
      oldValue: { nameTh: product.nameTh },
      reason: 'owner ลบสินค้า',
    });
  }

  async approve(id: string, approverId: string): Promise<Product> {
    const product = await this.findById(id);
    if (product.isApproved) throw new BadRequestException('อนุมัติแล้ว');
    product.isApproved = true;
    product.approvedBy = { id: approverId } as any;
    product.approvedAt = new Date();
    await this.productsRepo.save(product);
    await this.auditService.log({
      userId: approverId,
      action: AuditAction.PRODUCT_APPROVE,
      targetTable: 'products',
      targetId: id,
      newValue: { isApproved: true },
    });
    return product;
  }

  async updatePrice(
    id: string,
    dto: { retailPrice?: number; wholesalePrice?: number; costPrice?: number },
    userId: string,
    role: UserRole,
  ): Promise<Product> {
    if (role !== UserRole.OWNER) throw new ForbiddenException('เฉพาะเจ้าของร้านเท่านั้น');
    if (dto.retailPrice !== undefined && dto.retailPrice < 0)
      throw new BadRequestException('ราคาขายต้องไม่ติดลบ');
    if (dto.costPrice !== undefined && dto.costPrice < 0)
      throw new BadRequestException('ราคาทุนต้องไม่ติดลบ');
    if (dto.wholesalePrice !== undefined && dto.wholesalePrice < 0)
      throw new BadRequestException('ราคาส่งต้องไม่ติดลบ');
    const product = await this.findById(id);
    const oldValue = {
      retailPrice: product.retailPrice,
      wholesalePrice: product.wholesalePrice,
      costPrice: product.costPrice,
    };
    Object.assign(product, dto);
    await this.productsRepo.save(product);
    await this.auditService.log({
      userId,
      action: AuditAction.PRICE_CHANGE,
      targetTable: 'products',
      targetId: id,
      oldValue,
      newValue: dto,
      reason: 'เจ้าของแก้ไขราคา',
    });
    return product;
  }

  async adjustStock(id: string, adjustment: number, reason: string, userId: string): Promise<Product> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager
        .createQueryBuilder(Product, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .getOne();
      if (!product) throw new NotFoundException('ไม่พบสินค้า');

      const oldStock = Number(product.currentStock);
      const newStock = oldStock + adjustment;
      if (newStock < 0) {
        throw new BadRequestException(
          `สต็อคไม่เพียงพอ: มีอยู่ ${oldStock} ชิ้น แต่ต้องการปรับลด ${Math.abs(adjustment)} ชิ้น`
        );
      }
      product.currentStock = newStock;
      await manager.save(Product, product);

      // Sync product_location: upsert the location row for this product
      // so POS stock deduction (which reads product_location) stays in sync
      const existingLocs = await manager.find(ProductLocation, { where: { productId: id } });
      if (existingLocs.length > 0) {
        // Distribute adjustment proportionally across existing locations,
        // or simply set the first location to reflect the new total
        const _totalInLocs = existingLocs.reduce((s, l) => s + Number(l.quantity), 0);
        let remaining = adjustment;
        for (const loc of existingLocs) {
          const locQty = Number(loc.quantity);
          if (remaining === 0) break;
          const change = remaining > 0
            ? Math.min(remaining, adjustment)   // add to each until done
            : Math.max(remaining, -locQty);     // deduct but don't go negative
          loc.quantity = locQty + change;
          remaining -= change;
          await manager.save(ProductLocation, loc);
          if (remaining === 0) break;
        }
      } else if (adjustment > 0) {
        // No location rows yet — create one using product's locationCode or 'FRONT'
        const { Location } = await import('./location.entity');
        const locCode = product.locationCode || 'FRONT';
        const loc = await manager.findOne(Location, { where: { fullCode: locCode } });
        if (loc) {
          const pl = manager.create(ProductLocation, {
            productId: id,
            locationId: loc.id,
            quantity: newStock,
            priority: 1,
          });
          await manager.save(ProductLocation, pl);
        }
      }

      // Write to inventory_movements for full traceability
      const movement = manager.create(InventoryMovement, {
        productId: id,
        movementType: MovementType.ADJUST,
        reasonCode: 'STOCK_ADJUST',
        quantityInput: adjustment,
        quantityBase: adjustment,
        unitInput: product.unit,
        unitBase: product.unit,
        costPrice: product.costPrice,
        notes: reason,
        balanceBefore: oldStock,
        balanceAfter: newStock,
        userId,
      });
      await manager.save(InventoryMovement, movement);

      await this.auditService.log({
        userId,
        action: AuditAction.STOCK_ADJUST,
        targetTable: 'products',
        targetId: id,
        oldValue: { stock: oldStock },
        newValue: { stock: newStock, adjustment },
        reason,
      });
      return product;
    });
  }

  async reserveStock(id: string, qty: number): Promise<void> {
    const product = await this.findById(id);
    if (product.currentStock - product.reservedStock < qty) {
      throw new BadRequestException(`สินค้า "${product.nameTh}" ไม่เพียงพอ`);
    }
    await this.productsRepo.increment({ id }, 'reservedStock', qty);
  }

  async releaseReserved(id: string, qty: number): Promise<void> {
    await this.productsRepo.decrement({ id }, 'reservedStock', qty);
  }

  async deductStock(id: string, qty: number): Promise<void> {
    const product = await this.findById(id);
    await this.productsRepo.update(id, {
      currentStock: Math.max(0, product.currentStock - qty),
      reservedStock: Math.max(0, product.reservedStock - qty),
    });
  }

  async getLowStockProducts() {
    return this.productsRepo
      .createQueryBuilder('p')
      .where('p.current_stock <= p.min_stock')
      .andWhere('p.is_active = true')
      .andWhere('p.is_approved = true')
      .orderBy('p.current_stock', 'ASC')
      .getMany();
  }

  async getExpiringProducts(_daysAhead: number = 7) {
    return this.productsRepo
      .createQueryBuilder('p')
      .where('p.is_active = true')
      .getMany();
  }
}
