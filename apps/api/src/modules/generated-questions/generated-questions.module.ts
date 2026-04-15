import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratedQuestionsEntity } from '@app/database';
import { GeneratedQuestionsController } from './generated-questions.controller';
import { GeneratedQuestionsFacade } from './generated-questions.facade';
import { GeneratedQuestionsRepository } from './repositories/generated-questions.repository';
import { GeneratedQuestionsService } from './generated-questions.service';

@Module({
  imports: [TypeOrmModule.forFeature([GeneratedQuestionsEntity])],
  controllers: [GeneratedQuestionsController],
  providers: [
    GeneratedQuestionsService,
    GeneratedQuestionsFacade,
    GeneratedQuestionsRepository,
  ],
  exports: [
    GeneratedQuestionsService,
    GeneratedQuestionsFacade,
    GeneratedQuestionsRepository,
  ],
})
export class GeneratedQuestionsModule {}
