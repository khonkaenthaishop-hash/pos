import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum SessionStatus {
  OPEN   = 'open',
  CLOSED = 'closed',
}

@Entity('cashier_sessions')
export class CashierSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string;        // stored as YYYY-MM-DD

  @Column({ name: 'cashier_id' })
  cashierId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @Column({ name: 'opening_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  openingAmount: number;

  @Column({ name: 'closing_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  closingAmount: number;

  @Column({ type: 'varchar', length: 20, default: SessionStatus.OPEN })
  status: SessionStatus;

  @Column({ name: 'opened_at', type: 'timestamptz', default: () => 'NOW()' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
