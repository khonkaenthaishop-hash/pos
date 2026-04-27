import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from "typeorm";
import { Order } from "../orders/order.entity";

@Entity("shipments")
export class Shipment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "order_number", unique: true })
  orderNumber: string;

  @OneToOne(() => Order, { nullable: false })
  @JoinColumn({ name: "order_number", referencedColumnName: "orderNo" })
  order: Order;

  @Column({ name: "tracking_number", nullable: true })
  trackingNumber: string;

  @Column({ nullable: true })
  carrier: string;

  @Column({ default: "SHIPPED" })
  status: string;

  @Column({ type: "text", nullable: true })
  notes: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
