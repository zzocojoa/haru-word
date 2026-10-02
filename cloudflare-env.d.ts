declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    card_studio_enabled?: string;
    card_studio_owner_id?: string;
    card_studio_bridge_secret?: string;
    card_studio_origin?: string;
    BUCKET?: R2Bucket;
    google_api?: string;
    groq_api?: string;
    groq_ai_enabled?: string;
    google_ai_enabled?: string;
    feedback_original_sentence_enabled?: string;
    feedback_chunked_enabled?: string;
    large_backup_restore_enabled?: string;
    grammar_enabled?: string;
    grammar_practice_v2_enabled?: string;
    grammar_practice_v3_enabled?: string;
  english_accuracy_token?: string;
  english_accuracy_expires?: string;
  english_accuracy_profile?: string;
  }
}
