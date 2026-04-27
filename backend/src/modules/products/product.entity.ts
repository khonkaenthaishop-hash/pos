import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { ProductLocation } from './product-location.entity';
import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';

export enum TemperatureType {
  NORMAL = 'normal',
  COLD   = 'cold',
  FROZEN = 'frozen',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Identity ─────────────────────────────────────────────────────
  @Column({ nullable: true, unique: true })
  barcode: string;

  @Column({ name: 'pack_barcode', nullable: true, unique: true })
  packBarcode: string;

  @Column({ nullable: true, unique: true })
  sku: string;

  @Column({ name: 'name_th' })
  nameTh: string;

  @Column({ name: 'name_zh', nullable: true })
  nameZh: string;

  @Column({ name: 'name_en', nullable: true })
  nameEn: string;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  // ── Category ──────────────────────────────────────────────────────
  @Column({ name: 'category_id', nullable: true })
  categoryId: string;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  // ── Pricing ───────────────────────────────────────────────────────
  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 4, default: 0 })
  costPrice: number;

  @Column({ name: 'retail_price', type: 'decimal', precision: 10, scale: 2 })
  retailPrice: number;

  @Column({ name: 'wholesale_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  wholesalePrice: number;

  @Column({ name: 'min_wholesale_qty', default: 1 })
  minWholesaleQty: number;

  // ── Promotions (simple bundle pricing) ────────────────────────────
  /** If set, applies when buying at least promoQty (base units): e.g. 3 pieces for 40 THB. */
  @Column({ name: 'promo_qty', type: 'integer', nullable: true })
  promoQty: number;

  /** Total price for promoQty base units. */
  @Column({ name: 'promo_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  promoPrice: number;

  @Column({ name: 'vat_rate', type: 'decimal', precision: 5, scale: 2, default: 7.00 })
  vatRate: number;

  // ── Units ─────────────────────────────────────────────────────────
  @Column({ default: 'ชิ้น' })
  unit: string;

  @Column({ name: 'unit_zh', nullable: true })
  unitZh: string;

  @Column({ name: 'unit_en', nullable: true })
  unitEn: string;

  @Column({ name: 'base_unit', nullable: true })
  baseUnit: string;

  @Column({ name: 'wholesale_unit', nullable: true })
  wholesaleUnit: string;

  @Column({ name: 'conversion_factor', type: 'decimal', precision: 10, scale: 4, default: 1 })
  conversionFactor: number;

  // ── Inventory ─────────────────────────────────────────────────────
  @Column({
    name: 'temperature_type',
    type: 'enum',
    enum: TemperatureType,
    default: TemperatureType.NORMAL,
  })
  temperatureType: TemperatureType;

  @Column({ name: 'current_stock', default: 0 })
  currentStock: number;

  @Column({ name: 'min_stock', default: 5 })
  minStock: number;

  @Column({ name: 'reserved_stock', default: 0 })
  reservedStock: number;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @Column({ name: 'lot_number', nullable: true, length: 50 })
  lotNumber: string;

  // ── Location ──────────────────────────────────────────────────────
  @Column({ name: 'location_code', nullable: true, length: 20 })
  locationCode: string;

  @Column({ name: 'pick_sequence', default: 0 })
  pickSequence: number;

  // ── Supplier ──────────────────────────────────────────────────────
  @Column({ name: 'supplier_id', nullable: true })
  supplierId: string;

  // ── Description ───────────────────────────────────────────────────
  @Column({ name: 'description_th', type: 'text', nullable: true })
  descriptionTh: string;

  // ── Status ────────────────────────────────────────────────────────
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_approved', default: false })
  isApproved: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ProductLocation, pl => pl.product)
  productLocations: ProductLocation[];

  get availableStock(): number { return this.currentStock - this.reservedStock; }
  get isLowStock(): boolean    { return this.currentStock <= this.minStock; }
}
