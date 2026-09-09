import type { APIRoute } from 'astro';
import { getAllWorkouts } from '../lib/workouts';

const staticPaths = ['/', '/workouts/', '/about/', '/app/'];
const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character);

export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('Astro site URL is required to generate the sitemap.');
  const workouts = await getAllWorkouts();
  const urls = [
    ...staticPaths.map((path) => ({ loc: new URL(path, site).href, lastmod: null })),
    ...workouts.map((workout) => ({ loc: new URL(`/workouts/${workout.slug}/`, site).href, lastmod: workout.date })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(({ loc, lastmod }) => `  <url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
