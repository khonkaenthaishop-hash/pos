import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CashierSessionsService } from './cashier-sessions.service';
import { CashierSession, SessionStatus } from './cashier-session.entity';

const TODAY = new Date().toISOString().slice(0, 10);

const makeSession = (overrides: Partial<CashierSession> = {}): CashierSession => ({
  id: 'sess-uuid-1',
  date: TODAY,
  cashierId: 'cashier-uuid-1',
  cashier: null as any,
  openingAmount: 500,
  closingAmount: null as any,
  status: SessionStatus.OPEN,
  openedAt: new Date(),
  closedAt: null as any,
  note: null as any,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

describe('CashierSessionsService', () => {
  let service: CashierSessionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashierSessionsService,
        { provide: getRepositoryToken(CashierSession), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<CashierSessionsService>(CashierSessionsService);
    jest.clearAllMocks();
  });

  // ─── openSession ───────────────────────────────────────────────
  describe('openSession', () => {
    it('creates and returns a new session', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const session = makeSession();
      mockRepo.create.mockReturnValue(session);
      mockRepo.save.mockResolvedValue(session);

      const result = await service.openSession('cashier-uuid-1', { openingAmount: 500 });
      expect(result).toEqual(session);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cashierId: 'cashier-uuid-1', openingAmount: 500 }),
      );
    });

    it('throws ConflictException if session already exists today', async () => {
      mockRepo.findOne.mockResolvedValue(makeSession());
      await expect(service.openSession('cashier-uuid-1', { openingAmount: 500 }))
        .rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for negative opening amount', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.openSession('cashier-uuid-1', { openingAmount: -1 }))
        .rejects.toThrow(BadRequestException);
    });

    it('allows opening amount of 0', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const session = makeSession({ openingAmount: 0 });
      mockRepo.create.mockReturnValue(session);
      mockRepo.save.mockResolvedValue(session);

      await expect(service.openSession('cashier-uuid-1', { openingAmount: 0 }))
        .resolves.not.toThrow();
    });
  });

  // ─── getTodaySession ───────────────────────────────────────────
  describe('getTodaySession', () => {
    it('returns session when it exists', async () => {
      const session = makeSession();
      mockRepo.findOne.mockResolvedValue(session);

      const result = await service.getTodaySession('cashier-uuid-1');
      expect(result).toEqual(session);
    });

    it('returns null when no session today', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const result = await service.getTodaySession('cashier-uuid-1');
      expect(result).toBeNull();
    });
  });

  // ─── closeSession ──────────────────────────────────────────────
  describe('closeSession', () => {
    it('closes an open session', async () => {
      const session = makeSession();
      mockRepo.findOne.mockResolvedValue(session);
      const closed = { ...session, status: SessionStatus.CLOSED, closingAmount: 1200, closedAt: new Date() };
      mockRepo.save.mockResolvedValue(closed);

      const result = await service.closeSession('cashier-uuid-1', { closingAmount: 1200 });
      expect(result.status).toBe(SessionStatus.CLOSED);
      expect(result.closingAmount).toBe(1200);
    });

    it('throws NotFoundException when no session today', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.closeSession('cashier-uuid-1', { closingAmount: 500 }))
        .rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when session already closed', async () => {
      mockRepo.findOne.mockResolvedValue(makeSession({ status: SessionStatus.CLOSED }));
      await expect(service.closeSession('cashier-uuid-1', { closingAmount: 500 }))
        .rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for negative closing amount', async () => {
      mockRepo.findOne.mockResolvedValue(makeSession());
      await expect(service.closeSession('cashier-uuid-1', { closingAmount: -100 }))
        .rejects.toThrow(BadRequestException);
    });
  });
});
