import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function authRoutes(app) {
  // Login
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return reply.code(401).send({ error: 'Identifiants invalides' });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return reply.code(401).send({ error: 'Identifiants invalides' });
    }

    const token = app.jwt.sign(
      { id: admin.id, email: admin.email },
      { expiresIn: '24h' }
    );

    return { token, admin: { id: admin.id, email: admin.email } };
  });

  // Verify token
  app.get('/me', { preHandler: [app.authenticate] }, async (request) => {
    return { admin: request.user };
  });
}
