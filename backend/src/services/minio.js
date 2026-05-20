import * as Minio from 'minio';
import config from '../config.js';

let minioClient;

export async function initMinio() {
  minioClient = new Minio.Client({
    endPoint: config.minio.endPoint,
    port: config.minio.port,
    useSSL: config.minio.useSSL,
    accessKey: config.minio.accessKey,
    secretKey: config.minio.secretKey,
  });

  // Create bucket if not exists
  const exists = await minioClient.bucketExists(config.minio.bucket);
  if (!exists) {
    await minioClient.makeBucket(config.minio.bucket);
    // Set bucket policy to public read
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${config.minio.bucket}/*`],
        },
      ],
    };
    await minioClient.setBucketPolicy(config.minio.bucket, JSON.stringify(policy));
  }

  console.log(`MinIO connected — bucket: ${config.minio.bucket}`);
}

export async function uploadFile(filename, buffer, contentType) {
  await minioClient.putObject(config.minio.bucket, filename, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  return getPublicUrl(filename);
}

export function getPublicUrl(filename) {
  return `/files/${filename}`;
}

export async function deleteFile(filename) {
  try {
    await minioClient.removeObject(config.minio.bucket, filename);
  } catch (err) {
    console.error(`Failed to delete file ${filename}:`, err.message);
  }
}

export async function getPresignedUploadUrl(filename, contentType) {
  return minioClient.presignedPutObject(config.minio.bucket, filename, 3600);
}
