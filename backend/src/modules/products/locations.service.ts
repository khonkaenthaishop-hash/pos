import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, DataSource } from 'typeorm';
import { ProductLocation } from './product-location.entity';
import { Location } from './location.entity';
import { Product } from './product.entity';
import { StockTransaction, TransactionType } from '../inventory/stock-transaction.entity';

export interface LocationStockDto {
  locationId: number;
  fullCode: string;
  quantity: number;
  priority: number;
}

export interface UpdateLocationItem {
  locationId: number;
  quantity: number;
  priority?: number;
}

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(ProductLocation)
    private plRepo: Repository<ProductLocation>,
    @InjectRepository(Location)
    private locationRepo: Repository<Location>,
    @InjectRepository(Product)
    private productsRepo: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  private async findOrCreateLocationByCode(
    manager: EntityManager,
    fullCode: string,
  ): Promise<Location> {
    const code = (fullCode || '').trim();
    if (!code) throw new BadRequestException('location code ว่าง');
    const existing = await manager.findOne(Location, { where: { fullCode: code } });
    if (existing) return existing;
    const created = manager.create(Location, { fullCode: code, isActive: true });
    return manager.save(Location, created);
  }

  async getProductLocations(productId: string): Promise<LocationStockDto[]> {
    const rows = await this.plRepo.find({
      where: { productId },
      relations: ['location'],
      order: { priority: 'ASC' },
    });
    return rows.map(r => ({
      locationId: r.locationId,
      fullCode: r.location.fullCode,
      quantity: r.quantity,
      priority: r.priority,
    }));
  }

  async updateProductLocations(
    productId: string,
    items: UpdateLocationItem[],
  ): Promise<LocationStockDto[]> {
    // Validate no duplicate locationIds in request
    const ids = items.map(i => i.locationId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('มี locationId ซ้ำกัน');
    }

    // Validate all locationIds exist
    for (const item of items) {
      const loc = await this.locationRepo.findOne({ where: { id: item.locationId, isActive: true } });
      if (!loc) throw new NotFoundException(`ไม่พบ location id=${item.locationId}`);
    }

    await this.dataSource.transaction(async manager => {
      // Delete existing
      await manager.delete(ProductLocation, { productId });

      // Insert new
      for (const item of items) {
        if (item.quantity < 0) throw new BadRequestException('quantity ต้องไม่ติดลบ');
        await manager.insert(ProductLocation, {
          productId,
          locationId: item.locationId,
          quantity: item.quantity,
          priority: item.priority ?? 1,
        });
      }

      // Sync currentStock cache
      const total = items.reduce((s, i) => s + i.quantity, 0);
      await manager.update(Product, productId, { currentStock: total });
    });

    return this.getProductLocations(productId);
  }

  /**
   * Deduct stock from product_location rows ordered by priority ASC.
   * Must be called inside an existing transaction (pass EntityManager).
   */
  async deductStockMultiLocation(
    productId: string,
    qty: number,
    manager: EntityManager,
    userId?: string,
  ): Promise<void> {
    if (qty <= 0) return;

    const locs = await manager.find(ProductLocation, {
      where: { productId },
      order: { priority: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });

    // If there are no location rows yet, fall back to the product currentStock pool.
    if (locs.length === 0) {
      const product = await manager
        .createQueryBuilder(Product, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: productId })
        .getOne();
      if (!product) throw new NotFoundException('ไม่พบสินค้า');
      const balanceBefore = Number(product.currentStock);
      if (balanceBefore < qty) {
        throw new BadRequestException(`สินค้า "${product.nameTh}" ไม่เพียงพอ (มี ${balanceBefore}, ต้องการ ${qty})`);
      }
      const balanceAfter = balanceBefore - qty;
      await manager.update(Product, productId, {
        currentStock: balanceAfter,
        reservedStock: () => `GREATEST(reserved_stock - ${qty}, 0)`,
      });
      await manager.insert(StockTransaction, {
        productId,
        transactionType: TransactionType.OUT,
        reasonCode: 'SALE',
        quantity: qty,
        balanceAfter,
        userId: userId ?? null,
      });
      return;
    }

    let totalAvail = locs.reduce((s, l) => s + l.quantity, 0);
    if (totalAvail < qty) {
      // Resync missing stock from product.current_stock if it exists (prevents false "not enough" errors)
      const product = await manager
        .createQueryBuilder(Product, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id: productId })
        .getOne();
      if (!product) throw new NotFoundException('ไม่พบสินค้า');

      const pool = Number(product.currentStock);
      if (pool > totalAvail) {
        const missing = pool - totalAvail;
        const fallbackCode = (product.locationCode || 'FRONT').trim() || 'FRONT';
        const loc = await this.findOrCreateLocationByCode(manager, fallbackCode);
        const existing = locs.find(l => l.locationId === loc.id);
        if (existing) {
          existing.quantity += missing;
          await manager.save(ProductLocation, existing);
        } else {
          await manager.insert(ProductLocation, {
            productId,
            locationId: loc.id,
            quantity: missing,
            priority: 999,
          });
        }
        // Reload locs after resync (locked by txn)
        const nextLocs = await manager.find(ProductLocation, {
          where: { productId },
          order: { priority: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        locs.splice(0, locs.length, ...nextLocs);
        totalAvail = locs.reduce((s, l) => s + l.quantity, 0);
      }

      if (totalAvail < qty) {
        const name = product.nameTh ?? productId;
        throw new BadRequestException(`สินค้า "${name}" ไม่เพียงพอ (มี ${totalAvail}, ต้องการ ${qty})`);
      }
    }

    let remaining = qty;
    for (const loc of locs) {
      if (remaining <= 0) break;
      const take = Math.min(loc.quantity, remaining);
      loc.quantity -= take;
      remaining -= take;
      await manager.save(ProductLocation, loc);

      // Audit trail per location
      await manager.insert(StockTransaction, {
        productId,
        locationId: loc.locationId,
        transactionType: TransactionType.OUT,
        reasonCode: 'SALE',
        quantity: take,
        balanceAfter: loc.quantity,
        userId: userId ?? null,
      });
    }

    // Sync cache: total remaining across all locations
    const newTotal = locs.reduce((s, l) => s + l.quantity, 0);
    await manager.update(Product, productId, {
      currentStock: newTotal,
      reservedStock: () => `GREATEST(reserved_stock - ${qty}, 0)`,
    });
  }

  async listLocations(): Promise<Location[]> {
    return this.locationRepo.find({ where: { isActive: true }, order: { fullCode: 'ASC' } });
  }

  async createLocation(fullCode: string, opts?: Partial<Location>): Promise<Location> {
    const loc = this.locationRepo.create({ fullCode, ...opts });
    return this.locationRepo.save(loc);
  }
}
