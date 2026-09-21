import { env } from "cloudflare:workers";
export function database():D1Database {if(!env.DB)throw new Error("D1_UNAVAILABLE");return env.DB;}
