import { env } from 'cloudflare:workers';
import index from '@/data/word-image-hosting-index.json';
import { serveWordImage } from '@/lib/server/word-image-hosting';
export const dynamic = 'force-dynamic';
function image(request: Request) { return serveWordImage(request, env, index.images); }
export { image as GET, image as HEAD, image as PUT };
