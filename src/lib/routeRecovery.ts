// Restore GitHub Pages' 404 redirect before BrowserRouter reads the location.
export function restoreStaticRoute() {
  const url = new URL(window.location.href);
  const route = url.searchParams.get('__nasa_route');
  const base = import.meta.env.BASE_URL;
  if (!route || url.pathname !== base) return;
  const destination = new URL(`${base}${route}`, url.origin);
  if (destination.origin !== url.origin || !destination.pathname.startsWith(base)) return;
  window.history.replaceState(null, '', destination.pathname + destination.search + destination.hash);
}
