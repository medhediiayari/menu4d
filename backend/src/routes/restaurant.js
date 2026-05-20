import { PrismaClient } from '@prisma/client';
import { invalidateMenuCache } from '../services/cache.js';

const prisma = new PrismaClient();

export default async function restaurantRoutes(app) {
  // Get restaurant info
  app.get('/', async () => {
    const restaurant = await prisma.restaurant.findFirst({
      include: { categories: { orderBy: { sortOrder: 'asc' } } },
    });
    return restaurant || {};
  });

  // Update restaurant (admin only)
  app.put('/', { preHandler: [app.authenticate] }, async (request) => {
    const { name, subtitle, address, phone, logoUrl } = request.body;

    let restaurant = await prisma.restaurant.findFirst();

    if (restaurant) {
      restaurant = await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { name, subtitle, address, phone, logoUrl },
      });
    } else {
      restaurant = await prisma.restaurant.create({
        data: { name, subtitle, address, phone, logoUrl },
      });
    }

    await invalidateMenuCache();
    return restaurant;
  });
}
