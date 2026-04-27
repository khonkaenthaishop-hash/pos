import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { User } from '../users/user.entity';

// ─── Enums ────────────────────────────────────────────────────────────
export enum OrderType {
  POS    = 'pos',
  ONLINE = 'online',
}

export enum OrderStatus {
  PENDING   = 'pending',
  CONFIRMED = 'confirmed',
  PACKING   = 'packing',
  SHIPPED   = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  CLAIMED   = 'claimed',
}

export enum PaymentMethod {
  CASH     = 'cash',
  QR       = 'qr',
  TRANSFER = 'transfer',
  COD      = 'cod',
  DEBT     = 'debt',
}

export enum CarrierName {
  SEVEN_ELEVEN = 'seven_eleven',
  FAMILY_MART  = 'family_mart',
  OK_MART      = 'ok_mart',
  HILIFE       = 'hilife',
  BLACK_CAT    = 'black_cat',
  POST         = 'post',
}

export enum TemperatureType {
  NORMAL = 'normal',
  COLD   = 'cold',
  FROZEN = 'frozen',
}

export enum PackageSize {
  SMALL  = 'small',
  MEDIUM = 'medium',
  LARGE  = 'large',
}

// ─── Order (must match DB schema exactly) ────────────────────────────
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_no', unique: true })
  orderNo: string;

  @Column({ type: 'enum', enum: OrderType })
  type: OrderType;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  // ─── Customer ─────────────────────────────────────────────────────
  @Column({ name: 'customer_id', nullable: true })
  customerId: string;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ name: 'customer_name', length: 100, nullable: true })
  customerName: string;

  @Column({ name: 'order_nickname', length: 100, nullable: true })
  orderNickname: string;

  // ─── Financials ───────────────────────────────────────────────────
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ name: 'shipping_fee', type: 'decimal', precision: 10, scale: 2, default: 0 })
  shippingFee: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  paymentMethod: PaymentMethod;

  @Column({ name: 'is_paid', default: false })
  isPaid: boolean;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;

  // ─── Shipping ─────────────────────────────────────────────────────
  @Column({ type: 'enum', enum: CarrierName, nullable: true })
  carrier: CarrierName;

  @Column({ type: 'enum', enum: TemperatureType, nullable: true, default: TemperatureType.NORMAL })
  temperature: TemperatureType;

  @Column({ name: 'package_size', type: 'enum', enum: PackageSize, nullable: true })
  packageSize: PackageSize;

  @Column({ name: 'shipping_address_id', nullable: true })
  shippingAddressId: string;

  // ─── Staff ────────────────────────────────────────────────────────
  @Column({ name: 'cashier_id', nullable: true })
  cashierId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @Column({ name: 'packed_by', nullable: true })
  packedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'packed_by' })
  packedBy: User;

  // ─── Meta ─────────────────────────────────────────────────────────
  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// ─── OrderItem ────────────────────────────────────────────────────────
@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'product_id', nullable: true })
  productId: string;

  @Column({ name: 'product_name_th', length: 200 })
  productNameTh: string;

  @Column({ name: 'product_name_zh', length: 200, nullable: true })
  productNameZh: string;

  @Column({ name: 'product_name_en', length: 200, nullable: true })
  productNameEn: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 4, default: 0 })
  costPrice: number;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({ name: 'item_discount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  itemDiscount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ name: 'is_quick_item', default: false })
  isQuickItem: boolean;

  @Column({ name: 'is_checked', default: false })
  isChecked: boolean;

  @Column({ type: 'text', nullable: true })
  note: string;
}
