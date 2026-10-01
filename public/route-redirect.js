// GitHub Pages serves 404.html for client routes. Send the original route to
// index.html, preserving its query and hash without using inline JavaScript.
(() => {
  const script = document.currentScript;
  if (!script) return;
  const base = new URL('.', script.src).pathname;
  if (!window.location.pathname.startsWith(base)) return;
  const route = window.location.pathname.slice(base.length) + window.location.search + window.location.hash;
  const destination = new URL(base, window.location.origin);
  destination.searchParams.set('__nasa_route', route);
  window.location.replace(destination.href);
})();
