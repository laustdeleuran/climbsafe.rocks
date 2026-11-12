import { defineConfig } from 'astro/config';

// For GitHub project pages (https://<user>.github.io/<repo>), set ASTRO_BASE
// to "/<repo>" before building, e.g. ASTRO_BASE=/climb-safe npm run build.
// For a user/organization site repo (<user>.github.io), leave it unset.
export default defineConfig({
  site: process.env.ASTRO_SITE || 'https://example.github.io',
  base: process.env.ASTRO_BASE || '/',
});
