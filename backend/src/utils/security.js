import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export const securityUtils = {
  /**
   * Hashes a plain text PIN or Password.
   * @param {string} plainText 
   * @returns {string} Hashed string
   */
  hashPin: (plainText) => {
    return bcrypt.hashSync(plainText, 10);
  },

  /**
   * Compares a plain text PIN or Password against a hash.
   * @param {string} plainText 
   * @param {string} hashedText 
   * @returns {boolean}
   */
  verifyPin: (plainText, hashedText) => {
    if (plainText == null || hashedText == null) return false;
    const pin = String(plainText).trim();
    const stored = String(hashedText).trim();
    try {
      if (stored.startsWith('$2')) return bcrypt.compareSync(pin, stored);
      return pin === stored;
    } catch {
      return false;
    }
  },

  /**
   * Generates a signed JWT.
   * @param {Object} payload - Must include userId and roleId
   * @param {string} tokenId - Unique JTI for session tracking
   * @returns {string} Signed JWT token
   */
  generateToken: (payload, tokenId) => {
    if (!config.security || !config.security.jwtSecret) {
      throw new Error('JWT_SECRET is not configured in the environment.');
    }
    
    return jwt.sign(
      { ...payload },
      config.security.jwtSecret,
      {
        expiresIn: '12h',
        jwtid: tokenId
      }
    );
  },

  /**
   * Verifies and decodes a JWT.
   * @param {string} token 
   * @returns {Object} Decoded payload
   */
  verifyToken: (token) => {
    if (!config.security || !config.security.jwtSecret) {
      throw new Error('JWT_SECRET is not configured in the environment.');
    }
    
    try {
      return jwt.verify(token, config.security.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token.');
    }
  }
};
