import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
        s.store_description,
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
        s.store_description,
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
      throw new NotFoundException('Tài khoản không tồn tại trên hệ thống.');
    }
    if (!user.is_active) {
      throw new ForbiddenException(
        `Tài khoản "${user.username}" đã bị khóa bởi Quản trị viên.`,
      );
    }
    return user;
  }

  async register(params: {
    username: string;
    email: string;
    fullName: string;
    phoneNumber?: string;
    address?: string;
    role?: 'buyer' | 'seller';
    shopName?: string;
    storeDescription?: string;
  }) {
    const username = params.username?.trim();
    const email = params.email?.trim();
    const fullName = params.fullName?.trim();
    const role = params.role === 'seller' ? 'seller' : 'buyer';

    if (!username || !email || !fullName) {
      throw new BadRequestException(
        'Vui lòng nhập đầy đủ Tên đăng nhập, Email và Họ tên.',
      );
    }

    const exists = await this.db.query(
      `SELECT 1 AS found FROM dbo.Users WHERE username = @username OR email = @email`,
      { username, email },
    );
    if (exists.recordset.length > 0) {
      throw new BadRequestException(
        'Tên đăng nhập hoặc Email này đã được sử dụng.',
      );
    }

    await this.db.query(
      `
      INSERT INTO dbo.Users (username, email, password_hash, full_name, phone_number, address, role, is_active, created_at, updated_at)
      VALUES (@username, @email, N'$2a$12$defaultUserHashValueForDemoAccount', @full_name, @phone_number, @address, @role, 1, SYSUTCDATETIME(), SYSUTCDATETIME());
      `,
      {
        username,
        email,
        full_name: fullName,
        phone_number: params.phoneNumber || '0900000000',
        address: params.address || 'TP. Hồ Chí Minh',
        role,
      },
    );

    const newUserRes = await this.db.query(
      `SELECT user_id FROM dbo.Users WHERE username = @username`,
      { username },
    );
    const newUserId = newUserRes.recordset[0]?.user_id;

    if (role === 'seller' && newUserId) {
      const shopName = params.shopName?.trim() || `${fullName} Official Store`;
      await this.db.query(
        `
        INSERT INTO dbo.Sellers (user_id, shop_name, store_description, rating, is_approved, address, created_at, updated_at)
        VALUES (@user_id, @shop_name, @store_description, 5.00, 1, @address, SYSUTCDATETIME(), SYSUTCDATETIME());
        `,
        {
          user_id: newUserId,
          shop_name: shopName,
          store_description:
            params.storeDescription || 'Gian hàng chính hãng trên sàn TMĐT.',
          address: params.address || 'TP. Hồ Chí Minh',
        },
      );
    }

    return this.login(username);
  }

  async updateProfile(
    userId: number,
    params: {
      fullName: string;
      phoneNumber?: string;
      address?: string;
    },
  ) {
    await this.db.query(
      `
      UPDATE dbo.Users
      SET full_name = @full_name,
          phone_number = @phone_number,
          address = @address,
          updated_at = SYSUTCDATETIME()
      WHERE user_id = @user_id;
      `,
      {
        user_id: userId,
        full_name: params.fullName,
        phone_number: params.phoneNumber || null,
        address: params.address || null,
      },
    );

    const res = await this.db.query(
      `
      SELECT 
        u.user_id, u.username, u.email, u.full_name, u.phone_number, u.address, u.role, u.is_active,
        s.seller_id, s.shop_name, s.store_description, s.rating AS seller_rating, s.is_approved
      FROM dbo.Users u
      LEFT JOIN dbo.Sellers s ON u.user_id = s.user_id
      WHERE u.user_id = @user_id;
      `,
      { user_id: userId },
    );
    return res.recordset[0];
  }
}
