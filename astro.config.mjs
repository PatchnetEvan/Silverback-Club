import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://silverbackbarbell.com',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
});
