// audit.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from './audit-log.entity';

interface LogParams {
  userId: string;
  action: AuditAction;
  targetTable?: string;
  targetId?: string;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  ipAddress?: string;
  deviceInfo?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepo: Repository<AuditLog>,
  ) {}

  async log(params: LogParams): Promise<AuditLog> {
    const log = this.auditRepo.create(params);
    return this.auditRepo.save(log);
  }

  async findAll(filters?: {
    userId?: string;
    action?: AuditAction;
    targetTable?: string;
    targetId?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const page  = Math.max(1, filters?.page  ?? 1);
    const limit = Math.min(200, Math.max(1, filters?.limit ?? 100));
    const skip  = (page - 1) * limit;

    const qb = this.auditRepo.createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'user')
      .orderBy('a.createdAt', 'DESC');

    if (filters?.userId) qb.andWhere('a.user_id = :uid', { uid: filters.userId });
    if (filters?.action) qb.andWhere('a.action = :action', { action: filters.action });
    if (filters?.targetTable) qb.andWhere('a.target_table = :t', { t: filters.targetTable });
    if (filters?.targetId) qb.andWhere('a.target_id = :id', { id: filters.targetId });
    if (filters?.from) qb.andWhere('a.created_at >= :from', { from: filters.from });
    if (filters?.to) qb.andWhere('a.created_at <= :to', { to: filters.to });

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getSummary(userId?: string) {
    const qb = this.auditRepo.createQueryBuilder('a')
      .select('a.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('a.action');
    if (userId) qb.where('a.user_id = :uid', { uid: userId });
    return qb.getRawMany();
  }
}
