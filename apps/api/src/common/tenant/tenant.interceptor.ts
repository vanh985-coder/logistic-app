import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContextService: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.tenantContextService.run(
        {
          userId: user.userId,
          companyId: user.companyId,
          role: user.role,
          userStatus: user.userStatus,
          companyStatus: user.companyStatus,
        },
        () => {
          const subscription = next.handle().subscribe({
            next: (val) => subscriber.next(val),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
          return () => subscription.unsubscribe();
        },
      );
    });
  }
}
