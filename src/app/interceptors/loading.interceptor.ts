import { HttpInterceptorFn } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { inject } from '@angular/core';
import { LoadingService } from '../services/loading.service';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  const shouldShowLoader = MUTATION_METHODS.has(req.method.toUpperCase());

  if (!shouldShowLoader) {
    return next(req);
  }

  loadingService.show();
  return next(req).pipe(
    finalize(() => {
      loadingService.hide();
    }),
  );
};

