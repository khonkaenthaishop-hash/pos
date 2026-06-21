import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GmailCredential } from './gmail-credential.entity';
import { encrypt, decrypt } from './utils/encryption.util';

export interface GmailMessage {
  id: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

/** Store ID ใช้ระบุ row ของ gmail_credentials (ระบบรองรับ single store) */
const GMAIL_STORE_ID = 'default';

/** ที่อยู่อีเมลผู้ส่งจาก SP88 ที่ใช้กรอง inbox สำหรับ shipping notifications */
const SP88_SENDER_EMAIL = 'no-reply@sp88.com';

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);

  constructor(
    @InjectRepository(GmailCredential)
    private credentialRepo: Repository<GmailCredential>,
    private configService: ConfigService,
  ) {}

  private createOAuth2Client(): OAuth2Client {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const redirectUri = `${frontendUrl}/settings/gmail?callback=true`;

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  async getAuthUrl(): Promise<string> {
    const oauth2Client = this.createOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      prompt: 'consent', // force refresh_token to be returned
    });
  }

  async exchangeCodeForTokens(code: string): Promise<void> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to obtain access_token or refresh_token from Google');
    }

    // Get email address via userinfo
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    const emailAddress = data.email ?? '';

    const tokenExpiry = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Upsert — one credential per store
    const existing = await this.credentialRepo.findOne({ where: { storeId: GMAIL_STORE_ID } });

    if (existing) {
      await this.credentialRepo.update(existing.id, {
        emailAddress,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiry,
        status: 'active',
      });
    } else {
      const credential = this.credentialRepo.create({
        storeId: GMAIL_STORE_ID,
        emailAddress,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiry,
        status: 'active',
      });
      await this.credentialRepo.save(credential);
    }

    this.logger.log(`Gmail connected for ${emailAddress}`);
  }

  private async getAuthenticatedClient(): Promise<{ client: OAuth2Client; credential: GmailCredential }> {
    const credential = await this.credentialRepo.findOne({ where: { storeId: GMAIL_STORE_ID } });
    if (!credential) {
      throw new NotFoundException('Gmail not connected. Please connect Gmail first.');
    }

    const oauth2Client = this.createOAuth2Client();
    const accessToken = decrypt(credential.accessToken);
    const refreshToken = decrypt(credential.refreshToken);

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: credential.tokenExpiry.getTime(),
    });

    // Refresh if token is expired or expires within 5 minutes
    const isExpiringSoon = credential.tokenExpiry.getTime() < Date.now() + 5 * 60 * 1000;
    if (isExpiringSoon) {
      this.logger.log('Access token expiring soon, refreshing...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      await this.credentialRepo.update(credential.id, {
        accessToken: encrypt(credentials.access_token!),
        tokenExpiry: newExpiry,
        status: 'active',
      });

      credential.tokenExpiry = newExpiry;
    }

    return { client: oauth2Client, credential };
  }

  async fetchNewEmails(): Promise<GmailMessage[]> {
    const { client, credential } = await this.getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth: client });

    // Build query: from sp88, after last sync
    let query = `from:${SP88_SENDER_EMAIL}`;
    if (credential.lastSyncAt) {
      const unixTimestamp = Math.floor(credential.lastSyncAt.getTime() / 1000);
      query += ` after:${unixTimestamp}`;
    }

    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
    });

    const messageIds = listResponse.data.messages ?? [];
    if (messageIds.length === 0) {
      return [];
    }

    const messages: GmailMessage[] = [];

    for (const msg of messageIds) {
      if (!msg.id) continue;
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = detail.data.payload?.headers ?? [];
        const subjectHeader = headers.find((h) => h.name?.toLowerCase() === 'subject');
        const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date');

        const subject = subjectHeader?.value ?? '';
        const receivedAt = dateHeader?.value ? new Date(dateHeader.value) : new Date();

        const body = this.extractBody(detail.data.payload);

        messages.push({
          id: msg.id,
          subject,
          body,
          receivedAt,
        });
      } catch (err) {
        this.logger.warn(`Failed to fetch message ${msg.id}: ${err}`);
      }
    }

    // Update last_sync_at
    await this.credentialRepo.update(credential.id, {
      lastSyncAt: new Date(),
      lastSyncCount: credential.lastSyncCount + messages.length,
    });

    return messages;
  }

  private extractBody(payload: any): string {
    if (!payload) return '';

    // Prefer HTML part for parsing
    if (payload.mimeType === 'text/html' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf8');
    }

    // Recurse into parts
    if (payload.parts) {
      // Prefer HTML over plain
      const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
      if (htmlPart) return this.extractBody(htmlPart);

      const plainPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
      if (plainPart) return this.extractBody(plainPart);

      // Recurse deeper (multipart/related, multipart/alternative)
      for (const part of payload.parts) {
        const result = this.extractBody(part);
        if (result) return result;
      }
    }

    return '';
  }

  async disconnectGmail(): Promise<void> {
    const credential = await this.credentialRepo.findOne({ where: { storeId: GMAIL_STORE_ID } });
    if (!credential) {
      throw new NotFoundException('Gmail is not connected');
    }
    await this.credentialRepo.delete(credential.id);
    this.logger.log('Gmail disconnected');
  }

  async getConnectionStatus(): Promise<{ connected: boolean; email?: string; lastSyncAt?: Date }> {
    const credential = await this.credentialRepo.findOne({ where: { storeId: GMAIL_STORE_ID } });
    if (!credential) {
      return { connected: false };
    }
    return {
      connected: credential.status === 'active',
      email: credential.emailAddress,
      lastSyncAt: credential.lastSyncAt ?? undefined,
    };
  }
}
