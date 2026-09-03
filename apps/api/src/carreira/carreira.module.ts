import { Module } from '@nestjs/common';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { TrackRequirementsController } from './trilha.controller';
import { TrackRequirementsService } from './trilha.service';
import { PerformanceEvaluationsController } from './avaliacoes.controller';
import { PerformanceEvaluationsService } from './avaliacoes.service';
import { NineBoxController } from './nine-box.controller';
import { NineBoxService } from './nine-box.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CareerGoalsController, TrackRequirementsController, PerformanceEvaluationsController, NineBoxController],
  providers: [CareerGoalsService, TrackRequirementsService, PerformanceEvaluationsService, NineBoxService],
})
export class CarreiraModule {}
