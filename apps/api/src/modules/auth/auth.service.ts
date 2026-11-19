import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MssqlService } from '../../database/mssql.service';

@Injectable()
export class AuthService {
  constructor(@Inject(MssqlService) private readonly db: MssqlService) {}

  async listDemoAccounts() {
    const res = await this.db.query(`
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.full_name,
        u.phone_number,
        u.address,
        u.role,
        u.is_active,
        s.seller_id,
        s.shop_name,
        s.rating AS seller_rating,
        s.is_approved
      FROM dbo.Users u
      LEFT JOIN dbo.Sellers s ON u.user_id = s.user_id
      ORDER BY u.user_id ASC;
    `);
    return res.recordset;
  }

  async login(identifier: string) {
    const res = await this.db.query(
      `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.full_name,
        u.phone_number,
        u.address,
        u.role,
        u.is_active,
        s.seller_id,
        s.shop_name,
        s.rating AS seller_rating,
        s.is_approved
      FROM dbo.Users u
      LEFT JOIN dbo.Sellers s ON u.user_id = s.user_id
      WHERE u.username = @identifier OR u.email = @identifier;
      `,
      { identifier },
    );

    const user = res.recordset[0];
    if (!user) {
      throw new NotFoundException(`Account '${identifier}' not found in dbo.Users.`);
    }
    if (!user.is_active) {
      throw new ForbiddenException(
        `Account '${user.username}' has been deactivated by an Administrator (FR-11).`,
      );
    }
    return user;
  }
}
