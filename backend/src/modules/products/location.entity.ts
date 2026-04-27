import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToMany, CreateDateColumn,
} from 'typeorm';
import { ProductLocation } from './product-location.entity';

@Entity('location')
export class Location {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'full_code', unique: true })
  fullCode: string;

  @Column({ nullable: true }) zone: string;
  @Column({ nullable: true }) aisle: string;
  @Column({ nullable: true }) shelf: string;
  @Column({ nullable: true }) bin: string;
  @Column({ nullable: true }) barcode: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ProductLocation, pl => pl.location)
  productLocations: ProductLocation[];
}
