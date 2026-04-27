import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('store_settings')
export class StoreSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'store_id', unique: true, default: 'default' })
  storeId: string;

  @Column({ type: 'jsonb', nullable: true })
  general: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  receipt: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  printer: Record<string, unknown> | null;

  @Column({ name: 'roles_perms', type: 'jsonb', nullable: true })
  rolesPerms: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  inventory: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  pricing: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  shipping: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  notifications: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  ai: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  security: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  analytics: Record<string, unknown> | null;

  @Column({ name: 'system_cfg', type: 'jsonb', nullable: true })
  systemCfg: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
