/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

function createPrismaAppClient(): PrismaClient {
  const globalAny = globalThis as unknown as Record<string, PrismaClient>;

  if (process.env.NODE_ENV === 'production') {
    if (!globalAny.prisma) {
      globalAny.prisma = new PrismaClient();
    }
    return globalAny.prisma;
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;

  constructor() {
    this.prisma = createPrismaAppClient();
  }

  async onModuleInit() {
    await this.prisma.$connect();
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
  }

  get client(): PrismaClient {
    return this.prisma;
  }
}
