import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const normalizeUrl = (url) => (url || 'https://testcraft.ai').replace(/\/+$/, '');

const robotsTxt = (siteUrl) => `User-agent: *
Allow: /
Disallow: /api/
Disallow: /uploads/

Sitemap: ${siteUrl}/sitemap.xml
`;

const sitemapXml = (siteUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

// Generates robots.txt and sitemap.xml from VITE_SITE_URL for both dev and build.
const seoAssets = (siteUrl) => ({
  name: 'testcraft-seo-assets',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = (req.url || '').split('?')[0];
      if (url === '/robots.txt') {
        res.setHeader('Content-Type', 'text/plain');
        res.end(robotsTxt(siteUrl));
        return;
      }
      if (url === '/sitemap.xml') {
        res.setHeader('Content-Type', 'application/xml');
        res.end(sitemapXml(siteUrl));
        return;
      }
      next();
    });
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) });
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const siteUrl = normalizeUrl(env.VITE_SITE_URL);

  return {
    plugins: [react(), seoAssets(siteUrl)],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
