// Exercise the retained 8 MB fallback independently of the new job pipeline.
// large-backup-qa.cjs exercises the enabled production path without this override.
async function legacyRestore(context) {
  await context.route('**/api/state/restore', route => route.request().method()==='GET'
    ? route.fulfill({json:{enabled:false,maxBytes:8_000_000,partBytes:1_800_000}})
    : route.continue());
}
module.exports={legacyRestore};
