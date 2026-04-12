import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { AnalysisRunsEntity } from './analysis-runs.entity';
import { ApplicantRepositoriesEntity } from './applicant-repositories.entity';
import { BaseTimestampEntity } from './base-timestamp.entity';
import { CodeAnalysisEntity } from './code-analysis.entity';
import { GeneratedQuestionsEntity } from './generated-questions.entity';
import { GroupsEntity } from './groups.entity';

@Entity('applicants')
export class ApplicantsEntity extends BaseTimestampEntity {
  @PrimaryGeneratedColumn('uuid')
    id: string;

  @Column({ name: 'group_id', type: 'uuid' })
    groupId: string;

  @Column()
    name: string;

  @Column()
    email: string;

  @Column({ name: 'github_url' })
    githubUrl: string;

  @ManyToOne(() => GroupsEntity, (group) => group.applicants, { nullable: false })
  @JoinColumn({ name: 'group_id' })
    group: GroupsEntity;

  @OneToMany(() => ApplicantRepositoriesEntity, (repository) => repository.applicant)
    repositories: ApplicantRepositoriesEntity[];

  @OneToMany(() => AnalysisRunsEntity, (analysisRun) => analysisRun.applicant)
    analysisRuns: AnalysisRunsEntity[];

  @OneToMany(() => GeneratedQuestionsEntity, (generatedQuestion) => generatedQuestion.applicant)
    generatedQuestions: GeneratedQuestionsEntity[];

  @OneToMany(() => CodeAnalysisEntity, (codeAnalysis) => codeAnalysis.applicant)
    codeAnalyses: CodeAnalysisEntity[];
}
