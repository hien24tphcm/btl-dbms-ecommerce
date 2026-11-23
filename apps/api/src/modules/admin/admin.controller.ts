import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Inject,
} from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly adminService: AdminService,
  ) {}

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

  @Post('vouchers')
  async createVoucher(
    @Body()
    body: {
      voucherCode: string;
      discountPercent: number;
      minOrderValue: number;
      maxDiscount?: number;
      usageLimit?: number;
    },
  ) {
    return this.adminService.createVoucher({
      voucherCode: body.voucherCode,
      discountPercent: Number(body.discountPercent),
      minOrderValue: Number(body.minOrderValue || 0),
      maxDiscount:
        body.maxDiscount !== undefined && body.maxDiscount !== null
          ? Number(body.maxDiscount)
          : undefined,
      usageLimit: body.usageLimit ? Number(body.usageLimit) : 200,
    });
  }
}
