import { Test, TestingModule } from '@nestjs/testing';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

const mockLocationsService = {
  listLocations: jest.fn(),
  getProductLocations: jest.fn(),
  updateProductLocations: jest.fn(),
};

describe('LocationsController', () => {
  let controller: LocationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [{ provide: LocationsService, useValue: mockLocationsService }],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
    jest.clearAllMocks();
  });

  // ─── GET /products/:id/locations ──────────────────────────────────
  describe('GET /products/:id/locations', () => {
    it('returns location stock for a product', async () => {
      const locs = [{ locationId: 1, fullCode: 'A-01-01', quantity: 5, priority: 1 }];
      mockLocationsService.getProductLocations.mockResolvedValue(locs);

      const result = await controller.getProductLocations('prod-uuid');
      expect(result).toEqual(locs);
      expect(mockLocationsService.getProductLocations).toHaveBeenCalledWith('prod-uuid');
    });
  });

  // ─── GET /locations ───────────────────────────────────────────────
  describe('GET /locations', () => {
    it('returns all active locations', async () => {
      const locations = [{ id: 1, fullCode: 'A-01-01' }];
      mockLocationsService.listLocations.mockResolvedValue(locations);

      const result = await controller.listLocations();
      expect(result).toEqual(locations);
    });
  });
});
