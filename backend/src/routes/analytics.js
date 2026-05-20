import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VALID_EVENTS = ['page_view', 'dish_view', 'ar_click', 'menu_load'];

export default async function analyticsRoutes(app) {
  // Accept text/plain from sendBeacon
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (req, body, done) => {
    try {
      done(null, JSON.parse(body));
    } catch (err) {
      done(null, {});
    }
  });

  // Public: record an event (no auth required)
  app.post('/event', async (request, reply) => {
    const { event, dishId, dishName } = request.body || {};

    if (!event || !VALID_EVENTS.includes(event)) {
      return reply.code(400).send({ error: 'Événement invalide' });
    }

    await prisma.analyticsEvent.create({
      data: {
        event,
        dishId: dishId || null,
        dishName: dishName || null,
        userAgent: request.headers['user-agent']?.substring(0, 255) || null,
      },
    });

    return { ok: true };
  });

  // Admin: get analytics summary
  app.get('/summary', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { days = 30 } = request.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));

    // Totals
    const [totalViews, totalAR, totalDishViews] = await Promise.all([
      prisma.analyticsEvent.count({ where: { event: 'page_view', createdAt: { gte: since } } }),
      prisma.analyticsEvent.count({ where: { event: 'ar_click', createdAt: { gte: since } } }),
      prisma.analyticsEvent.count({ where: { event: 'dish_view', createdAt: { gte: since } } }),
    ]);

    // Top dishes by views
    const topDishes = await prisma.analyticsEvent.groupBy({
      by: ['dishName'],
      where: { event: 'dish_view', createdAt: { gte: since }, dishName: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Top AR clicks
    const topAR = await prisma.analyticsEvent.groupBy({
      by: ['dishName'],
      where: { event: 'ar_click', createdAt: { gte: since }, dishName: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Daily views (last N days)
    const dailyRaw = await prisma.$queryRaw`
      SELECT DATE(created_at) as day, COUNT(*)::int as count
      FROM analytics_events
      WHERE event = 'page_view' AND created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `;

    return {
      period: parseInt(days),
      totals: {
        pageViews: totalViews,
        arClicks: totalAR,
        dishViews: totalDishViews,
      },
      topDishes: topDishes.map(d => ({ name: d.dishName, views: d._count.id })),
      topAR: topAR.map(d => ({ name: d.dishName, clicks: d._count.id })),
      daily: dailyRaw,
    };
  });
}
