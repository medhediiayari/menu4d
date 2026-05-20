import { PrismaClient } from '@prisma/client';
import { getCachedMenu, invalidateMenuCache } from '../services/cache.js';

const prisma = new PrismaClient();

export default async function menuRoutes(app) {
  // Public menu endpoint — served from Redis cache
  app.get('/', async (request, reply) => {
    // Try cache first
    const cached = await getCachedMenu();
    if (cached) {
      reply.header('X-Cache', 'HIT');
      reply.header('Cache-Control', 'public, max-age=60');
      return cached;
    }

    // Cache miss — build from DB
    const restaurant = await prisma.restaurant.findFirst();
    if (!restaurant) {
      return reply.code(404).send({ error: 'Restaurant non configuré' });
    }

    const categories = await prisma.category.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { sortOrder: 'asc' },
      include: {
        dishes: {
          where: { visible: true },
          orderBy: { sortOrder: 'asc' },
          include: { files: true },
        },
      },
    });

    const menu = {
      restaurant: {
        name: restaurant.name,
        subtitle: restaurant.subtitle,
        address: restaurant.address,
        phone: restaurant.phone,
        logoUrl: restaurant.logoUrl,
      },
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        eyebrow: cat.eyebrow,
        dishes: cat.dishes.map(dish => ({
          id: dish.id,
          name: dish.name,
          description: dish.description,
          price: dish.price,
          priceLabel: dish.priceLabel,
          allergens: dish.allergens,
          subcategory: dish.subcategory,
          featured: dish.featured,
          files: dish.files.map(f => ({
            type: f.type,
            url: f.url,
          })),
        })),
      })),
      generatedAt: new Date().toISOString(),
    };

    // Cache it
    const { setMenuCache } = await import('../services/cache.js');
    await setMenuCache(menu);

    reply.header('X-Cache', 'MISS');
    reply.header('Cache-Control', 'public, max-age=60');
    return menu;
  });
}
