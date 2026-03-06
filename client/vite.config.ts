import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://nginx:80',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    {
      name: 'serve-shared-data',
      configureServer(server) {
        server.middlewares.use('/shared', (req, res, next) => {
          const filePath = path.resolve('/var/www/shared', req.url!.replace(/^\//, ''));
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.setHeader('Content-Type', 'application/json');
            fs.createReadStream(filePath).pipe(res);
          } else {
            next();
          }
        });
      },
    },
  ],
  build: {
    outDir: 'dist',
  },
});
