import { Controller, Get, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('users')
  async getDemoUsers() {
    return this.authService.listDemoAccounts();
  }

  @Post('login')
  async login(@Body() body: { username?: string; email?: string }) {
    const identifier = body.username || body.email || 'buyer_alex';
    return this.authService.login(identifier);
  }
}
