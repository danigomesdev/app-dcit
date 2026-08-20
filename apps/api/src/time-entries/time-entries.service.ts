import { Injectable } from "@nestjs/common";
import { TimeEntryInput } from "@ponto-dcit/shared-types";
import { PrismaService } from "./prisma.service";

@Injectable()
export class TimeEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: TimeEntryInput) {
    return this.prisma.timeEntry.create({
      data: {
        userId: input.userId,
        clockedAt: new Date(input.clockedAt),
      },
    });
  }
}
