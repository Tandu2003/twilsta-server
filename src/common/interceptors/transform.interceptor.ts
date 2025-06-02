import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const path = request.url;

    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'statusCode' in data &&
          'success' in data &&
          'message' in data &&
          'timestamp' in data &&
          'path' in data
        ) {
          return data;
        }

        let message = 'Success';
        let responseData = data;

        if (data && typeof data === 'object') {
          if ('message' in data) {
            message = data.message;
            const { message: _, ...rest } = data;
            responseData = rest;
          }
        }

        return {
          statusCode: context.switchToHttp().getResponse().statusCode,
          success: true,
          message,
          data: responseData,
          timestamp: new Date().toISOString(),
          path,
        };
      }),
    );
  }
}
