import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import config from './config.js';
import { initMinio } from './services/minio.js';
import { initRedis } from './services/cache.js';
import authRoutes from './routes/auth.js';
import restaurantRoutes from './routes/restaurant.js';
import categoryRoutes from './routes/categories.js';
import dishRoutes from './routes/dishes.js';
import uploadRoutes from './routes/upload.js';
import menuRoutes from './routes/menu.js';

const app = Fastify({
  logger: true,
  trustProxy: true,
});

// Plugins
await app.register(cors, { origin: true });
await app.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for 3D files
    files: 5,
  },
});
await app.register(jwt, { secret: config.jwtSecret });

// Auth decorator
app.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.code(401).send({ error: 'Non autorisé' });
  }
});

// Init services
await initMinio();
await initRedis();

// Routes
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(restaurantRoutes, { prefix: '/api/restaurant' });
await app.register(categoryRoutes, { prefix: '/api/categories' });
await app.register(dishRoutes, { prefix: '/api/dishes' });
await app.register(uploadRoutes, { prefix: '/api/upload' });
await app.register(menuRoutes, { prefix: '/api/menu' });

// Health check
app.get('/api/health', async () => ({ status: 'ok', timestamp: Date.now() }));

// Start
try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Server running on port ${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
