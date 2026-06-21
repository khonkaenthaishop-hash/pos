import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('gmail_credentials')
export class GmailCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'store_id', length: 50, default: 'default' })
  storeId: string;

  @Column({ name: 'email_address', length: 255 })
  emailAddress: string;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string; // AES-256-GCM encrypted

  @Column({ name: 'refresh_token', type: 'text' })
  refreshToken: string; // AES-256-GCM encrypted

  @Column({ name: 'token_expiry', type: 'timestamptz' })
  tokenExpiry: Date;

  @Column({ length: 20, default: 'active' })
  status: 'active' | 'expired' | 'revoked';

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt: Date | null;

  @Column({ name: 'last_sync_count', default: 0 })
  lastSyncCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
