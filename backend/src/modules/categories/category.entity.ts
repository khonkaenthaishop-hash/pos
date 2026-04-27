// category.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name_th' })
  nameTh: string;

  @Column({ name: 'name_zh', nullable: true })
  nameZh: string;

  @Column({ name: 'name_en', nullable: true })
  nameEn: string;

  @Column({ nullable: true })
  type: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
