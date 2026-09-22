export const dynamic='force-dynamic';
// This endpoint exposes only the public server clock, never learner data.
export function GET(){return Response.json({serverTime:Date.now()},{headers:{'Cache-Control':'no-store'}})}
