import { Module } from '@nestjs/common';
import { AnalysisRunsModule } from '../analysis-runs/analysis-runs.module';
import { ApplicantsRepository } from './repositories/applicants.repository';
import { ApplicantsController } from './applicants.controller';
import { ApplicantsFacade } from './applicants.facade';
import { ApplicantsService } from './applicants.service';

@Module({
  imports: [AnalysisRunsModule],
  controllers: [ApplicantsController],
  providers: [ApplicantsService, ApplicantsFacade, ApplicantsRepository],
  exports: [ApplicantsService, ApplicantsFacade, ApplicantsRepository],
})
export class ApplicantsModule {}
