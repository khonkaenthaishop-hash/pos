import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';

export enum TransactionType {
  IN     = 'IN',
  ADJUST = 'ADJUST',
  OUT    = 'OUT',
}

export const REASON_CODES = {
  IN: [
    { code: 'PO',           label: 'สั่งซื้อใหม่ (PO)' },
    { code: 'RETURN',       label: 'รับคืนจากลูกค้า' },
    { code: 'TRANSFER_IN',  label: 'ย้ายคลัง (เข้า)' },
  ],
  ADJUST: [
    { code: 'STOCK_TAKE',   label: 'นับสต็อกประจำงวด' },
    { code: 'OVER',         label: 'สินค้าเกิน' },
    { code: 'SHORT',        label: 'สินค้าขาด' },
  ],
  OUT: [
    { code: 'EXPIRED',      label: 'สินค้าหมดอายุ' },
    { code: 'DAMAGED',      label: 'สินค้าชำรุด' },
    { code: 'SAMPLE',       label: 'สินค้าตัวอย่าง' },
    { code: 'LOST',         label: 'สินค้าหาย' },
    { code: 'TRANSFER_OUT', label: 'ย้ายคลัง (ออก)' },
  ],
} as const;

@Entity('stock_transactions')
export class StockTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id' })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({
    name: 'transaction_type',
    type: 'varchar',
    length: 20,
  })
  transactionType: TransactionType;

  @Column({ name: 'reason_code', length: 50 })
  reasonCode: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ nullable: true, length: 50 })
  unit: string;

  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 4, nullable: true })
  costPrice: number;

  @Column({ name: 'reference_no', nullable: true, length: 100 })
  referenceNo: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ name: 'balance_after', type: 'decimal', precision: 12, scale: 2, nullable: true })
  balanceAfter: number;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'location_id', nullable: true })
  locationId: number;

  @Column({ name: 'supplier_id', nullable: true })
  supplierId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
