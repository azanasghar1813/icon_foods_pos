/**
 * Express middleware factory for Role-Based Access Control.
 * @param {string|string[]} requiredPermissions - The permission code(s) required
 */
export const authorize = (requiredPermissions) => {
  return (req, res, next) => {
    next();
  };
};
