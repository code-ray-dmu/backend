export interface HealthComponentStatusDto {
  status: 'up' | 'down';
}

export interface HealthStatusDto {
  status: 'ok' | 'error';
  timestamp: string;
  services: {
    database: HealthComponentStatusDto;
    redis: HealthComponentStatusDto;
    rabbitmq: HealthComponentStatusDto;
  };
}
