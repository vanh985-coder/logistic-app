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
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private setRefreshTokenCookie(res: Response, token: string) {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
  }

  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
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
  ) {
    const { tokens, user } = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, tokens.refreshToken);
    return {
      accessToken: tokens.accessToken,
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
      throw new UnauthorizedException('Refresh token cookie or header missing');
    }

    const tokens = await this.authService.refresh(rawToken);
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
