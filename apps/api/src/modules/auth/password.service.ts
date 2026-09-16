import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService implements OnModuleInit {
  private readonly logger = new Logger(PasswordService.name);
  private dummyHash = '';

  async onModuleInit() {
    // Generate a valid Argon2id hash at startup for constant-time dummy verification
    // to defeat timing-based user enumeration attacks.
    this.dummyHash = await this.hashPassword('ConstantTimeDummySaltString2026!');
    this.logger.log('Anti-timing dummy Argon2id hash initialized');
  }

  /**
   * Hashes a plaintext password using Argon2id with OWASP-recommended parameters.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MiB
      timeCost: 3,       // 3 iterations
      parallelism: 4,    // 4 threads
    });
  }

  /**
   * Verifies a plaintext password against an Argon2id hash.
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Performs dummy Argon2id verification when user does not exist.
   * Ensures response timing is identical whether email exists or not.
   */
  async verifyDummy(password: string): Promise<void> {
    try {
      if (this.dummyHash) {
        await argon2.verify(this.dummyHash, password);
      }
    } catch {
      // ignore
    }
  }
}
