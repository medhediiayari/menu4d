import { PrismaClient } from '@prisma/client';
import { uploadFile, getPublicUrl } from '../services/minio.js';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';

const prisma = new PrismaClient();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_3D_EXTENSIONS = ['.usdz', '.obj', '.mtl', '.glb', '.gltf', '.fbx'];
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_3D_SIZE = 100 * 1024 * 1024;   // 100MB

function getFileTypeForCategory(filename, category) {
  const ext = path.extname(filename).toLowerCase();

  if (category === '3d') {
    // Everything in the 3D upload is treated as 3D asset
    if (ext === '.usdz') return 'USDZ';
    if (ALLOWED_3D_EXTENSIONS.includes(ext)) return 'OBJ';
    // Textures uploaded with 3D models
    if (ALLOWED_IMAGE_EXTENSIONS.includes(ext)) return 'OBJ';
    return null;
  }

  // category === 'image'
  if (ALLOWED_IMAGE_EXTENSIONS.includes(ext) || ALLOWED_IMAGE_TYPES.includes('image/' + ext.slice(1))) {
    return 'IMAGE';
  }
  return null;
}

function generateFilename(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  const hash = crypto.randomBytes(16).toString('hex');
  return `${hash}${ext}`;
}

export default async function uploadRoutes(app) {
  // Upload file(s) for a dish
  app.post('/:dishId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { dishId } = request.params;

    // Verify dish exists
    const dish = await prisma.dish.findUnique({ where: { id: dishId } });
    if (!dish) {
      return reply.code(404).send({ error: 'Plat non trouvé' });
    }

    const parts = request.parts();
    const uploaded = [];
    let fileCategory = 'image'; // default

    for await (const part of parts) {
      // Read the fileCategory field first
      if (part.type === 'field' && part.fieldname === 'fileCategory') {
        fileCategory = part.value || 'image';
        continue;
      }
      if (part.type !== 'file') continue;

      const fileType = getFileTypeForCategory(part.filename, fileCategory);
      if (!fileType) {
        return reply.code(400).send({
          error: `Type de fichier non supporté: ${part.filename}`,
        });
      }

      // Read file buffer
      const chunks = [];
      for await (const chunk of part.file) {
        chunks.push(chunk);
      }
      let buffer = Buffer.concat(chunks);

      // Size validation
      const maxSize = fileType === 'IMAGE' ? MAX_IMAGE_SIZE : MAX_3D_SIZE;
      if (buffer.length > maxSize) {
        return reply.code(400).send({
          error: `Fichier trop volumineux: ${part.filename} (max ${maxSize / 1024 / 1024}MB)`,
        });
      }

      const storedFilename = generateFilename(part.filename);
      let thumbnailFilename = null;

      // Optimize dish photos with sharp (skip textures and 3D files)
      if (fileType === 'IMAGE') {
        buffer = await sharp(buffer)
          .resize(1200, 900, { fit: 'cover', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();

        // Generate thumbnail
        const thumbBuffer = await sharp(buffer)
          .resize(400, 300, { fit: 'cover' })
          .webp({ quality: 70 })
          .toBuffer();

        thumbnailFilename = `thumb_${storedFilename.replace(/\.[^.]+$/, '.webp')}`;
        await uploadFile(thumbnailFilename, thumbBuffer, 'image/webp');
      }

      // Upload to MinIO
      const finalFilename = fileType === 'IMAGE'
        ? storedFilename.replace(/\.[^.]+$/, '.webp')
        : storedFilename;
      const finalMimeType = fileType === 'IMAGE' ? 'image/webp' : part.mimetype;
      await uploadFile(finalFilename, buffer, finalMimeType);

      // Save to DB
      const fileRecord = await prisma.dishFile.create({
        data: {
          dishId,
          type: fileType,
          filename: finalFilename,
          mimeType: finalMimeType,
          size: buffer.length,
          url: getPublicUrl(finalFilename),
        },
      });

      // Save thumbnail record
      if (thumbnailFilename) {
        await prisma.dishFile.create({
          data: {
            dishId,
            type: 'THUMBNAIL',
            filename: thumbnailFilename,
            mimeType: 'image/webp',
            size: buffer.length,
            url: getPublicUrl(thumbnailFilename),
          },
        });
      }

      uploaded.push(fileRecord);
    }

    return { uploaded };
  });
}
