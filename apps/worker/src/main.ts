import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const bootstrapLogger = new Logger('WorkerBootstrap');

function registerProcessErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    bootstrapLogger.error('Uncaught worker exception', error.stack ?? error.message);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    bootstrapLogger.error(
      'Unhandled worker promise rejection',
      reason instanceof Error ? (reason.stack ?? reason.message) : String(reason),
    );
  });
}

async function bootstrap(): Promise<void> {
  registerProcessErrorHandlers();
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'local');

  Logger.log(`Worker context initialized in ${nodeEnv} mode`, 'WorkerBootstrap');
}

void bootstrap().catch((error: unknown) => {
  bootstrapLogger.error(
    'Worker bootstrap failed',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
