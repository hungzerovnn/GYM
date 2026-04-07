import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class TenantClientManager implements OnModuleDestroy {
  private readonly clients = new Map<string, PrismaClient>();
  private readonly pendingClients = new Map<string, Promise<PrismaClient>>();

  async getClient(connectionUrl: string) {
    const existing = this.clients.get(connectionUrl);
    if (existing) {
      return existing;
    }

    const pending = this.pendingClients.get(connectionUrl);
    if (pending) {
      return pending;
    }

    const clientPromise = (async () => {
      const client = new PrismaClient({
        datasourceUrl: connectionUrl,
      });
      await client.$connect();
      this.clients.set(connectionUrl, client);
      this.pendingClients.delete(connectionUrl);
      return client;
    })().catch((error) => {
      this.pendingClients.delete(connectionUrl);
      throw error;
    });

    this.pendingClients.set(connectionUrl, clientPromise);
    return clientPromise;
  }

  async onModuleDestroy() {
    await Promise.all(
      [...this.clients.values()].map((client) => client.$disconnect()),
    );
    this.clients.clear();
    this.pendingClients.clear();
  }
}
