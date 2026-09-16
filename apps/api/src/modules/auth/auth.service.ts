import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { TokenService, TokenPair } from './token.service';
import {
  RegisterDto,
  LoginDto,
  RegisterResponseDto,
  LoginResponseDto,
  UserProfileResponseDto,
} from './dto/auth.dto';
import { CompanyType, CompanyStatus, UserRole, UserStatus } from '@logix/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  private mapRoleFromCompanyType(type: CompanyType): UserRole {
    switch (type) {
      case CompanyType.SHIPPER:
        return UserRole.SHIPPER_ADMIN;
      case CompanyType.FWD:
        return UserRole.FWD_ADMIN;
      case CompanyType.CFS:
        return UserRole.CFS_ADMIN;
      default:
        return UserRole.SHIPPER_ADMIN;
    }
  }

  /**
   * Registers a new company and its initial administrator user.
   * Safe usage of unsafeGlobal as this is an unauthenticated initial bootstrap.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    // 1. Verify taxCode uniqueness
    const existingCompany = await this.prisma.unsafeGlobal.company.findUnique({
      where: { taxCode: dto.taxCode },
    });
    if (existingCompany) {
      throw new ConflictException(`Company with tax code '${dto.taxCode}' already exists`);
    }

    // 2. Verify email uniqueness
    const existingUser = await this.prisma.unsafeGlobal.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException(`User with email '${dto.email}' already exists`);
    }

    // 3. Hash password using Argon2id
    const passwordHash = await this.passwordService.hashPassword(dto.password);

    // 4. Determine admin role
    const assignedRole = dto.role ?? this.mapRoleFromCompanyType(dto.companyType);

    // 5. Atomic creation of Company and User
    const result = await this.prisma.unsafeGlobal.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          taxCode: dto.taxCode,
          name: dto.companyName,
          type: dto.companyType as any,
          status: CompanyStatus.PENDING as any,
          representativeName: dto.representativeName,
          address: dto.address,
          phone: dto.companyPhone,
          email: dto.email.toLowerCase(),
        },
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          role: assignedRole as any,
          fullName: dto.fullName,
          phone: dto.phone,
          status: UserStatus.ACTIVE as any,
        },
      });

      return { company, user };
    });

    this.logger.log(
      `Company registered successfully: ${result.company.id} (${result.company.name}) with Admin: ${result.user.id}`,
    );

    // Return explicit response DTO (omits taxCode, status, timestamps)
    return {
      message: 'Company registered successfully',
      company: {
        id: result.company.id,
        name: result.company.name,
        type: result.company.type,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
      },
    };
  }

  /**
   * Authenticates user, verifies password, and issues JWT access token + refresh token.
   * Employs constant-time dummy Argon2id verification when email is not found to prevent timing attacks.
   */
  async login(dto: LoginDto): Promise<LoginResponseDto & { tokens: TokenPair }> {
    const user = await this.prisma.unsafeGlobal.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { company: true },
    });

    if (!user || user.deletedAt) {
      // Anti-timing attack: run dummy Argon2id verification
      await this.passwordService.verifyDummy(dto.password);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('User account is inactive or blocked');
    }

    if (user.company.status === CompanyStatus.SUSPENDED) {
      throw new ForbiddenException('Company account is suspended');
    }

    if (user.company.status === CompanyStatus.REJECTED) {
      throw new ForbiddenException('Company registration was rejected');
    }

    // Update lastLoginAt asynchronously
    await this.prisma.unsafeGlobal.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Issue tokens
    const tokens = await this.tokenService.generateTokens({
      id: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
    });

    // Return explicit response DTO (omits companyStatus and administrative internals)
    return {
      tokens,
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        companyName: user.company.name,
      },
    };
  }

  /**
   * Rotates a refresh token.
   */
  async refresh(
    rawRefreshToken: string,
    meta?: { ip?: string; userAgent?: string; requestId?: string },
  ): Promise<TokenPair> {
    return this.tokenService.rotateRefreshToken(rawRefreshToken, meta);
  }

  /**
   * Logs out a session by revoking the refresh token.
   */
  async logout(rawRefreshToken: string): Promise<void> {
    if (rawRefreshToken) {
      await this.tokenService.revokeToken(rawRefreshToken);
    }
  }

  /**
   * Retrieves profile of current user.
   * Strips taxCode, lastLoginAt, userStatus, and companyStatus.
   */
  async getMe(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.prisma.unsafeGlobal.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      company: {
        id: user.company.id,
        name: user.company.name,
        type: user.company.type,
      },
    };
  }
}
