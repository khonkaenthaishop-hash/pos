import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomersController, CustomersService } from './customers.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Customer } from './customer.entity';

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
  increment: jest.fn(),
};

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        CustomersService,
        { provide: getRepositoryToken(Customer), useValue: mockRepo },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
    service = module.get<CustomersService>(CustomersService);
    jest.clearAllMocks();
  });

  // ─── GET /customers ──────────────────────────────────────────────
  describe('GET /customers', () => {
    it('returns list when no search', async () => {
      const customers = [{ id: 'c1', name: 'John' }];
      mockRepo.find.mockResolvedValue(customers);

      const result = await controller.findAll();
      expect(result).toEqual(customers);
    });

    it('uses query builder when search is provided', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'c2', name: 'Jane' }]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await controller.findAll('Jane');
      expect(result).toEqual([{ id: 'c2', name: 'Jane' }]);
    });
  });

  // ─── POST /customers ─────────────────────────────────────────────
  describe('POST /customers', () => {
    it('creates and returns customer', async () => {
      const dto = { name: 'Alice', phone: '0812345678' };
      const created = { id: 'c3', ...dto };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);

      const result = await controller.create(dto as any);
      expect(result).toEqual(created);
    });
  });

  // ─── GET /customers/:id ──────────────────────────────────────────
  describe('GET /customers/:id', () => {
    it('returns customer when found', async () => {
      const customer = { id: 'c1', name: 'Bob' };
      mockRepo.findOne.mockResolvedValue(customer);

      const result = await controller.findOne('c1');
      expect(result).toEqual(customer);
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(controller.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
