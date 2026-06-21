import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ShippingEmail, MatchStatus } from './shipping-email.entity';
import { ShippingTracking, TrackingHistoryEntry } from './shipping-tracking.entity';
import { GmailService } from './gmail.service';
import { ShippingEmailParserService } from './shipping-email-parser.service';
import { Order, OrderStatus, OrderType } from '../orders/order.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-log.entity';
import { OrdersService } from '../orders/orders.service';

// ─── DTOs ──────────────────────────────────────────────────────────────
export interface ShippingDashboardDto {
  emailId: string;
  matchedOrderId: string | null;
  orderNo: string | null;
  customerName: string | null;
  cNumber: string | null;
  emailType: string;
  posTotal: number | null;
  emailTotal: number | null;
  amountMismatch: { email_total: number; pos_total: number; diff: number } | null;
  adminConfirmed: boolean;
}

// ─── Email type → Order status mapping ────────────────────────────────
const EMAIL_TYPE_TO_ORDER_STATUS: Record<string, OrderStatus | null> = {
  created: null,
  shipped: OrderStatus.SHIPPED,
  arrived: OrderStatus.DELIVERED,
  completed: OrderStatus.CLAIMED,
  cancelled: OrderStatus.CANCELLED,
  warning: null,
  returned: OrderStatus.RETURNED,
};

// System user ID for automated audit logs.
// This matches the "system" service-account inserted by migration 009_add_system_user.sql.
// Override via GMAIL_SYSTEM_USER_ID env var if needed.
const SYSTEM_USER_ID =
  process.env.GMAIL_SYSTEM_USER_ID ?? '00000000-0000-0000-0000-000000000001';

@Injectable()
export class ShippingSyncService {
  private readonly logger = new Logger(ShippingSyncService.name);

  constructor(
    @InjectRepository(ShippingEmail)
    private emailRepo: Repository<ShippingEmail>,
    @InjectRepository(ShippingTracking)
    private trackingRepo: Repository<ShippingTracking>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    private gmailService: GmailService,
    private parserService: ShippingEmailParserService,
    private auditService: AuditService,
    private ordersService: OrdersService,
    private dataSource: DataSource,
  ) {}

  // ─── Scheduled sync every 15 minutes ───────────────────────────────
  @Cron('0 */15 * * * *')
  async syncEmails(): Promise<void> {
    this.logger.log('Starting scheduled Gmail sync...');
    try {
      const result = await this.triggerManualSync();
      this.logger.log(
        `Sync complete — processed: ${result.processed}, matched: ${result.matched}, errors: ${result.errors}`,
      );
    } catch (err) {
      this.logger.error(`Scheduled sync failed: ${err}`);
    }
  }

  // ─── Manual sync trigger ────────────────────────────────────────────
  async triggerManualSync(): Promise<{ processed: number; matched: number; errors: number }> {
    const status = await this.gmailService.getConnectionStatus();
    if (!status.connected) {
      throw new BadRequestException('Gmail is not connected');
    }

    const messages = await this.gmailService.fetchNewEmails();
    let processed = 0;
    let matched = 0;
    let errors = 0;

    for (const msg of messages) {
      try {
        const wasMatched = await this.processEmail(msg);
        processed++;
        if (wasMatched) matched++;
      } catch (err) {
        this.logger.error(`Error processing email ${msg.id}: ${err}`);
        errors++;

        // Mark existing record as error if it was already saved
        const existing = await this.emailRepo.findOne({ where: { gmailMessageId: msg.id } });
        if (existing && existing.processStatus === 'pending') {
          await this.emailRepo.update(existing.id, {
            processStatus: 'error',
            processError: String(err),
            processedAt: new Date(),
          });
        }
      }
    }

    return { processed, matched, errors };
  }

  // ─── Process a single Gmail message ────────────────────────────────
  private async processEmail(msg: {
    id: string;
    subject: string;
    body: string;
    receivedAt: Date;
  }): Promise<boolean> {
    // Idempotency — skip if already processed
    const existing = await this.emailRepo.findOne({ where: { gmailMessageId: msg.id } });
    if (existing) {
      this.logger.debug(`Skipping already-processed email ${msg.id}`);
      return existing.matchStatus === 'matched' || existing.matchStatus === 'manual';
    }

    // Parse email
    const parsed = this.parserService.parse(msg.subject, msg.body);

    // Save to shipping_emails as pending
    const shippingEmail = this.emailRepo.create({
      gmailMessageId: msg.id,
      emailType: parsed.emailType,
      subject: msg.subject,
      receivedAt: msg.receivedAt,
      cmOrderNumber: parsed.cmOrderNumber,
      cNumber: parsed.cNumber,
      orderDate: parsed.orderDate,
      phoneLast3: parsed.phoneLast3,
      paymentMethod: parsed.paymentMethod,
      deliveryMethod: parsed.deliveryMethod,
      subtotal: parsed.subtotal,
      shippingFee: parsed.shippingFee,
      totalAmount: parsed.totalAmount,
      matchStatus: 'pending',
      processStatus: 'pending',
      rawBody: msg.body,
    });
    const savedEmail = await this.emailRepo.save(shippingEmail);

    // Auto-match: phone_last3 + total_amount + order_date + type='online'
    const matchedOrder = await this.findMatchingOrder(parsed);

    if (matchedOrder) {
      await this.applyMatch(savedEmail, matchedOrder, parsed);
      return true;
    } else {
      await this.emailRepo.update(savedEmail.id, {
        matchStatus: 'unmatched',
        processStatus: 'processed',
        processedAt: new Date(),
      });
      return false;
    }
  }

