import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { Exclude } from 'class-transformer';

export enum UserRole {
  OWNER   = 'owner',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  STAFF   = 'staff',
  ADMIN   = 'admin',
}

export enum AppLanguage {
  TH    = 'th',
  ZH_TW = 'zh_TW',
  EN    = 'en',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ name: 'password_hash' })
  @Exclude()
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STAFF })
  role: UserRole;

  @Column({ name: 'name_th', nullable: true })
  nameTh: string;

  @Column({ name: 'name_zh', nullable: true })
  nameZh: string;

  @Column({ name: 'name_en', nullable: true })
  nameEn: string;

  @Column({ nullable: true })
  phone: string;

  @Column({
    name: 'preferred_lang',
    type: 'enum',
    enum: AppLanguage,
    default: AppLanguage.TH,
  })
  preferredLang: AppLanguage;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
