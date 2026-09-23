/**
 * Global Error Handler Middleware
 * Captures all errors thrown in the application and formats them into a standard response.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const environment = process.env.NODE_ENV || 'development';

  // Log error (would use winston here in full implementation)
  console.error(`[Error] ${err.message}`);
  if (environment === 'development') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: err.message || 'Internal Server Error',
    ...(environment === 'development' && { stack: err.stack })
  });
};
