import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  async getUsers() {
    return this.adminService.getUsers();
  }

  @Patch('users/:id/moderate')
  async moderateUserAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { adminId: number; isActive: boolean },
  ) {
    return this.adminService.moderateUserAccount({
      adminId: Number(body.adminId),
      targetUserId: id,
      isActive: Boolean(body.isActive),
    });
  }

  @Get('sellers')
  async getSellers() {
    return this.adminService.getSellers();
  }

  @Patch('sellers/:id/approve')
  async approveSeller(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { adminId: number; isApproved: boolean },
  ) {
    return this.adminService.approveSeller({
      adminId: Number(body.adminId),
      sellerId: id,
      isApproved: Boolean(body.isApproved),
    });
  }

  @Get('analytics')
  async getPlatformAnalytics(@Query('adminId') adminId?: string) {
    return this.adminService.getPlatformAnalytics(
      adminId ? Number(adminId) : undefined,
    );
  }
}
