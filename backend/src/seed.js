import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding database...');

  // Create admin
  const hashedPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@lamaison.fr' },
    update: {},
    create: {
      email: 'admin@lamaison.fr',
      password: hashedPassword,
    },
  });
  console.log(`Admin created: ${admin.email}`);

  // Create restaurant
  const restaurant = await prisma.restaurant.upsert({
    where: { id: 'default-restaurant' },
    update: {},
    create: {
      id: 'default-restaurant',
      name: 'La Maison',
      slug: 'la-maison',
      subtitle: 'Une cuisine d\'exception, une expérience inoubliable',
      address: '12 Rue Saint-Honoré, Paris 75001',
      phone: '+33 1 42 00 00 00',
    },
  });
  console.log(`Restaurant created: ${restaurant.name}`);

  // Create categories
  const categories = [
    { name: 'Entrées', slug: 'entrees', eyebrow: 'Pour commencer', sortOrder: 0 },
    { name: 'Plats', slug: 'plats', eyebrow: "L'essentiel", sortOrder: 1 },
    { name: 'Desserts', slug: 'desserts', eyebrow: 'Pour finir', sortOrder: 2 },
    { name: 'Boissons', slug: 'boissons', eyebrow: 'À boire', sortOrder: 3 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { restaurantId_slug: { restaurantId: restaurant.id, slug: cat.slug } },
      update: {},
      create: { ...cat, restaurantId: restaurant.id },
    });
  }
  console.log(`${categories.length} categories created`);

  console.log('Seed complete!');
  console.log('\n--- Admin credentials ---');
  console.log('Email: admin@lamaison.fr');
  console.log('Password: admin123');
  console.log('⚠️  Change these in production!\n');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
