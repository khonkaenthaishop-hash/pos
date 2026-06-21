import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';

export type EmailType =
  | 'created'
  | 'shipped'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'warning'
  | 'returned';

export type MatchStatus = 'pending' | 'matched' | 'unmatched' | 'manual';
export type ProcessStatus = 'pending' | 'processed' | 'skipped' | 'error';

@Entity('shipping_emails')
export class ShippingEmail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'gmail_message_id', length: 255, unique: true })
  gmailMessageId: string;

  @Column({ name: 'email_type', length: 30 })
  emailType: EmailType;

  @Column({ type: 'text' })
  subject: string;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  // ─── Parsed from email body ─────────────────────────────────────
  @Column({ type: 'varchar', name: 'cm_order_number', length: 50, nullable: true })
  cmOrderNumber: string | null;

  @Column({ type: 'varchar', name: 'c_number', length: 50, nullable: true })
  cNumber: string | null;

  @Column({ name: 'order_date', type: 'date', nullable: true })
  orderDate: string | null;

  @Column({ type: 'varchar', name: 'phone_last3', length: 3, nullable: true })
  phoneLast3: string | null;

  @Column({ type: 'varchar', name: 'payment_method', length: 30, nullable: true })
  paymentMethod: string | null;

  @Column({ type: 'varchar', name: 'delivery_method', length: 100, nullable: true })
  deliveryMethod: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  subtotal: number | null;

  @Column({ name: 'shipping_fee', type: 'decimal', precision: 10, scale: 2, nullable: true })
  shippingFee: number | null;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalAmount: number | null;

  // ─── Match result ───────────────────────────────────────────────
  @Column({ type: 'uuid', name: 'matched_order_id', nullable: true })
  matchedOrderId: string | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'matched_order_id' })
  matchedOrder: Order | null;

  @Column({ name: 'match_status', length: 20, default: 'pending' })
  matchStatus: MatchStatus;

  @Column({ name: 'amount_mismatch', type: 'jsonb', nullable: true })
  amountMismatch: { email_total: number; pos_total: number; diff: number } | null;

  // ─── Admin confirmation ─────────────────────────────────────────
  @Column({ name: 'admin_confirmed', default: false })
  adminConfirmed: boolean;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'uuid', name: 'confirmed_by', nullable: true })
  confirmedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'confirmed_by' })
  confirmedBy: User | null;

  // ─── Processing state ───────────────────────────────────────────
  @Column({ name: 'process_status', length: 20, default: 'pending' })
  processStatus: ProcessStatus;

  @Column({ name: 'process_error', type: 'text', nullable: true })
  processError: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'raw_body', type: 'text', nullable: true })
  rawBody: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
