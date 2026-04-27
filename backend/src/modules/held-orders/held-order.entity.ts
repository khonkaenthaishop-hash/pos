import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Customer } from '../customers/customer.entity';

export interface HeldCartItem {
  productId?: string;
  productNameTh: string;
  productNameZh?: string;
  productNameEn?: string;
  unitPrice: number;
  quantity: number;
  itemDiscount?: number;
  isQuickItem?: boolean;
  pickLocation?: string;
  note?: string;
}

@Entity('held_orders')
export class HeldOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true, length: 100 })
  label: string;

  @Column({ name: 'cashier_id', nullable: true })
  cashierId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @Column({ name: 'customer_id', nullable: true })
  customerId: string;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_name', nullable: true, length: 200 })
  customerName: string;

  @Column({ type: 'jsonb', default: [] })
  cart: HeldCartItem[];

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
