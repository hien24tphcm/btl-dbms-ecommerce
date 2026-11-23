import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  ParseIntPipe,
  Inject,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Get('users')
  async getDemoUsers() {
    return this.authService.listDemoAccounts();
  }

  @Post('login')
  async login(@Body() body: { username?: string; email?: string }) {
    const identifier = body.username || body.email || 'buyer_alex';
    return this.authService.login(identifier);
  }

  @Post('register')
  async register(
    @Body()
    body: {
      username: string;
      email: string;
      fullName: string;
      phoneNumber?: string;
      address?: string;
      role?: 'buyer' | 'seller';
      shopName?: string;
      storeDescription?: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Put('profile/:userId')
  async updateProfile(
    @Param('userId', ParseIntPipe) userId: number,
    @Body()
    body: {
      fullName: string;
      phoneNumber?: string;
      address?: string;
    },
  ) {
    return this.authService.updateProfile(userId, body);
  }
}
