/**
 * 404 Not Found Middleware
 * Catches all requests to undefined routes and forwards a 404 error.
 */
export const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};
