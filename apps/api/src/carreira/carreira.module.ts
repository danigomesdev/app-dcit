import { Module } from '@nestjs/common';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { TrackRequirementsController } from './trilha.controller';
import { TrackRequirementsService } from './trilha.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CareerGoalsController, TrackRequirementsController],
  providers: [CareerGoalsService, TrackRequirementsService],
})
export class CarreiraModule {}
