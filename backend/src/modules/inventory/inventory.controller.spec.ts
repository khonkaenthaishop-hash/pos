import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

const mockInventoryService = {
  receive: jest.fn(),
  adjust: jest.fn(),
  discard: jest.fn(),
  listTransactions: jest.fn(),
  discardSummary: jest.fn(),
  getReasonCodes: jest.fn(),
  listSuppliers: jest.fn(),
  getSupplier: jest.fn(),
  createSupplier: jest.fn(),
  updateSupplier: jest.fn(),
};

const mockUser = { id: 'user-uuid-001', role: 'manager' };

describe('InventoryController', () => {
  let controller: InventoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: mockInventoryService }],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
    jest.clearAllMocks();
  });

  // ─── POST /inventory/receive ─────────────────────────────────────
  describe('POST /inventory/receive', () => {
    const dto = { productId: 'prod-uuid', quantity: 10 };

    it('calls service.receive and returns transaction', async () => {
      const txn = { id: 'txn-1', transactionType: 'IN', quantity: 10 };
      mockInventoryService.receive.mockResolvedValue(txn);

      const result = await controller.receive(dto as any, mockUser);
      expect(result).toEqual(txn);
      expect(mockInventoryService.receive).toHaveBeenCalledWith(dto, mockUser.id);
    });

    it('propagates NotFoundException when product not found', async () => {
      mockInventoryService.receive.mockRejectedValue(new NotFoundException('ไม่พบสินค้า'));
      await expect(controller.receive(dto as any, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('propagates BadRequestException for zero quantity', async () => {
      mockInventoryService.receive.mockRejectedValue(
        new BadRequestException('จำนวนต้องมากกว่า 0'),
      );
      await expect(controller.receive({ ...dto, quantity: 0 } as any, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── POST /inventory/adjust ──────────────────────────────────────
  describe('POST /inventory/adjust', () => {
    const dto = { productId: 'prod-uuid', physicalCount: 15 };

    it('calls service.adjust and returns transaction', async () => {
      const txn = { id: 'txn-2', transactionType: 'ADJUST', quantity: 5 };
      mockInventoryService.adjust.mockResolvedValue(txn);

      const result = await controller.adjust(dto as any, mockUser);
      expect(result).toEqual(txn);
      expect(mockInventoryService.adjust).toHaveBeenCalledWith(dto, mockUser.id);
    });

    it('propagates BadRequestException when stock unchanged', async () => {
      mockInventoryService.adjust.mockRejectedValue(
        new BadRequestException('ยอดไม่ต่างจากในระบบ ไม่ต้องปรับ'),
      );
      await expect(controller.adjust(dto as any, mockUser)).rejects.toThrow(BadRequestException);
    });
  });
});
