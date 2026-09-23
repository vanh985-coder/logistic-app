import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, LoginResponseDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Cấu hình cookie cho refreshToken.
   *
   * TUNNEL_MODE=true:
   * Dùng sameSite: 'none' + secure: true để trình duyệt gửi kèm cookie refreshToken
   * trong các request cross-site (khi Web và API chạy trên hai subdomain ngrok khác nhau).
   *
   * ⚠️ CẢNH BÁO BẢO MẬT:
   * Cấu hình này CHỈ DÙNG CHO DEMO QUA TUNNEL (NGROK).
   * TUYỆT ĐỐI KHÔNG DÙNG Ở PRODUCTION nhằm đảm bảo chống tấn công CSRF theo chuẩn ADR-0006.
   *
   * Mặc định (Production & Local Dev thông thường):
   * sameSite: 'strict', secure: NODE_ENV === 'production'
   */
  private getCookieOptions() {
    const isTunnelMode = process.env.TUNNEL_MODE === 'true';
    return {
      httpOnly: true,
      secure: isTunnelMode ? true : process.env.NODE_ENV === 'production',
      sameSite: (isTunnelMode ? 'none' : 'strict') as 'none' | 'strict',
      path: '/',
    };
  }

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      ...this.getCookieOptions(),
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.getCookieOptions());
  }

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const { accessToken, refreshToken, user } = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, refreshToken);
    return {
      accessToken,
      user,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE] ||
      (req.headers['x-refresh-token'] as string);

    if (!rawToken) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] as string | undefined;
    const requestId =
      (req.headers['x-request-id'] as string) || (req as any).id;

    const tokens = await this.authService.refresh(rawToken, {
      ip,
      userAgent,
      requestId,
    });
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE] ||
      (req.headers['x-refresh-token'] as string);

    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    this.clearRefreshTokenCookie(res);

    return { success: true, message: 'Logged out successfully' };
  }

  @Get('me')
  async getMe(@CurrentUser('userId') userId: string) {
    return this.authService.getMe(userId);
  }
}
