declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    google_api?: string;
    google_ai_enabled?: string;
    large_backup_restore_enabled?: string;
    grammar_enabled?: string;
  }
}
