import { PrismaClient } from '@prisma/client';
import { invalidateMenuCache } from '../services/cache.js';

const prisma = new PrismaClient();

export default async function restaurantRoutes(app) {
  // Get all restaurants
  app.get('/', { preHandler: [app.authenticate] }, async () => {
    const restaurants = await prisma.restaurant.findMany({
      include: { categories: { orderBy: { sortOrder: 'asc' }, include: { _count: { select: { dishes: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return restaurants;
  });

  // Get restaurant by slug (public) — must be registered before /:id
  app.get('/slug/:slug', async (request) => {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: request.params.slug },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            dishes: {
              where: { visible: true },
              orderBy: { sortOrder: 'asc' },
              include: { files: true },
            },
          },
        },
      },
    });
    if (!restaurant) throw { statusCode: 404, message: 'Restaurant non trouvé' };
    return restaurant;
  });

  // Get single restaurant by ID
  app.get('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: request.params.id },
      include: { categories: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!restaurant) throw { statusCode: 404, message: 'Restaurant non trouvé' };
    return restaurant;
  });

  // Create restaurant (admin only)
  app.post('/', { preHandler: [app.authenticate] }, async (request) => {
    const { name, slug, subtitle, address, phone, logoUrl, primaryColor, secondaryColor, accentColor, googleReviewUrl, whatsappNumber } = request.body;

    const restaurant = await prisma.restaurant.create({
      data: { name, slug, subtitle, address, phone, logoUrl, primaryColor, secondaryColor, accentColor, googleReviewUrl, whatsappNumber },
    });
    return restaurant;
  });

  // Update restaurant (admin only)
  app.put('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { name, slug, subtitle, address, phone, logoUrl, primaryColor, secondaryColor, accentColor, googleReviewUrl, whatsappNumber } = request.body;

    const restaurant = await prisma.restaurant.update({
      where: { id: request.params.id },
      data: { name, slug, subtitle, address, phone, logoUrl, primaryColor, secondaryColor, accentColor, googleReviewUrl, whatsappNumber },
    });

    await invalidateMenuCache();
    return restaurant;
  });

  // Delete restaurant (admin only)
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request) => {
    await prisma.restaurant.delete({ where: { id: request.params.id } });
    await invalidateMenuCache();
    return { success: true };
  });
}
