export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    cursor?: {
      next?: string | null;
      prev?: string | null;
    };
  };
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: 'up' | 'down';
      latencyMs?: number;
    };
    redis: {
      status: 'up' | 'down';
      latencyMs?: number;
    };
  };
}
