// Reuse the complete 15-lesson flow with the explicitly enabled v3 catalog.
process.env.QA_GRAMMAR_VERSION = '3';
require('./grammar-v2-qa.cjs');
