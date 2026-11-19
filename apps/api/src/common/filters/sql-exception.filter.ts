import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

/**
 * Maps custom T-SQL THROW error numbers (50001..50010 defined in 04_procedures_fr.sql)
 * and standard NestJS HttpExceptions into structured JSON HTTP responses.
 */
@Catch()
export class SqlExceptionFilter implements ExceptionFilter {
  private mapSqlErrorToHttpStatus(sqlErrorNumber?: number): number {
    switch (sqlErrorNumber) {
      case 50001: // Invalid price range or Product not found / inactive
        return HttpStatus.BAD_REQUEST;
      case 50002: // Insufficient stock, invalid quantity, or negative stock adjustment
        return HttpStatus.CONFLICT;
      case 50003: // Checkout error: voucher expired/limit reached or concurrent stock depletion
        return HttpStatus.CONFLICT;
      case 50004: // Order cancellation guard (already shipped/delivered/cancelled or not found)
        return HttpStatus.BAD_REQUEST;
      case 50005: // Unauthorized access to order/review or inactive buyer/seller
        return HttpStatus.FORBIDDEN;
      case 50006: // Review validation failure (rating bounds, not delivered, duplicate review)
        return HttpStatus.BAD_REQUEST;
      case 50007: // Product upsert / inventory validation (unapproved seller, invalid category/bounds)
        return HttpStatus.BAD_REQUEST;
      case 50008: // Illegal monotonic order state transition
        return HttpStatus.BAD_REQUEST;
      case 50009: // Order not found or shop mismatch
        return HttpStatus.NOT_FOUND;
      case 50010: // Admin privilege required or target user/seller not found
        return HttpStatus.FORBIDDEN;
      default:
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
  }

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const resBody = exception.getResponse();
      return response.status(status).json({
        statusCode: status,
        errorCode: 'HTTP_EXCEPTION',
        message:
          typeof resBody === 'string'
            ? resBody
            : (resBody as any).message || exception.message,
        path: request.url,
        timestamp: new Date().toISOString(),
      });
    }

    const sqlNumber: number | undefined =
      exception?.number ?? exception?.originalError?.info?.number;

    const status = sqlNumber
      ? this.mapSqlErrorToHttpStatus(sqlNumber)
      : HttpStatus.INTERNAL_SERVER_ERROR;

    return response.status(status).json({
      statusCode: status,
      errorCode: sqlNumber ? `SQL_${sqlNumber}` : 'DB_ERROR',
      sqlErrorNumber: sqlNumber || null,
      message: exception?.message || 'Internal database error',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
