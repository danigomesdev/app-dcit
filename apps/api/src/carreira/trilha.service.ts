import { Injectable } from '@nestjs/common';
import type { TrackRequirementCreateInput } from '@ponto-dcit/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackRequirementsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.trackRequirement.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(input: TrackRequirementCreateInput) {
    return this.prisma.trackRequirement.create({
      data: { userId: input.userId, title: input.title },
    });
  }

  updateStatus(id: string, status: string) {
    return this.prisma.trackRequirement.update({ where: { id }, data: { status } });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.trackRequirement.delete({ where: { id } });
  }
}
