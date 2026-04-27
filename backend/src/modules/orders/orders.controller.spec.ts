import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderType, OrderStatus, PaymentMethod } from './order.entity';

const mockOrdersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  createPosOrder: jest.fn(),
  getOpeningCash: jest.fn(),
  setOpeningCash: jest.fn(),
  listHeldBills: jest.fn(),
  getTodaySummary: jest.fn(),
  getXReport: jest.fn(),
  getZReport: jest.fn(),
  holdBill: jest.fn(),
  resumeBill: jest.fn(),
  cancelOrder: jest.fn(),
  updateStatus: jest.fn(),
  returnOrder: jest.fn(),
  saveSlipUrl: jest.fn(),
  checkItem: jest.fn(),
  createOnlineOrder: jest.fn(),
};

const mockUser = { id: 'user-uuid-001', role: 'cashier' };

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    jest.clearAllMocks();
  });

  // ─── GET /orders ──────────────────────────────────────────────────
  describe('GET /orders', () => {
    it('returns list of orders', async () => {
      const orders = [{ id: '1', orderNo: 'POS-001' }];
      mockOrdersService.findAll.mockResolvedValue(orders);

      const result = await controller.findAll();
      expect(result).toEqual(orders);
      expect(mockOrdersService.findAll).toHaveBeenCalledWith({
        type: undefined, status: undefined, search: undefined,
        from: undefined, to: undefined,
      });
    });

    it('passes filters to service', async () => {
      mockOrdersService.findAll.mockResolvedValue([]);
      await controller.findAll(OrderType.POS, OrderStatus.CONFIRMED, 'search', '2024-01-01', '2024-12-31');
      expect(mockOrdersService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ type: OrderType.POS, status: OrderStatus.CONFIRMED }),
      );
    });
  });

  // ─── GET /orders/open-cash ─────────────────────────────────────────
  describe('GET /orders/open-cash', () => {
    it('returns opening cash record', () => {
      const record = { amount: 1000, date: '2024-01-01', userId: 'u1' };
      mockOrdersService.getOpeningCash.mockReturnValue(record);

      const result = controller.getOpenCash('2024-01-01');
      expect(result).toEqual(record);
    });

    it('returns null when no record exists', () => {
      mockOrdersService.getOpeningCash.mockReturnValue(null);
      const result = controller.getOpenCash('2024-01-01');
      expect(result).toBeNull();
    });
  });

  // ─── POST /orders/pos ─────────────────────────────────────────────
  describe('POST /orders/pos', () => {
    const dto = {
      items: [{ productNameTh: 'ข้าว', unitPrice: 50, quantity: 2 }],
      paymentMethod: PaymentMethod.CASH,
    };

    it('creates a POS order and returns it', async () => {
      const order = { id: 'ord-1', orderNo: 'POS-20240101-0001', totalAmount: 100 };
      mockOrdersService.createPosOrder.mockResolvedValue(order);

      const result = await controller.createPos(dto as any, mockUser);
      expect(result).toEqual(order);
      expect(mockOrdersService.createPosOrder).toHaveBeenCalledWith(dto, mockUser.id);
    });

    it('propagates BadRequestException from service (debt without customer)', async () => {
      mockOrdersService.createPosOrder.mockRejectedValue(
        new BadRequestException('บิลเชื่อต้องระบุลูกค้า'),
      );
      await expect(controller.createPos(dto as any, mockUser)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── GET /orders/:id ─────────────────────────────────────────────
  describe('GET /orders/:id', () => {
    it('returns order by id', async () => {
      const order = { id: 'ord-1' };
      mockOrdersService.findById.mockResolvedValue(order);

      const result = await controller.findOne('ord-1');
      expect(result).toEqual(order);
    });

    it('propagates NotFoundException when order not found', async () => {
      mockOrdersService.findById.mockRejectedValue(new NotFoundException('ไม่พบออร์เดอร์'));
      await expect(controller.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
