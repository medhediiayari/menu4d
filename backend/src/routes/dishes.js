import { PrismaClient } from '@prisma/client';
import { invalidateMenuCache } from '../services/cache.js';
import { deleteFile } from '../services/minio.js';

const prisma = new PrismaClient();

export default async function dishRoutes(app) {
  // List dishes (with optional category filter)
  app.get('/', async (request) => {
    const { categoryId } = request.query;
    const where = categoryId ? { categoryId } : {};
    return prisma.dish.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: { files: true, category: true },
    });
  });

  // Get single dish
  app.get('/:id', async (request) => {
    const { id } = request.params;
    return prisma.dish.findUnique({
      where: { id },
      include: { files: true, category: true },
    });
  });

  // Create dish
  app.post('/', { preHandler: [app.authenticate] }, async (request) => {
    const { name, description, price, priceLabel, allergens, subcategory, featured, categoryId, sortOrder } = request.body;
    const dish = await prisma.dish.create({
      data: {
        name,
        description,
        price,
        priceLabel,
        allergens,
        subcategory,
        featured: featured || false,
        categoryId,
        sortOrder: sortOrder || 0,
      },
      include: { files: true },
    });
    await invalidateMenuCache();
    return dish;
  });

  // Update dish
  app.put('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params;
    const { name, description, price, priceLabel, allergens, subcategory, featured, visible, categoryId, sortOrder } = request.body;
    const dish = await prisma.dish.update({
      where: { id },
      data: { name, description, price, priceLabel, allergens, subcategory, featured, visible, categoryId, sortOrder },
      include: { files: true },
    });
    await invalidateMenuCache();
    return dish;
  });

  // Reorder dishes
  app.patch('/reorder', { preHandler: [app.authenticate] }, async (request) => {
    const { order } = request.body; // [{ id, sortOrder }]
    await prisma.$transaction(
      order.map(({ id, sortOrder }) =>
        prisma.dish.update({ where: { id }, data: { sortOrder } })
      )
    );
    await invalidateMenuCache();
    return { success: true };
  });

  // Delete dish
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.params;
    // Delete associated files from MinIO
    const files = await prisma.dishFile.findMany({ where: { dishId: id } });
    for (const file of files) {
      await deleteFile(file.filename);
    }
    await prisma.dish.delete({ where: { id } });
    await invalidateMenuCache();
    return { success: true };
  });

  // Remove a file from a dish
  app.delete('/:id/files/:fileId', { preHandler: [app.authenticate] }, async (request) => {
    const { fileId } = request.params;
    const file = await prisma.dishFile.findUnique({ where: { id: fileId } });
    if (file) {
      await deleteFile(file.filename);
      await prisma.dishFile.delete({ where: { id: fileId } });
    }
    await invalidateMenuCache();
    return { success: true };
  });
}