  private async findMatchingOrder(parsed: {
    phoneLast3: string | null;
    totalAmount: number | null;
    orderDate: string | null;
  }): Promise<Order | null> {
    if (!parsed.phoneLast3 || !parsed.totalAmount || !parsed.orderDate) {
      return null;
    }

    // Match: customer phone ends with phone_last3, total_amount matches, created date matches
    // Order must be type=online
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.customer', 'customer')
      .leftJoinAndSelect('o.items', 'items') // needed for cancelOrder / returnOrder stock restore
      .where('o.type = :type', { type: OrderType.ONLINE })
      .andWhere('o.total_amount = :totalAmount', { totalAmount: parsed.totalAmount })
      .andWhere('DATE(o.created_at) = :orderDate', { orderDate: parsed.orderDate });

    // Phone matching — check customer.phone or order.customerName via customer join
    // Customer phone field ends with phone_last3
    qb.andWhere('customer.phone LIKE :phoneSuffix', {
      phoneSuffix: `%${parsed.phoneLast3}`,
    });

    const order = await qb.getOne();
    return order ?? null;
  }

  private async applyMatch(
    shippingEmail: ShippingEmail,
    order: Order,
    parsed: {
      emailType: string;
      cmOrderNumber: string | null;
      cNumber: string | null;
      totalAmount: number | null;
    },
  ): Promise<void> {
    const posTotal = Number(order.totalAmount);
    const emailTotal = parsed.totalAmount ?? 0;
    const diff = Math.abs(posTotal - emailTotal);
    const amountMismatch = diff > 0.01 ? { email_total: emailTotal, pos_total: posTotal, diff } : null;
    const newOrderStatus = EMAIL_TYPE_TO_ORDER_STATUS[parsed.emailType];
    const historyEntry: TrackingHistoryEntry = {
      status: parsed.emailType,
      timestamp: new Date().toISOString(),
      email_id: shippingEmail.id,
    };

    // ── Phase 1: update shipping_emails + shipping_tracking in one transaction ──
    await this.dataSource.transaction(async (manager) => {
      await manager.update(ShippingEmail, shippingEmail.id, {
        matchedOrderId: order.id,
        matchStatus: 'matched' as MatchStatus,
        amountMismatch,
        processStatus: 'processed',
        processedAt: new Date(),
      });

      const existingTracking = await manager.findOne(ShippingTracking, {
        where: { orderId: order.id },
      });

      if (existingTracking) {
        const updatedHistory = [...(existingTracking.statusHistory || []), historyEntry];
        await manager.update(ShippingTracking, existingTracking.id, {
          cmOrderNumber: parsed.cmOrderNumber ?? existingTracking.cmOrderNumber,
          cNumber: parsed.cNumber ?? existingTracking.cNumber,
          currentStatus: parsed.emailType,
          statusHistory: updatedHistory,
        });
      } else {
        const tracking = manager.create(ShippingTracking, {
          orderId: order.id,
          cmOrderNumber: parsed.cmOrderNumber,
          cNumber: parsed.cNumber,
          carrier: 'seven_eleven',
          currentStatus: parsed.emailType,
          statusHistory: [historyEntry],
        });
        await manager.save(ShippingTracking, tracking);
      }
    });

    // ── Phase 2: update order status (may have its own internal transaction) ──
    // Separated to avoid nested transactions which TypeORM does not support cleanly.
    if (newOrderStatus !== null && newOrderStatus !== undefined) {
      if (newOrderStatus === OrderStatus.RETURNED) {
        // returnOrder restores stock for already-shipped orders
        await this.ordersService.returnOrder(
          order.id,
          `Auto-returned by Gmail tracker: 7-ELEVEN item not picked up`,
          SYSTEM_USER_ID,
        );
        // returnOrder sets status=CANCELLED; override to RETURNED
        await this.orderRepo.update(order.id, { status: OrderStatus.RETURNED });
      } else if (newOrderStatus === OrderStatus.CANCELLED) {
        if (
          order.status === OrderStatus.SHIPPED ||
          order.status === OrderStatus.DELIVERED
        ) {
          // Cannot call cancelOrder on shipped orders — direct status update
          await this.orderRepo.update(order.id, { status: newOrderStatus });
        } else {
          await this.ordersService.cancelOrder(
            order.id,
            `Auto-cancelled by Gmail tracker: buyer cancellation`,
            SYSTEM_USER_ID,
          );
        }
      } else {
        await this.orderRepo.update(order.id, { status: newOrderStatus });
      }
    }

    // ── Phase 3: audit log ────────────────────────────────────────────────────
    await this.auditService.log({
      userId: SYSTEM_USER_ID,
      action: AuditAction.SHIPPING_STATUS_UPDATE,
      targetTable: 'orders',
      targetId: order.id,
      oldValue: { status: order.status },
      newValue: {
        status: newOrderStatus ?? order.status,
        emailType: parsed.emailType,
        cmOrderNumber: parsed.cmOrderNumber,
        cNumber: parsed.cNumber,
      },
      reason: `Gmail shipping email matched: ${parsed.emailType}`,
    });
  }

