// audit-log.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

export enum AuditAction {
  STOCK_ADJUST      = 'STOCK_ADJUST',
  STOCK_RECEIVE     = 'STOCK_RECEIVE',
  PRICE_CHANGE      = 'PRICE_CHANGE',
  ORDER_CANCEL      = 'ORDER_CANCEL',
  ORDER_CREATE      = 'ORDER_CREATE',
  PRODUCT_APPROVE   = 'PRODUCT_APPROVE',
  PRODUCT_CREATE    = 'PRODUCT_CREATE',
  PRODUCT_UPDATE    = 'PRODUCT_UPDATE',
  PRODUCT_DELETE    = 'PRODUCT_DELETE',
  BILL_VOID         = 'BILL_VOID',
  WRONG_ITEM_PACKED = 'WRONG_ITEM_PACKED',
  USER_LOGIN        = 'USER_LOGIN',
  USER_CREATE       = 'USER_CREATE',
  USER_DEACTIVATE   = 'USER_DEACTIVATE',
  USER_ACTIVATE     = 'USER_ACTIVATE',
  ORDER_RETURN      = 'ORDER_RETURN',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ name: 'target_table', nullable: true })
  targetTable: string;

  @Column({ name: 'target_id', nullable: true })
  targetId: string;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue: any;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue: any;

  @Column({ nullable: true })
  reason: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ name: 'device_info', nullable: true })
  deviceInfo: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
