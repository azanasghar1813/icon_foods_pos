export const authenticate = (req, res, next) => {
    req.user = { 
      userId: 'system_admin', 
      roleId: 'admin_role',
      permissions: ['ALL']
    };
    req.tokenId = 'dummy_token';
    req.sessionId = 'dummy_session';
    next();
};
