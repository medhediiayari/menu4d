import { PrismaClient } from '@prisma/client';
import { uploadFile, getPublicUrl } from '../services/minio.js';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';

const prisma = new PrismaClient();

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_3D_TYPES = ['model/vnd.usdz+zip', 'application/octet-stream'];
const ALLOWED_3D_EXTENSIONS = ['.usdz', '.obj', '.mtl', '.glb', '.gltf', '.fbx'];
const TEXTURE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_3D_SIZE = 100 * 1024 * 1024;   // 100MB

function getFileType(mimetype, filename) {
  const ext = path.extname(filename).toLowerCase();
  
  // 3D model files (OBJ, MTL, GLB, GLTF, FBX)
  if (ALLOWED_3D_EXTENSIONS.includes(ext)) return 'OBJ';
  // USDZ (AR specific)
  if (ext === '.usdz') return 'USDZ';
  // Images: check if it's a texture for a 3D model (by name pattern) or a dish photo
  if (ALLOWED_IMAGE_TYPES.includes(mimetype) || TEXTURE_EXTENSIONS.includes(ext)) {
    // Texture files typically have names like *_basecolor*, *_normal*, *_roughness*
    const baseName = path.basename(filename, ext).toLowerCase();
    const isTexture = /_(basecolor|normal|roughness|metallic|ao|height|opacity|emissive)/.test(baseName);
    return isTexture ? 'OBJ' : 'IMAGE';
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

    for await (const part of parts) {
      if (part.type !== 'file') continue;

      const fileType = getFileType(part.mimetype, part.filename);
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
