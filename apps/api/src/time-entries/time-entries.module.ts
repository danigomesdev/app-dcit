import { Module } from '@nestjs/common';
import { TimeEntriesController } from './time-entries.controller';
import { TimeEntriesService } from './time-entries.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService, PrismaService],
})
export class TimeEntriesModule {}
