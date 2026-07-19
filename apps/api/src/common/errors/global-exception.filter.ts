import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ZodError } from 'zod';
import { ERROR_CODES, type ApiError } from '@safari-shule/shared-types';
import { getContext } from '../context/request-context';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const requestId = getContext()?.requestId;

    const { status, body } = this.map(exception);
    const payload: ApiError = { ...body, ...(requestId ? { requestId } : {}) };

    if (status >= 500) {
      this.logger.error({ err: exception, requestId, status }, 'unhandled exception');
    }

    res.status(status).json(payload);
  }

  private map(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof ZodError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        body: {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Validation failed.',
          details: { issues: exception.issues },
        },
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        body: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests.' },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      if (r && typeof r === 'object' && 'code' in (r as any)) {
        return { status, body: r as ApiError };
      }
      const message =
        typeof r === 'string'
          ? r
          : (r as any)?.message ?? exception.message ?? 'Request failed.';
      return {
        status,
        body: {
          code: this.statusToCode(status),
          message: Array.isArray(message) ? message.join(', ') : String(message),
          details: typeof r === 'object' ? (r as Record<string, unknown>) : undefined,
        },
      };
    }

    if (exception instanceof PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            code: ERROR_CODES.CONFLICT,
            message: 'Unique constraint violation.',
            details: { target: exception.meta?.target },
          },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: ERROR_CODES.NOT_FOUND, message: 'Resource not found.' },
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: ERROR_CODES.INTERNAL, message: 'Internal server error.' },
    };
  }

  private statusToCode(status: number) {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.INVALID_CREDENTIALS;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.PERMISSION_DENIED;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMITED;
      default:
        return ERROR_CODES.INTERNAL;
    }
  }
}
