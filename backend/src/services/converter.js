import obj2gltf from 'obj2gltf';
import { Readable } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Convert OBJ (+ optional MTL + textures) to GLB buffer.
 * Uses a temp directory to stage files since obj2gltf needs file paths.
 */
export async function convertObjToGlb(objBuffer, mtlBuffer, textures = {}) {
  const tmpDir = path.join(os.tmpdir(), `obj2glb_${crypto.randomBytes(8).toString('hex')}`);

  try {
    await fs.mkdir(tmpDir, { recursive: true });

    // Write OBJ
    const objPath = path.join(tmpDir, 'model.obj');
    await fs.writeFile(objPath, objBuffer);

    // Write MTL if present
    if (mtlBuffer) {
      await fs.writeFile(path.join(tmpDir, 'model.mtl'), mtlBuffer);
    }

    // Write textures
    for (const [filename, buffer] of Object.entries(textures)) {
      // Use just the base filename (strip any path/hash prefix)
      const baseName = path.basename(filename);
      await fs.writeFile(path.join(tmpDir, baseName), buffer);
    }

    // Convert
    const glb = await obj2gltf(objPath, {
      binary: true,
      separate: false,
    });

    return Buffer.from(glb);
  } finally {
    // Cleanup temp files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
