// Resource Timing is a discovery source, not permission to fetch arbitrary URLs.
export function staticModuleUrls(names: string[], origin: string): string[] {
  return [...new Set(names.flatMap(name => {
    try {
      const url = new URL(name);
      return url.origin === origin && !url.username && !url.password &&
        /^\/_next\/static\/(?:chunks\/)?[\w~-]+\.js$/.test(url.pathname) ? [url.href] : [];
    } catch { return []; }
  }))];
}
