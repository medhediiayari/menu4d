import { PrismaClient } from '@prisma/client';
import { invalidateMenuCache } from '../services/cache.js';

const prisma = new PrismaClient();

export default async function categoryRoutes(app) {
  // List categories
  app.get('/', async (request) => {
    const restaurantId = request.query.restaurantId;
    const where = restaurantId ? { restaurantId } : {};
    return prisma.category.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { dishes: true } } },
    });
  });

  // Create category
  app.post('/', { preHandler: [app.authenticate] }, async (request) => {
    const { name, slug, eyebrow, sortOrder, restaurantId } = request.body;
    const category = await prisma.category.create({
      data: { name, slug, eyebrow, sortOrder: sortOrder || 0, restaurantId },
    });
    await invalidateMenuCache();
    return category;
  });

  // Update category
  app.put('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params;
    const { name, slug, eyebrow, sortOrder } = request.body;
    const category = await prisma.category.update({
      where: { id },
      data: { name, slug, eyebrow, sortOrder },
    });
    await invalidateMenuCache();
    return category;
  });

  // Reorder categories
  app.patch('/reorder', { preHandler: [app.authenticate] }, async (request) => {
    const { order } = request.body; // [{ id, sortOrder }]
    await prisma.$transaction(
      order.map(({ id, sortOrder }) =>
        prisma.category.update({ where: { id }, data: { sortOrder } })
      )
    );
    await invalidateMenuCache();
    return { success: true };
  });

  // Delete category
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params;
    await prisma.category.delete({ where: { id } });
    await invalidateMenuCache();
    return { success: true };
  });
}
