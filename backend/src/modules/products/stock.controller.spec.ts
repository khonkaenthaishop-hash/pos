import { Test, TestingModule } from '@nestjs/testing';
import { StockController } from './stock.controller';
import { ProductsService } from './products.service';

const mockProductsService = {
  findAll: jest.fn(),
};

describe('StockController', () => {
  let controller: StockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    }).compile();

    controller = module.get<StockController>(StockController);
    jest.clearAllMocks();
  });

  // ─── GET /stock ───────────────────────────────────────────────────
  describe('GET /stock', () => {
    it('returns all products without filters', async () => {
      const products = [{ id: 'p1', nameTh: 'ข้าว', currentStock: 10 }];
      mockProductsService.findAll.mockResolvedValue(products);

      const result = await controller.getStock();
      expect(result).toEqual(products);
      expect(mockProductsService.findAll).toHaveBeenCalledWith({
        search: undefined,
        categoryId: undefined,
        lowStock: false,
      });
    });

    it('passes lowStock=true filter', async () => {
      mockProductsService.findAll.mockResolvedValue([]);
      await controller.getStock(undefined, undefined, 'true');
      expect(mockProductsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ lowStock: true }),
      );
    });

    it('passes search and categoryId filters', async () => {
      mockProductsService.findAll.mockResolvedValue([]);
      await controller.getStock('ข้าว', 'cat-uuid-1');
      expect(mockProductsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'ข้าว', categoryId: 'cat-uuid-1' }),
      );
    });
  });
});
