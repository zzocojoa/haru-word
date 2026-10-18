declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    word_image_pilot_enabled?: string;
    BUCKET?: R2Bucket;
    word_image_upload_key?: string;
    word_image_upload_expires?: string;
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
    grammar_practice_v4_enabled?: string;
  english_accuracy_token?: string;
  english_accuracy_expires?: string;
  english_accuracy_profile?: string;
  }
}
