import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';

export interface TrackingHistoryEntry {
  status: string;
  timestamp: string;
  email_id: string;
}

@Entity('shipping_tracking')
export class ShippingTracking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', name: 'cm_order_number', length: 50, nullable: true, unique: true })
  cmOrderNumber: string | null;

  @Column({ type: 'varchar', name: 'c_number', length: 50, nullable: true })
  cNumber: string | null;

  @Column({ length: 30, default: 'seven_eleven' })
  carrier: string;

  @Column({ name: 'current_status', length: 30, default: 'created' })
  currentStatus: string;

  @Column({ name: 'status_history', type: 'jsonb', default: [] })
  statusHistory: TrackingHistoryEntry[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
