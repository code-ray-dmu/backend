import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_FILE_BY_NODE_ENV: Record<string, string> = {
  local: '.env.local',
  test: '.env.test',
  production: '.env.production',
};

export function getEnvFilePaths(nodeEnv?: string): string[] {
  const normalizedNodeEnv = nodeEnv?.trim() || 'local';
  const primaryEnvFile = ENV_FILE_BY_NODE_ENV[normalizedNodeEnv] ?? '.env';

  if (primaryEnvFile === '.env') {
    return ['.env'];
  }

  return [primaryEnvFile, '.env'];
}

export function loadEnvFiles(nodeEnv?: string, cwd = process.cwd()): void {
  for (const envFilePath of getEnvFilePaths(nodeEnv)) {
    const absolutePath = resolve(cwd, envFilePath);

    if (!existsSync(absolutePath)) {
      continue;
    }

    const fileContents = readFileSync(absolutePath, 'utf8');
    const lines = fileContents.split(/\r?\n/u);

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

      if (!key || process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = stripWrappingQuotes(rawValue);
    }
  }
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
