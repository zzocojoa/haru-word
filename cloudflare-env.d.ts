declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    google_api?: string;
    groq_api?: string;
    groq_ai_enabled?: string;
    google_ai_enabled?: string;
    large_backup_restore_enabled?: string;
    grammar_enabled?: string;
    grammar_practice_v2_enabled?: string;
  }
}
