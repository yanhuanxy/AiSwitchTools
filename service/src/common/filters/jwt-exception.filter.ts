import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

@Catch(TokenExpiredError, JsonWebTokenError)
export class JwtExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(JwtExceptionFilter.name);

  catch(exception: TokenExpiredError | JsonWebTokenError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = HttpStatus.UNAUTHORIZED;
    
    let message = 'Invalid token';
    if (exception instanceof TokenExpiredError) {
      message = 'Token expired';
    } else if (exception instanceof JsonWebTokenError) {
      message = exception.message || 'Invalid token';
    }

    // Standardized error format matching client expectations
    // Client looks for code: "AUTH_REQUIRED" in services/error.ts and services/api.ts
    const errorResponse = {
      statusCode: status,
      code: 'AUTH_REQUIRED',
      message: message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(`JWT Error: ${message} for path ${request.url}`);

    response
      .status(status)
      .json(errorResponse);
  }
}
