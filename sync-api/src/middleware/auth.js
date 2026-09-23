import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export const requireDeviceAuth = (req, res, next) => {
  const deviceSecret = req.headers['x-device-secret'];
  const terminalId = req.headers['x-terminal-id'];
  if (!deviceSecret || deviceSecret !== config.deviceSecret) {
    return res.status(401).json({ error: 'Unauthorized device' });
  }
  if (!terminalId) {
    return res.status(401).json({ error: 'Missing x-terminal-id header' });
  }
  next();
};

export const requireUserAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
