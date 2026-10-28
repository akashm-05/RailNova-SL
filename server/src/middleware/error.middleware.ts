import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred.';

  if (status >= 500) {
    console.error('[RailNova Server Error]', err);
  }

  res.status(status).json({
    error: {
      code,
      message,
      status
    }
  });
}
