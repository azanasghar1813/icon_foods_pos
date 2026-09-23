import { Server } from 'socket.io';
import { configService } from './configService.js';
import { LAN_SHARED_SECRET } from '../config/lanSecret.js';
import crypto from 'crypto';

class SocketService {
  constructor() {
    this.io = null;
  }

  attach(server) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.io.use((socket, next) => {
      const secret = socket.handshake.auth.token || socket.handshake.headers['x-device-secret'];
      const expectedSecret = LAN_SHARED_SECRET;
      
      if (!secret) return next(new Error('Authentication error'));
      
      const bufSecret = Buffer.from(secret);
      const bufExpected = Buffer.from(expectedSecret);
      
      if (bufSecret.length !== bufExpected.length || !crypto.timingSafeEqual(bufSecret, bufExpected)) {
        return next(new Error('Authentication error'));
      }
      
      next();
    });

    this.io.on('connection', (socket) => {
      console.log(`[SocketService] Terminal connected: ${socket.id}`);
      socket.on('disconnect', () => {
        console.log(`[SocketService] Terminal disconnected: ${socket.id}`);
      });
    });
  }

  emitOrderUpserted(order) {
    if (this.io) {
      this.io.emit('order:upserted', order);
    }
  }

  emitOrderDeleted(orderId) {
    if (this.io) {
      this.io.emit('order:deleted', orderId);
    }
  }

  emitOrderLockChanged(orderId, isLocked, lockedBy) {
    if (this.io) {
      this.io.emit('order:lock', { orderId, isLocked, lockedBy });
    }
  }

  emitCatalogUpdated() {
    if (this.io) {
      this.io.emit('catalog:updated');
    }
  }
}

export const socketService = new SocketService();
