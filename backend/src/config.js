const config = {
  port: parseInt(process.env.PORT || '3000'),
  host: '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    accessKey: process.env.MINIO_ACCESS_KEY || 'menu4d_admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'menu4d_secret_key',
    bucket: process.env.MINIO_BUCKET || 'menu4d-files',
    useSSL: process.env.MINIO_USE_SSL === 'true',
  },
  cache: {
    menuTTL: 3600, // 1 hour - menu rarely changes
    keyPrefix: 'menu4d:',
  },
};

export default config;
