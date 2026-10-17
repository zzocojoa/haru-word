// A route handler can return before the response body finishes. Count the
// browser's request lifetime instead, scoped to one page/controller.
function trackRequestConcurrency(page, matches) {
  const pending = new Set();
  let maximum = 0;
  const started = request => {
    if (!matches(request)) return;
    pending.add(request); maximum = Math.max(maximum, pending.size);
  };
  const ended = request => { pending.delete(request); };
  page.on('request', started);
  page.on('requestfinished', ended);
  page.on('requestfailed', ended);
  return {
    get active() { return pending.size; },
    get maximum() { return maximum; },
    dispose() {
      page.off('request', started);
      page.off('requestfinished', ended);
      page.off('requestfailed', ended);
      pending.clear();
    },
  };
}
module.exports = { trackRequestConcurrency };
