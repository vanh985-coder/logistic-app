import { Params } from 'nestjs-pino';
import { randomUUID } from 'crypto';

interface RequestWithUser {
  id?: string;
  user?: {
    id?: string;
    companyId?: string;
  };
}

export const pinoConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    transport:
      process.env.PINO_PRETTY === 'true'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            },
          }
        : undefined,
    genReqId: (req) => {
      const headerId = req.headers['x-request-id'];
      if (headerId && typeof headerId === 'string') return headerId;
      return randomUUID();
    },
    autoLogging: true,
    redact: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.refreshToken',
      'body.token',
    ],
    customProps: (req) => {
      const customReq = req as unknown as RequestWithUser;
      return {
        requestId: customReq.id,
        userId: customReq.user?.id,
        companyId: customReq.user?.companyId,
      };
    },
  },
};
