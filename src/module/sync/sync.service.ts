/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class SyncService {
  constructor(private prisma: PrismaService) { }

  async syncFromCsv(): Promise<{ total: number }> {
    const CSV_FILE_PATH = path.join(process.cwd(), 'data', 'base.csv');

    const rows: { sku: string; country: string; cost: string }[] = [];

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
          rows.push({
            sku: row.sku.trim(),
            country: row.country.trim(),
            cost: row.cost.trim(),
          });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const data = rows.filter((e) => e.sku && e.cost && e.country).map(row => ({
      sku: row.sku,
      country: row.country,
      baseCost: row.cost,
    }))

    const result = await this.prisma.client.base.createMany({
      data,
      skipDuplicates: true,
    })


    return { total: result.count };
  }
}
