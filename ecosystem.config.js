module.exports = {
  apps: [
    {
      name: 'bk-dashboard',
      script: 'server.js',
      cwd: '/var/www/bkbot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'bk-bot',
      script: 'index.js',
      cwd: '/var/www/bkbot',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
