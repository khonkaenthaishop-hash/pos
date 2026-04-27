import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Order,
  OrderItem,
  OrderType,
  OrderStatus,
  PaymentMethod,
} from './order.entity';
import { Product } from '../products/product.entity';
import { ProductsService } from '../products/products.service';
import { LocationsService } from '../products/locations.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { CashierSession } from '../cashier-sessions/cashier-session.entity';

// ─── DTOs ──────────────────────────────────────────────────────
export interface CreateOrderItemDto {
  productId?: string;
  productNameTh: string;
  productNameZh?: string;
  productNameEn?: string;
  unitPrice: number;
  quantity: number;
  itemDiscount?: number;
  isQuickItem?: boolean;
  note?: string;
}

export interface CreatePosOrderDto {
  items: CreateOrderItemDto[];
  customerId?: string;
  customerName?: string;
  discount?: number;
  paymentMethod?: PaymentMethod;
  note?: string;
}

export interface CreateOnlineOrderDto {
  items: CreateOrderItemDto[];
  customerId?: string;
  customerName?: string;
  orderNickname?: string;
  carrier?: string;
  temperature?: string;
  packageSize?: string;
  shippingFee: number;
  paymentMethod: PaymentMethod;
  note?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private itemsRepo: Repository<OrderItem>,
    @InjectRepository(CashierSession)
    private sessionsRepo: Repository<CashierSession>,
    private productsService: ProductsService,
    private locationsService: LocationsService,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  // ─── Generate Order Number ─────────────────────────────────────
  private async generateOrderNo(type: OrderType): Promise<string> {
    const prefix = type === OrderType.POS ? 'POS' : 'ONL';
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const timestamp = now.getTime().toString().slice(-4);
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${date}-${timestamp}${randomSuffix}`;
  }

  // ─── Create POS Order ──────────────────────────────────────────
  async createPosOrder(dto: CreatePosOrderDto, cashierId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const orderNo = await this.generateOrderNo(OrderType.POS);

      // Validate items
      if (!dto.items || dto.items.length === 0) {
        throw new BadRequestException('ต้องมีสินค้าอย่างน้อย 1 รายการ');
      }

      const subtotal = dto.items.reduce((s, i) => {
        const lineDiscount = i.itemDiscount || 0;
        return s + i.unitPrice * i.quantity - lineDiscount;
      }, 0);

      if (subtotal < 0) {
        throw new BadRequestException('ยอดรวมสินค้าติดลบ กรุณาตรวจสอบส่วนลดรายการ');
      }

      const discountAmount = dto.discount || 0;
      const totalAmount = subtotal - discountAmount;

      if (totalAmount < 0) {
        throw new BadRequestException('ยอดรวมติดลบ กรุณาตรวจสอบส่วนลด');
      }

      // Fetch product details for cost price snapshot
      const productIds = dto.items
        .filter((i) => i.productId && !i.isQuickItem)
        .map((i) => i.productId as string);
      const products = await manager.find(Product, { where: productIds.map((id) => ({ id })) });
      const productMap = new Map(products.map((p) => [p.id, p]));

      const order = manager.create(Order, {
        orderNo,
        type: OrderType.POS,
        status: OrderStatus.CONFIRMED,
        customerId: dto.customerId,
        customerName: dto.customerName,
        subtotal,
        discount: discountAmount,
        totalAmount,
        paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
        isPaid: true,
        paidAt: new Date(),
        cashierId,
        note: dto.note,
        items: dto.items.map((i) => {
          const product = i.productId ? productMap.get(i.productId) : null;
          return manager.create(OrderItem, {
            productId: i.productId,
            productNameTh: i.productNameTh,
            productNameZh: i.productNameZh,
            productNameEn: i.productNameEn,
            unitPrice: i.unitPrice,
            costPrice: product ? Number(product.costPrice) : 0,
            quantity: i.quantity,
            itemDiscount: i.itemDiscount || 0,
            subtotal: i.unitPrice * i.quantity - (i.itemDiscount || 0),
            isQuickItem: i.isQuickItem || false,
            note: i.note,
          });
        }),
      });

      const saved = await manager.save(Order, order);

      // Deduct stock (multi-location) for tracked products
      for (const item of dto.items) {
        if (item.productId && !item.isQuickItem) {
          await this.locationsService.deductStockMultiLocation(
            item.productId,
            item.quantity,
            manager,
            cashierId,
          );
        }
      }

      await this.auditService.log({
        userId: cashierId,
        action: AuditAction.ORDER_CREATE,
        targetTable: 'orders',
        targetId: saved.id,
        newValue: { orderNo, totalAmount, itemCount: dto.items.length },
      });

      return saved;
    });
  }

  // ─── X-Report — reads from DB (not in-memory) ─────────────────
  async getXReport(date: string, cashierId: string) {
    const d = new Date(date);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);

    const orders = await this.ordersRepo
      .createQueryBuilder('o')
      .where('o.created_at >= :start', { start })
      .andWhere('o.created_at <= :end', { end })
      .andWhere('o.status != :c', { c: OrderStatus.CANCELLED })
      .andWhere('o.type = :type', { type: OrderType.POS })
      .getMany();

    // Read opening amount from the cashier_sessions table (persisted in DB)
    const session = await this.sessionsRepo.findOne({
      where: { cashierId, date },
    });

    const byMethod: Record<string, number> = { cash: 0, qr: 0, transfer: 0, cod: 0, debt: 0 };
    let totalOrders = 0;
    let totalRevenue = 0;

    for (const o of orders) {
      totalOrders++;
      const amt = Number(o.totalAmount);
      totalRevenue += amt;
      byMethod[o.paymentMethod] = (byMethod[o.paymentMethod] || 0) + amt;
    }

    return {
      date,
      openingCash: session ? Number(session.openingAmount) : 0,
      closingCash: session?.closingAmount ? Number(session.closingAmount) : null,
      sessionStatus: session?.status || null,
      totalOrders,
      totalRevenue,
      byMethod,
    };
  }

  async getZReport(date: string, cashierId: string) {
    const session = await this.sessionsRepo.findOne({ where: { cashierId, date } });
    if (!session) {
      throw new NotFoundException('ไม่พบ Cashier Session สำหรับวันนี้');
    }
    if (session.status !== 'closed') {
      throw new BadRequestException('ต้องปิด Cashier Session ก่อนออก Z-Report');
    }
    const report = await this.getXReport(date, cashierId);
    return {
      ...report,
      closed: true,
      closedAt: session.closedAt,
      closingCash: Number(session.closingAmount),
    };
  }

  // ─── Upload Slip (note field used as slip reference since DB has no slip_url) ──
  async saveSlipUrl(orderId: string, slipUrl: string): Promise<Order> {
    const order = await this.findById(orderId);
    order.note = slipUrl;
    return this.ordersRepo.save(order);
  }

  // ─── Return / Refund Order ─────────────────────────────────────
  // Accepts either the UUID (id) or the human-readable orderNo
  async returnOrder(orderIdentifier: string, reason: string, userId: string): Promise<Order> {
    // Try UUID lookup first, then fall back to orderNo
    let order = await this.ordersRepo.findOne({
      where: { id: orderIdentifier },
      relations: ['items'],
    });

    if (!order) {
      order = await this.ordersRepo.findOne({
        where: { orderNo: orderIdentifier },
        relations: ['items'],
      });
    }

    if (!order) throw new NotFoundException('ไม่พบออร์เดอร์');

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('ออร์เดอร์ถูกยกเลิกแล้ว');
    }

    await this.dataSource.transaction(async (manager) => {
      // Restore stock for each item
      for (const item of order!.items) {
        if (item.productId && !item.isQuickItem) {
          await this.productsService.adjustStock(
            item.productId,
            item.quantity, // positive = add back
            `คืนสินค้า #${order!.orderNo}`,
            userId,
          );
        }
      }

      await manager.update(Order, order!.id, {
        status: OrderStatus.CANCELLED,
        cancelReason: reason,
        isPaid: false, // Mark as unpaid after return
      });
    });

    await this.auditService.log({
      userId,
      action: AuditAction.ORDER_RETURN,
      targetTable: 'orders',
      targetId: order.id,
      oldValue: { status: order.status, isPaid: order.isPaid },
      newValue: { status: OrderStatus.CANCELLED, isReturn: true },
      reason,
    });

    return this.findById(order.id);
  }

  // ─── Create Online Order ───────────────────────────────────────
  async createOnlineOrder(dto: CreateOnlineOrderDto, adminId: string): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const orderNo = await this.generateOrderNo(OrderType.ONLINE);
      const subtotal = dto.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const totalAmount = subtotal + dto.shippingFee;

      if (totalAmount < 0 || dto.shippingFee < 0) {
        throw new BadRequestException('ยอดรวมหรือค่าส่งไม่ถูกต้อง');
      }

      const productIds = dto.items
        .filter((i) => i.productId && !i.isQuickItem)
        .map((i) => i.productId as string);
      const products = await manager.find(Product, { where: productIds.map((id) => ({ id })) });
      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const item of dto.items) {
        if (item.productId && !item.isQuickItem) {
          await this.productsService.reserveStock(item.productId, item.quantity);
        }
      }

      const order = manager.create(Order, {
        orderNo,
        type: OrderType.ONLINE,
        status: OrderStatus.PENDING,
        customerId: dto.customerId,
        customerName: dto.customerName,
        orderNickname: dto.orderNickname,
        subtotal,
        shippingFee: dto.shippingFee,
        totalAmount,
        paymentMethod: dto.paymentMethod,
        carrier: dto.carrier as any,
        temperature: (dto.temperature as any) || 'normal',
        packageSize: dto.packageSize as any,
        cashierId: adminId,
        note: dto.note,
        items: dto.items.map((i) => {
          const product = i.productId ? productMap.get(i.productId) : null;
          return manager.create(OrderItem, {
            productId: i.productId,
            productNameTh: i.productNameTh,
            productNameZh: i.productNameZh,
            productNameEn: i.productNameEn,
            unitPrice: i.unitPrice,
            costPrice: product ? Number(product.costPrice) : 0,
            quantity: i.quantity,
            subtotal: i.unitPrice * i.quantity,
            isQuickItem: i.isQuickItem || false,
            note: i.note,
          });
        }),
      });

      const saved = await manager.save(Order, order);

      await this.auditService.log({
        userId: adminId,
        action: AuditAction.ORDER_CREATE,
        targetTable: 'orders',
        targetId: saved.id,
        newValue: { orderNo, type: 'online', totalAmount, carrier: dto.carrier },
      });

      return saved;
    });
  }

  // ─── Cancel Order ──────────────────────────────────────────────
  async cancelOrder(id: string, reason: string, userId: string): Promise<Order> {
    const order = await this.findById(id);
    if ([OrderStatus.SHIPPED, OrderStatus.DELIVERED].includes(order.status)) {
      throw new BadRequestException('ไม่สามารถยกเลิกออร์เดอร์ที่ส่งแล้ว');
    }

    const oldStatus = order.status;
    order.status = OrderStatus.CANCELLED;
    order.cancelReason = reason;
    order.isPaid = false; // FIX: reset isPaid on cancel (DATA-07)
    await this.ordersRepo.save(order);

    // Restore stock
    for (const item of order.items) {
      if (item.productId && !item.isQuickItem) {
        if (order.type === OrderType.ONLINE && oldStatus === OrderStatus.PENDING) {
          await this.productsService.releaseReserved(item.productId, item.quantity);
        } else if (order.type === OrderType.POS) {
          await this.productsService.adjustStock(
            item.productId,
            item.quantity,
            `คืน stock จากยกเลิก ${order.orderNo}`,
            userId,
          );
        }
      }
    }

    await this.auditService.log({
      userId,
      action: AuditAction.ORDER_CANCEL,
      targetTable: 'orders',
      targetId: id,
      oldValue: { status: oldStatus },
      newValue: { status: OrderStatus.CANCELLED },
      reason,
    });

    return order;
  }

  // ─── Update Status ─────────────────────────────────────────────
  async updateStatus(id: string, status: OrderStatus, userId: string): Promise<Order> {
    const order = await this.findById(id);
    order.status = status;

    if (status === OrderStatus.SHIPPED && order.type === OrderType.ONLINE) {
      await this.dataSource.transaction(async (manager) => {
        for (const item of order.items) {
          if (item.productId && !item.isQuickItem) {
            await this.locationsService.deductStockMultiLocation(
              item.productId,
              item.quantity,
              manager,
              userId,
            );
            await this.productsService.releaseReserved(item.productId, item.quantity);
          }
        }
      });
    }

    return this.ordersRepo.save(order);
  }

  // ─── Mark Item Checked ─────────────────────────────────────────
  async checkItem(orderId: string, itemId: string, packedById: string): Promise<OrderItem> {
    const item = await this.itemsRepo.findOne({ where: { id: itemId, orderId } });
    if (!item) throw new NotFoundException('ไม่พบรายการสินค้า');
    item.isChecked = true;
    const saved = await this.itemsRepo.save(item);
    await this.ordersRepo.update(orderId, { packedById });
    return saved;
  }

  // ─── Queries ───────────────────────────────────────────────────
  async findAll(filters?: {
    type?: OrderType;
    status?: OrderStatus;
    from?: Date;
    to?: Date;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.cashier', 'cashier')
      .orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters?.type) qb.andWhere('o.type = :type', { type: filters.type });
    if (filters?.status) qb.andWhere('o.status = :status', { status: filters.status });
    if (filters?.from) qb.andWhere('o.created_at >= :from', { from: filters.from });
    if (filters?.to) qb.andWhere('o.created_at <= :to', { to: filters.to });
    if (filters?.search) {
      qb.andWhere('(o.order_no ILIKE :s OR customer.name ILIKE :s)', {
        s: `%${filters.search}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: ['customer', 'cashier', 'packedBy', 'items'],
    });
    if (!order) throw new NotFoundException('ไม่พบออร์เดอร์');
    return order;
  }

  async findByOrderNo(orderNo: string): Promise<Order> {
    const order = await this.ordersRepo.findOne({
      where: { orderNo },
      relations: ['customer', 'cashier', 'items'],
    });
    if (!order) throw new NotFoundException('ไม่พบออร์เดอร์');
    return order;
  }

  async getTodaySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.ordersRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'totalOrders')
      .addSelect('SUM(o.total_amount)', 'totalRevenue')
      .addSelect('o.type', 'type')
      .where('o.created_at >= :today', { today })
      .andWhere('o.created_at < :tomorrow', { tomorrow })
      .andWhere('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .groupBy('o.type')
      .getRawMany();
  }
}
