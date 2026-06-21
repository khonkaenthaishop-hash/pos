import {
  Injectable, ConflictException, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CashierSession, SessionStatus } from './cashier-session.entity';

export interface OpenSessionDto {
  openingAmount: number;
  note?: string;
}

export interface CloseSessionDto {
  closingAmount: number;
  note?: string;
}

@Injectable()
export class CashierSessionsService {
  private readonly logger = new Logger(CashierSessionsService.name);

  constructor(
    @InjectRepository(CashierSession)
    private readonly repo: Repository<CashierSession>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Open a new cashier session for today.
   * Throws ConflictException if a session already exists for this cashier on this date.
   */
  async openSession(cashierId: string, dto: OpenSessionDto): Promise<CashierSession> {
    if (dto.openingAmount < 0) {
      throw new BadRequestException('ยอดเงินเปิดต้องไม่ติดลบ');
    }

    return this.dataSource.transaction(async (manager) => {
      const today = new Date().toISOString().slice(0, 10);

      // Pessimistic write lock — ป้องกัน race condition จาก concurrent requests
      const existing = await manager.findOne(CashierSession, {
        where: { cashierId, date: today },
        lock: { mode: 'pessimistic_write' },
      });

      if (existing) {
        throw new ConflictException({
          message: 'มีการเปิดแคชเชียร์แล้วสำหรับวันนี้',
          code: 'SESSION_ALREADY_OPEN',
          sessionId: existing.id,
          openingAmount: Number(existing.openingAmount),
          status: existing.status,
          openedAt: existing.openedAt,
        });
      }

      const session = manager.create(CashierSession, {
        cashierId,
        date: today,
        openingAmount: dto.openingAmount,
        status: SessionStatus.OPEN,
        openedAt: new Date(),
        note: dto.note,
      });

      const saved = await manager.save(CashierSession, session);
      this.logger.log(`Session opened: cashier=${cashierId} date=${today} amount=${dto.openingAmount}`);
      return saved;
    });
  }

  /**
   * Get today's session for a cashier.
   * Returns null if no session exists (frontend uses this to decide whether to show the modal).
   */
  async getTodaySession(cashierId: string): Promise<CashierSession | null> {
    const today = new Date().toISOString().slice(0, 10);
    return this.repo.findOne({
      where: { cashierId, date: today },
      relations: ['cashier'],
    });
  }

  /**
   * Close today's session.
   * Throws NotFoundException if no open session exists for today.
   */
  async closeSession(cashierId: string, dto: CloseSessionDto): Promise<CashierSession> {
    if (dto.closingAmount < 0) {
      throw new BadRequestException('ยอดเงินปิดต้องไม่ติดลบ');
    }

    return this.dataSource.transaction(async (manager) => {
      const today = new Date().toISOString().slice(0, 10);

      // Pessimistic write lock — ป้องกัน concurrent close requests
      const session = await manager.findOne(CashierSession, {
        where: { cashierId, date: today },
        lock: { mode: 'pessimistic_write' },
      });

      if (!session) {
        throw new NotFoundException('ไม่พบเซสชันที่เปิดอยู่สำหรับวันนี้');
      }
      if (session.status === SessionStatus.CLOSED) {
        throw new ConflictException({
          message: 'เซสชันนี้ปิดไปแล้ว',
          code: 'SESSION_ALREADY_CLOSED',
          closedAt: session.closedAt,
        });
      }

      session.closingAmount = dto.closingAmount;
      session.status = SessionStatus.CLOSED;
      session.closedAt = new Date();
      if (dto.note) session.note = dto.note;

      const saved = await manager.save(CashierSession, session);
      this.logger.log(`Session closed: cashier=${cashierId} date=${today} closing=${dto.closingAmount}`);
      return saved;
    });
  }

  /** List sessions for a date range (for reports / manager view). */
  async listSessions(from?: string, to?: string): Promise<CashierSession[]> {
    const qb = this.repo.createQueryBuilder('s')
      .leftJoinAndSelect('s.cashier', 'cashier')
      .orderBy('s.date', 'DESC')
      .addOrderBy('s.opened_at', 'DESC');

    if (from) qb.andWhere('s.date >= :from', { from });
    if (to)   qb.andWhere('s.date <= :to',   { to });

    return qb.getMany();
  }
}
