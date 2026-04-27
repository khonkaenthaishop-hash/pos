import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("customers")
export class Customer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  nickname: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: "facebook_id", nullable: true })
  facebookId: string;

  @Column({ name: "line_id", nullable: true })
  lineId: string;

  @Column({ name: "tier_id", nullable: true })
  tierId: string;

  @Column({ name: "total_orders", type: "integer", default: 0 })
  totalOrders: number;

  @Column({ name: "total_spent", type: "decimal", precision: 12, scale: 2, default: 0 })
  totalSpent: number;

  @Column({ nullable: true, type: "text" })
  note: string;

  @Column({ name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
