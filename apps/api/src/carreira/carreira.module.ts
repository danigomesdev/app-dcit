import { Module } from '@nestjs/common';
import { CareerGoalsController } from './metas.controller';
import { CareerGoalsService } from './metas.service';
import { TrackRequirementsController } from './trilha.controller';
import { TrackRequirementsService } from './trilha.service';
import { CareerEvaluationsController } from './evaluations.controller';
import { CareerEvaluationsService } from './evaluations.service';
import { NineBoxController } from './nine-box.controller';
import { NineBoxService } from './nine-box.service';
import { OneOnOnesController } from './one-on-ones.controller';
import { OneOnOnesService } from './one-on-ones.service';
import { PromotabilidadeController } from './promotabilidade.controller';
import { PromotabilidadeService } from './promotabilidade.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    CareerGoalsController,
    TrackRequirementsController,
    CareerEvaluationsController,
    NineBoxController,
    OneOnOnesController,
    PromotabilidadeController,
  ],
  providers: [
    CareerGoalsService,
    TrackRequirementsService,
    CareerEvaluationsService,
    NineBoxService,
    OneOnOnesService,
    PromotabilidadeService,
  ],
})
export class CarreiraModule {}
