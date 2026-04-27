import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeldOrder, HeldCartItem } from './held-order.entity';

export interface HoldDto {
  label?: string;
  customerId?: string;
  customerName?: string;
  cart: HeldCartItem[];
  discount?: number;
  note?: string;
}

export interface HeldOrderSummary {
  id: string;
  label: string;
  itemCount: number;
  totalQty: number;
  customerName: string | null;
  discount: number;
  createdAt: Date;
}

@Injectable()
export class HeldOrdersService {
  private readonly logger = new Logger(HeldOrdersService.name);

  constructor(
    @InjectRepository(HeldOrder)
    private readonly repo: Repository<HeldOrder>,
  ) {}

  /** Persist a cart as a held order. Returns the full saved record. */
  async hold(dto: HoldDto, cashierId: string): Promise<HeldOrder> {
    const entity = this.repo.create({
      label: dto.label || null,
      cashierId,
      customerId: dto.customerId || null,
      customerName: dto.customerName || null,
      cart: dto.cart,
      discount: dto.discount ?? 0,
      note: dto.note || null,
    });
    const saved = await this.repo.save(entity);
    this.logger.log(`Held order created: id=${saved.id} cashier=${cashierId} items=${dto.cart.length}`);
    return saved;
  }

  /** List summaries of all held orders (newest first). */
  async list(cashierId?: string): Promise<HeldOrderSummary[]> {
    const qb = this.repo.createQueryBuilder('h')
      .orderBy('h.created_at', 'DESC');

    if (cashierId) qb.where('h.cashier_id = :cashierId', { cashierId });

    const rows = await qb.getMany();
    return rows.map(r => this.toSummary(r));
  }

  /** Get full held order (cart JSON included). */
  async getById(id: string): Promise<HeldOrder> {
    const held = await this.repo.findOne({
      where: { id },
      relations: ['customer', 'cashier'],
    });
    if (!held) throw new NotFoundException('ไม่พบบิลที่พักไว้');
    return held;
  }

  /**
   * Resume (restore) a held order:
   * Returns the full record then DELETES it so it can't be resumed twice.
   */
  async resume(id: string): Promise<HeldOrder> {
    const held = await this.getById(id);
    await this.repo.delete(id);
    this.logger.log(`Held order resumed + deleted: id=${id}`);
    return held;
  }

  /** Hard-delete a held order (user dismissed it). */
  async discard(id: string): Promise<void> {
    const result = await this.repo.delete(id);
    if (!result.affected) throw new NotFoundException('ไม่พบบิลที่พักไว้');
    this.logger.log(`Held order discarded: id=${id}`);
  }

  // ── private ──────────────────────────────────────────────────────
  private toSummary(r: HeldOrder): HeldOrderSummary {
    const totalQty = (r.cart || []).reduce((s, i) => s + (i.quantity || 0), 0);
    return {
      id: r.id,
      label: r.label || `บิล ${r.id.slice(-4).toUpperCase()}`,
      itemCount: (r.cart || []).length,
      totalQty,
      customerName: r.customerName || null,
      discount: Number(r.discount),
      createdAt: r.createdAt,
    };
  }
}
