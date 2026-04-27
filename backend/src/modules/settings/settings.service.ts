import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StoreSettings } from './store-settings.entity';
import { Warehouse } from './warehouse.entity';

const MASKED = '****';
const UNCHANGED = '__UNCHANGED__';
const MASKED_FIELDS: Record<string, string[]> = {
  notifications: ['lineNotifyToken', 'smtpPass'],
  ai: ['apiKey'],
};

const STORE_ID = 'default';

@Injectable()
export class SettingsService {
  private schemaEnsured = false;

  constructor(
    private dataSource: DataSource,
    @InjectRepository(StoreSettings)
    private settingsRepo: Repository<StoreSettings>,
    @InjectRepository(Warehouse)
    private warehouseRepo: Repository<Warehouse>,
  ) {}

  private async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return;

    // Ensure extension for uuid_generate_v4()
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    const [storeSettings] = await this.dataSource.query<{ to_regclass: string | null }[]>(
      `SELECT to_regclass('public.store_settings')`,
    );
    if (!storeSettings?.to_regclass) {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS store_settings (
          id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          store_id      VARCHAR(64) NOT NULL UNIQUE DEFAULT 'default',
          general       JSONB,
          receipt       JSONB,
          printer       JSONB,
          roles_perms   JSONB,
          inventory     JSONB,
          pricing       JSONB,
          shipping      JSONB,
          notifications JSONB,
          ai            JSONB,
          security      JSONB,
          analytics     JSONB,
          system_cfg    JSONB,
          created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await this.dataSource.query(
        `INSERT INTO store_settings (store_id) VALUES ('default') ON CONFLICT DO NOTHING;`,
      );
    }

    const [warehouses] = await this.dataSource.query<{ to_regclass: string | null }[]>(
      `SELECT to_regclass('public.warehouses')`,
    );
    if (!warehouses?.to_regclass) {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS warehouses (
          id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          store_id   VARCHAR(64) NOT NULL DEFAULT 'default',
          name       VARCHAR(120) NOT NULL,
          zone       VARCHAR(80),
          address    TEXT,
          is_default BOOLEAN NOT NULL DEFAULT false,
          is_active  BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    }

    this.schemaEnsured = true;
  }

  private async getRow(): Promise<StoreSettings> {
    await this.ensureSchema();
    let row = await this.settingsRepo.findOne({ where: { storeId: STORE_ID } });
    if (!row) {
      row = this.settingsRepo.create({ storeId: STORE_ID });
      await this.settingsRepo.save(row);
    }
    return row;
  }

  private maskFields(group: string, data: Record<string, unknown>): Record<string, unknown> {
    const fields = MASKED_FIELDS[group];
    if (!fields) return data;
    const masked = { ...data };
    for (const f of fields) {
      if (masked[f]) masked[f] = MASKED;
    }
    return masked;
  }

  private normalizeReceiptSettings(incoming: Record<string, unknown>): Record<string, unknown> {
    const next: Record<string, unknown> = { ...incoming };

    // If legacy UI fields are present, they are the source of truth (UI may also send footerLines).
    const hasLegacyFooter =
      ('footerLine1' in next) || ('footerLine2' in next) || ('footerLine3' in next);

    if (hasLegacyFooter) {
      const lines = [
        typeof next.footerLine1 === 'string' ? next.footerLine1 : '',
        typeof next.footerLine2 === 'string' ? next.footerLine2 : '',
        typeof next.footerLine3 === 'string' ? next.footerLine3 : '',
      ].map((s) => s.trim()).filter(Boolean);

      // Allow clearing: store [] when all lines are blank
      next.footerLines = lines;
    } else if (!Array.isArray(next.footerLines)) {
      // If footerLines not provided, build from footerLine1..3 (legacy UI shape)
      const lines = [
        typeof next.footerLine1 === 'string' ? next.footerLine1 : '',
        typeof next.footerLine2 === 'string' ? next.footerLine2 : '',
        typeof next.footerLine3 === 'string' ? next.footerLine3 : '',
      ].map((s) => s.trim()).filter(Boolean);

      if (lines.length > 0) next.footerLines = lines;
    }

    // Avoid storing legacy fields (keep single source of truth)
    delete next.footerLine1;
    delete next.footerLine2;
    delete next.footerLine3;

    return next;
  }

  private hydrateReceiptSettings(data: Record<string, unknown>): Record<string, unknown> {
    // Add footerLine1..3 for UI compatibility when only footerLines exists
    const next: Record<string, unknown> = { ...data };
    const lines = Array.isArray(next.footerLines)
      ? (next.footerLines as unknown[]).map((v) => String(v ?? ''))
      : [];

    if (next.footerLine1 === undefined) next.footerLine1 = lines[0] ?? '';
    if (next.footerLine2 === undefined) next.footerLine2 = lines[1] ?? '';
    if (next.footerLine3 === undefined) next.footerLine3 = lines[2] ?? '';

    return next;
  }

  async getGroup(group: string): Promise<Record<string, unknown>> {
    const row = await this.getRow();
    const columnMap: Record<string, keyof StoreSettings> = {
      general: 'general',
      receipt: 'receipt',
      printer: 'printer',
      'roles-perms': 'rolesPerms',
      inventory: 'inventory',
      pricing: 'pricing',
      shipping: 'shipping',
      notifications: 'notifications',
      ai: 'ai',
      security: 'security',
      analytics: 'analytics',
      system: 'systemCfg',
    };
    const col = columnMap[group];
    if (!col) throw new NotFoundException(`Unknown settings group: ${group}`);
    const data = (row[col] as Record<string, unknown>) ?? {};
    const hydrated = group === 'receipt' ? this.hydrateReceiptSettings(data) : data;
    return this.maskFields(group, hydrated);
  }

  async updateGroup(group: string, incoming: Record<string, unknown>): Promise<Record<string, unknown>> {
    const row = await this.getRow();
    const columnMap: Record<string, keyof StoreSettings> = {
      general: 'general',
      receipt: 'receipt',
      printer: 'printer',
      'roles-perms': 'rolesPerms',
      inventory: 'inventory',
      pricing: 'pricing',
      shipping: 'shipping',
      notifications: 'notifications',
      ai: 'ai',
      security: 'security',
      analytics: 'analytics',
      system: 'systemCfg',
    };
    const col = columnMap[group];
    if (!col) throw new NotFoundException(`Unknown settings group: ${group}`);

    const existing = (row[col] as Record<string, unknown>) ?? {};

    // Preserve masked fields when sentinel is sent
    const fields = MASKED_FIELDS[group] ?? [];
    for (const f of fields) {
      if (incoming[f] === UNCHANGED || incoming[f] === MASKED) {
        incoming[f] = existing[f] ?? undefined;
        if (incoming[f] === undefined) delete incoming[f];
      }
    }

    const normalizedIncoming = group === 'receipt'
      ? this.normalizeReceiptSettings(incoming)
      : incoming;

    const merged = { ...existing, ...normalizedIncoming };
    (row as any)[col] = merged;
    await this.settingsRepo.save(row);

    const hydrated = group === 'receipt' ? this.hydrateReceiptSettings(merged) : merged;
    return this.maskFields(group, hydrated);
  }

  // Warehouses CRUD
  async listWarehouses(): Promise<Warehouse[]> {
    return this.warehouseRepo.find({ where: { storeId: STORE_ID }, order: { isDefault: 'DESC', name: 'ASC' } });
  }

  async createWarehouse(dto: Partial<Warehouse>): Promise<Warehouse> {
    const wh = this.warehouseRepo.create({ ...dto, storeId: STORE_ID });
    if (wh.isDefault) {
      await this.warehouseRepo.update({ storeId: STORE_ID }, { isDefault: false });
    }
    return this.warehouseRepo.save(wh);
  }

  async updateWarehouse(id: string, dto: Partial<Warehouse>): Promise<Warehouse> {
    const wh = await this.warehouseRepo.findOne({ where: { id, storeId: STORE_ID } });
    if (!wh) throw new NotFoundException('ไม่พบคลังสินค้า');
    if (dto.isDefault) {
      await this.warehouseRepo.update({ storeId: STORE_ID }, { isDefault: false });
    }
    Object.assign(wh, dto);
    return this.warehouseRepo.save(wh);
  }

  async deleteWarehouse(id: string): Promise<void> {
    const wh = await this.warehouseRepo.findOne({ where: { id, storeId: STORE_ID } });
    if (!wh) throw new NotFoundException('ไม่พบคลังสินค้า');
    const total = await this.warehouseRepo.count({ where: { storeId: STORE_ID, isActive: true } });
    if (total <= 1 && wh.isActive) {
      throw new BadRequestException('ต้องมีคลังสินค้าที่ใช้งานอยู่อย่างน้อย 1 แห่ง');
    }
    await this.warehouseRepo.remove(wh);
  }

  async clearCache(): Promise<void> {
    // No in-process cache; this is a hook for future cache invalidation
  }

  async getSystemInfo(): Promise<Record<string, unknown>> {
    const base = await this.getGroup('system');
    return { ...base, appVersion: process.env.APP_VERSION ?? '1.0.0' };
  }
}
