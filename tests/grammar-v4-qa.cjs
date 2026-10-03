// Uses a loopback worker and synthetic accounts; all provider responses mocked.
process.env.QA_GRAMMAR_VERSION = '4';
require('./grammar-v2-qa.cjs');
