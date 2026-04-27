import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HeldOrdersService } from './held-orders.service';
import { HeldOrder } from './held-order.entity';

const cartItem = {
  productId: 'prod-uuid-1',
  productNameTh: 'ข้าวสาร',
  unitPrice: 50,
  quantity: 2,
  itemDiscount: 0,
};

const makeHeld = (overrides: Partial<HeldOrder> = {}): HeldOrder => ({
  id: 'held-uuid-1',
  label: 'บิล 1',
  cashierId: 'cashier-uuid-1',
  cashier: null as any,
  customerId: null as any,
  customer: null as any,
  customerName: null as any,
  cart: [cartItem],
  discount: 0 as any,
  note: null as any,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
  ...overrides,
});

// Minimal QueryBuilder mock
const mockQb = {
  orderBy: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQb),
};

describe('HeldOrdersService', () => {
  let service: HeldOrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeldOrdersService,
        { provide: getRepositoryToken(HeldOrder), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<HeldOrdersService>(HeldOrdersService);
    jest.clearAllMocks();
    // reset qb mock chain
    mockQb.orderBy.mockReturnThis();
    mockQb.where.mockReturnThis();
  });

  // ─── hold ────────────────────────────────────────────────────────
  describe('hold', () => {
    it('creates and saves a held order', async () => {
      const entity = makeHeld();
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      const result = await service.hold(
        { label: 'บิล 1', cart: [cartItem], discount: 0 },
        'cashier-uuid-1',
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cashierId: 'cashier-uuid-1', cart: [cartItem] }),
      );
      expect(result).toEqual(entity);
    });

    it('stores customerName when customerId is absent', async () => {
      const entity = makeHeld({ customerName: 'สมชาย', customerId: null as any });
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue(entity);

      await service.hold(
        { cart: [cartItem], customerName: 'สมชาย' },
        'cashier-uuid-1',
      );
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ customerName: 'สมชาย', customerId: null }),
      );
    });
  });

  // ─── list ────────────────────────────────────────────────────────
  describe('list', () => {
    it('returns summaries without cart JSON', async () => {
      mockQb.getMany.mockResolvedValue([makeHeld()]);

      const result = await service.list();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'held-uuid-1',
        label: 'บิล 1',
        itemCount: 1,
        totalQty: 2,
        discount: 0,
      });
      // Should NOT include cart array in summary
      expect((result[0] as unknown as Record<string, unknown>).cart).toBeUndefined();
    });

    it('filters by cashierId when provided', async () => {
      mockQb.getMany.mockResolvedValue([]);
      await service.list('cashier-uuid-1');
      expect(mockQb.where).toHaveBeenCalledWith(
        'h.cashier_id = :cashierId',
        { cashierId: 'cashier-uuid-1' },
      );
    });

    it('does not filter when cashierId is omitted', async () => {
      mockQb.getMany.mockResolvedValue([]);
      await service.list();
      expect(mockQb.where).not.toHaveBeenCalled();
    });
  });

  // ─── getById ─────────────────────────────────────────────────────
  describe('getById', () => {
    it('returns held order when found', async () => {
      const entity = makeHeld();
      mockRepo.findOne.mockResolvedValue(entity);

      const result = await service.getById('held-uuid-1');
      expect(result).toEqual(entity);
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.getById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── resume ──────────────────────────────────────────────────────
  describe('resume', () => {
    it('returns the held order then deletes it', async () => {
      const entity = makeHeld();
      mockRepo.findOne.mockResolvedValue(entity);
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.resume('held-uuid-1');
      expect(result).toEqual(entity);
      expect(mockRepo.delete).toHaveBeenCalledWith('held-uuid-1');
    });

    it('throws NotFoundException when held order does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.resume('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── discard ─────────────────────────────────────────────────────
  describe('discard', () => {
    it('deletes held order successfully', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.discard('held-uuid-1')).resolves.not.toThrow();
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.discard('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── label fallback ──────────────────────────────────────────────
  describe('label fallback', () => {
    it('uses last 4 chars of id when label is null', async () => {
      mockQb.getMany.mockResolvedValue([makeHeld({ label: null as any })]);
      const result = await service.list();
      expect(result[0].label).toMatch(/^บิล /);
      expect(result[0].label).toContain('1'); // id ends in ...-1
    });
  });
});
