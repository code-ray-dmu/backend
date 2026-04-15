module.exports = {
  apps: [
    {
      name: 'code-ray-api',
      script: 'dist/apps/api/main.js',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'code-ray-worker',
      script: 'dist/apps/worker/main.js',
      instances: 3,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
