import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as crypto from 'node:crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  companyId: string;
  role: string;
  email: string;
  type: 'access';
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly ACCESS_TOKEN_EXPIRATION_SECONDS = 15 * 60; // 15 minutes
  private readonly REFRESH_TOKEN_EXPIRATION_DAYS = 7;
  private readonly GRACE_PERIOD_SECONDS = 3;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private generateOpaqueToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  /**
   * Generates a new access token (15m) and a root refresh token with a new familyId.
   */
  async generateTokens(user: {
    id: string;
    companyId: string;
    role: string;
    email: string;
  }): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      type: 'access',
      jti: crypto.randomUUID(),
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRATION_SECONDS,
    });

    const rawRefreshToken = this.generateOpaqueToken();
    const tokenHash = this.hashToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    );

    // Persist refresh token using unsafeGlobal (safe system-level auth operation)
    await this.prisma.unsafeGlobal.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId,
        expiresAt,
        isRevoked: false,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  /**
   * Rotates a refresh token with Token Family tracking and 3-second Redis Grace Period.
   * All failures return a uniform 'Invalid or expired session' to prevent defense mechanism disclosure (OAuth 2.0 BCP).
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    meta?: { ip?: string; userAgent?: string; requestId?: string },
  ): Promise<TokenPair> {
    const GENERIC_ERROR = 'Invalid or expired session';

    if (!rawRefreshToken) {
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    // 1. Check DB for token
    const tokenRecord = await this.prisma.unsafeGlobal.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!tokenRecord) {
      this.logger.warn({
        msg: 'Refresh token not found in database',
        tokenHashPrefix: tokenHash.substring(0, 10),
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        requestId: meta?.requestId,
      });
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    // 2. Reuse Detection Check
    if (tokenRecord.isRevoked) {
      // Check 3-second grace period in Redis to protect against network race conditions
      const redisClient = this.redis.getClient();
      const cachedGraceTokens = await redisClient.get(`auth:grace:${tokenHash}`);

      if (cachedGraceTokens) {
        this.logger.warn(
          `Concurrent refresh request within grace period for token family ${tokenRecord.familyId}`,
        );
        return JSON.parse(cachedGraceTokens) as TokenPair;
      }

      // NO GRACE PERIOD -> ATTEMPTED REUSE DETECTED!
      this.logger.error({
        msg: '[SECURITY ALERT] Refresh token reuse detected. Revoking entire token family!',
        familyId: tokenRecord.familyId,
        userId: tokenRecord.userId,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        requestId: meta?.requestId,
      });

      // Revoke all tokens in family
      await this.prisma.unsafeGlobal.refreshToken.updateMany({
        where: { familyId: tokenRecord.familyId },
        data: { isRevoked: true },
      });

      // Invalidate Redis tenant cache
      await redisClient.del(`user:tenant:${tokenRecord.userId}`);

      throw new UnauthorizedException(GENERIC_ERROR);
    }

    // 3. Check expiration
    if (tokenRecord.expiresAt < new Date()) {
      this.logger.warn({
        msg: 'Refresh token has expired',
        familyId: tokenRecord.familyId,
        userId: tokenRecord.userId,
        expiresAt: tokenRecord.expiresAt,
        ip: meta?.ip,
        userAgent: meta?.userAgent,
        requestId: meta?.requestId,
      });
      throw new UnauthorizedException(GENERIC_ERROR);
    }

    // 4. Mark current token as revoked
    await this.prisma.unsafeGlobal.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    // 5. Generate new access token and new rotated refresh token in the same family
    const user = tokenRecord.user;
    const payload = {
      sub: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
      type: 'access',
      jti: crypto.randomUUID(),
    };

    const newAccessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRATION_SECONDS,
    });

    const newRawRefreshToken = this.generateOpaqueToken();
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(
      Date.now() + this.REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.unsafeGlobal.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        familyId: tokenRecord.familyId,
        expiresAt: newExpiresAt,
        isRevoked: false,
      },
    });

    const newPair: TokenPair = {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };

    // 6. Save in Redis for 3-second grace period
    const redisClient = this.redis.getClient();
    await redisClient.set(
      `auth:grace:${tokenHash}`,
      JSON.stringify(newPair),
      'EX',
      this.GRACE_PERIOD_SECONDS,
    );

    return newPair;
  }

  /**
   * Revokes a specific refresh token (e.g. on logout).
   */
  async revokeToken(rawRefreshToken: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashToken(rawRefreshToken);
    const record = await this.prisma.unsafeGlobal.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (record) {
      await this.prisma.unsafeGlobal.refreshToken.update({
        where: { id: record.id },
        data: { isRevoked: true },
      });
      await this.redis.getClient().del(`user:tenant:${record.userId}`);
    }
  }

  /**
   * Revokes all active refresh tokens for a user.
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.unsafeGlobal.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    await this.redis.getClient().del(`user:tenant:${userId}`);
  }
}
