import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';

export enum MovementType {
  IN     = 'IN',
  OUT    = 'OUT',
  ADJUST = 'ADJUST',
}

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── What moved ─────────────────────────────────────────────────
  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'movement_type', type: 'varchar', length: 20 })
  movementType: MovementType;

  @Column({ name: 'reason_code', length: 50 })
  reasonCode: string;

  // ── Quantities ─────────────────────────────────────────────────
  /** Quantity as entered by user (may be in wholesale unit) */
  @Column({ name: 'quantity_input', type: 'decimal', precision: 12, scale: 2 })
  quantityInput: number;

  /** Quantity converted to product base unit */
  @Column({ name: 'quantity_base', type: 'decimal', precision: 12, scale: 2 })
  quantityBase: number;

  @Column({ name: 'unit_input', type: 'varchar', nullable: true, length: 50 })
  unitInput: string | null;

  @Column({ name: 'unit_base', type: 'varchar', nullable: true, length: 50 })
  unitBase: string | null;

  // ── Financials ─────────────────────────────────────────────────
  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 4, nullable: true })
  costPrice: number | null;

  // ── Reference ──────────────────────────────────────────────────
  @Column({ name: 'reference_no', type: 'varchar', nullable: true, length: 100 })
  referenceNo: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  // ── Stock snapshot ─────────────────────────────────────────────
  @Column({ name: 'balance_before', type: 'decimal', precision: 12, scale: 2 })
  balanceBefore: number;

  @Column({ name: 'balance_after', type: 'decimal', precision: 12, scale: 2 })
  balanceAfter: number;

  // ── Who / when ─────────────────────────────────────────────────
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