  // ─── Dashboard ──────────────────────────────────────────────────────
  async getDashboardData(date: string): Promise<ShippingDashboardDto[]> {
    const emails = await this.emailRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.matchedOrder', 'order')
      .leftJoinAndSelect('order.customer', 'customer')
      .where('e.email_type IN (:...types)', { types: ['arrived', 'completed', 'warning'] })
      .andWhere('e.order_date = :date', { date })
      .andWhere('e.match_status IN (:...statuses)', { statuses: ['matched', 'manual'] })
      .orderBy('e.received_at', 'DESC')
      .getMany();

    return emails.map((e) => ({
      emailId: e.id,
      matchedOrderId: e.matchedOrderId,
      orderNo: e.matchedOrder?.orderNo ?? null,
      customerName: e.matchedOrder?.customerName ?? null,
      cNumber: e.cNumber,
      emailType: e.emailType,
      posTotal: e.matchedOrder ? Number(e.matchedOrder.totalAmount) : null,
      emailTotal: e.totalAmount ? Number(e.totalAmount) : null,
      amountMismatch: e.amountMismatch,
      adminConfirmed: e.adminConfirmed,
    }));
  }

  // ─── Confirm email ──────────────────────────────────────────────────
  async confirmEmail(emailId: string, userId: string): Promise<void> {
    const email = await this.emailRepo.findOne({ where: { id: emailId } });
    if (!email) throw new NotFoundException(`Shipping email ${emailId} not found`);

    await this.emailRepo.update(emailId, {
      adminConfirmed: true,
      confirmedAt: new Date(),
      confirmedById: userId,
    });

    await this.auditService.log({
      userId,
      action: AuditAction.GMAIL_SYNC,
      targetTable: 'shipping_emails',
      targetId: emailId,
      newValue: { adminConfirmed: true },
      reason: 'Admin confirmed shipping email',
    });
  }

  // ─── Manual match ───────────────────────────────────────────────────
  async manualMatch(emailId: string, orderId: string, userId: string): Promise<void> {
    const email = await this.emailRepo.findOne({ where: { id: emailId } });
    if (!email) throw new NotFoundException(`Shipping email ${emailId} not found`);

    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['items'],
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const posTotal = Number(order.totalAmount);
    const emailTotal = email.totalAmount ? Number(email.totalAmount) : 0;
    const diff = Math.abs(posTotal - emailTotal);
    const amountMismatch = diff > 0.01 ? { email_total: emailTotal, pos_total: posTotal, diff } : null;

    await this.emailRepo.update(emailId, {
      matchedOrderId: orderId,
      matchStatus: 'manual',
      amountMismatch,
      adminConfirmed: true,
      confirmedAt: new Date(),
      confirmedById: userId,
    });

    // Upsert tracking
    const existingTracking = await this.trackingRepo.findOne({ where: { orderId } });
    if (!existingTracking) {
      const tracking = this.trackingRepo.create({
        orderId,
        cmOrderNumber: email.cmOrderNumber,
        cNumber: email.cNumber,
        carrier: 'seven_eleven',
        currentStatus: email.emailType,
        statusHistory: [
          {
            status: email.emailType,
            timestamp: new Date().toISOString(),
            email_id: emailId,
          },
        ],
      });
      await this.trackingRepo.save(tracking);
    }

    await this.auditService.log({
      userId,
      action: AuditAction.GMAIL_SYNC,
      targetTable: 'shipping_emails',
      targetId: emailId,
      newValue: { matchedOrderId: orderId, matchStatus: 'manual' },
      reason: 'Admin manually matched shipping email to order',
    });
  }

  // ─── Unmatched emails ───────────────────────────────────────────────
  async getUnmatchedEmails(): Promise<ShippingEmail[]> {
    return this.emailRepo.find({
      where: { matchStatus: 'unmatched' },
      order: { receivedAt: 'DESC' },
    });
  }
}
