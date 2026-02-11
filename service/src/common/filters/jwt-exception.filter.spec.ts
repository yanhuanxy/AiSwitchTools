import { JwtExceptionFilter } from './jwt-exception.filter';
import { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';

describe('JwtExceptionFilter', () => {
  let filter: JwtExceptionFilter;

  beforeEach(() => {
    filter = new JwtExceptionFilter();
  });

  it('should catch TokenExpiredError and return 401 with AUTH_REQUIRED code', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockGetResponse = jest.fn().mockReturnValue({
      status: mockStatus,
    });
    const mockGetRequest = jest.fn().mockReturnValue({
      url: '/test-url',
    });
    const mockHttpArgumentsHost = jest.fn().mockReturnValue({
      getResponse: mockGetResponse,
      getRequest: mockGetRequest,
    });
    const mockArgumentsHost = {
      switchToHttp: mockHttpArgumentsHost,
    } as unknown as ArgumentsHost;

    const exception = new TokenExpiredError('jwt expired', new Date());

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_REQUIRED',
      message: 'Token expired',
      path: '/test-url'
    }));
  });

  it('should catch JsonWebTokenError and return 401 with AUTH_REQUIRED code', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockGetResponse = jest.fn().mockReturnValue({
      status: mockStatus,
    });
    const mockGetRequest = jest.fn().mockReturnValue({
      url: '/test-url',
    });
    const mockHttpArgumentsHost = jest.fn().mockReturnValue({
      getResponse: mockGetResponse,
      getRequest: mockGetRequest,
    });
    const mockArgumentsHost = {
      switchToHttp: mockHttpArgumentsHost,
    } as unknown as ArgumentsHost;

    const exception = new JsonWebTokenError('invalid signature');

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(mockJson).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 401,
      code: 'AUTH_REQUIRED',
      message: 'invalid signature',
      path: '/test-url'
    }));
  });
});
