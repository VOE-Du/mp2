import { expect, test, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const collections = ['nebula', 'galaxy', 'mars rover', 'moon apollo', 'earth from space', 'space shuttle launch'];
const names = ['Nebula', 'Galaxy', 'Mars', 'Moon', 'Earth', 'Shuttle'];
function record(index: number, second = false) {
  const id = `${names[index]}-${second ? 'B' : 'A'}`;
  return {
    data: [{ nasa_id: id, title: `${names[index]} ${second ? 'Beta' : 'Alpha'}`, description: `The ${names[index]} observation from Hubble.`, date_created: `${second ? '2020' : '2000'}-01-0${index + 1}T00:00:00Z`, center: second ? 'GSFC' : 'JPL', keywords: ['Hubble', names[index]], secondary_creator: 'NASA test credit' }],
    links: [{ href: `https://images-assets.nasa.gov/image/${id}/thumb.jpg`, rel: 'preview', render: 'image' }],
  };
}
async function mockNasa(page: Page) {
  await page.route('https://images-api.nasa.gov/search**', async route => {
    const params = new URL(route.request().url()).searchParams;
    const nasaId = params.get('nasa_id');
    const index = Math.max(0, collections.indexOf(params.get('q') ?? ''));
    const outside = record(0);
    outside.data[0].nasa_id = 'OutsideCatalog';
    outside.data[0].title = 'Outside catalog image';
    const items = nasaId ? [...names.flatMap((_, i) => [record(i), record(i, true)]), outside].filter(item => item.data[0].nasa_id === nasaId) : [record(index), record(index, true)];
    await route.fulfill({ json: { collection: { items } } });
  });
  await page.route('https://images-assets.nasa.gov/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#263954"/><circle cx="300" cy="220" r="120" fill="#72937b"/></svg>' }));
}

test('instant search, sort directions, and clearing results', async ({ page }) => {
  await mockNasa(page); await page.goto('./');
  await expect(page.locator('.list-card')).toHaveCount(12);
  await page.getByRole('searchbox', { name: 'Search the archive' }).fill('Nebula');
  await expect(page.locator('.list-card')).toHaveCount(2);
  await page.getByLabel('Sort by', { exact: true }).selectOption('title');
  await page.getByRole('button', { name: /Descending order/ }).click();
  await expect(page.locator('.list-card h3').first()).toHaveText('Nebula Alpha');
  await page.getByRole('button', { name: /Ascending order/ }).click();
  await expect(page.locator('.list-card h3').first()).toHaveText('Nebula Beta');
  await page.getByLabel('Sort by', { exact: true }).selectOption('date');
  await expect(page.locator('.list-card h3').first()).toHaveText('Nebula Beta');
  await page.getByRole('searchbox', { name: 'Search the archive' }).fill('impossible query');
  await expect(page.getByText('No images on this trajectory.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset search' }).click();
  await expect(page.locator('.list-card')).toHaveCount(12);
});

test('gallery multi-selection, center filter, details and navigation preserve context', async ({ page }) => {
  await mockNasa(page); await page.goto('gallery');
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByLabel('Sort by', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Choose your perspective.' })).toBeVisible();
  const filterBottom = await page.locator('.gallery-filter-panel').evaluate(element => element.getBoundingClientRect().bottom);
  const galleryTop = await page.locator('.gallery-grid').evaluate(element => element.getBoundingClientRect().top);
  expect(filterBottom).toBeLessThan(galleryTop);
  await page.getByRole('button', { name: 'Nebulae', exact: true }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Galaxies', exact: true }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(4);
  await page.getByLabel('Filter by NASA center').selectOption('JPL');
  await expect(page.locator('.gallery-card')).toHaveCount(2);
  const firstTitle = await page.locator('.gallery-card h3').first().textContent();
  await page.locator('.gallery-card').first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(firstTitle!);
  await expect(page.getByRole('link', { name: 'Gallery', exact: true })).toHaveClass(/active/);
  await expect(page).toHaveURL(/topic=nebulae&topic=galaxies/);
  await page.getByRole('link', { name: /^NEXT/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(firstTitle!);
  await page.getByRole('link', { name: /^NEXT/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(firstTitle!);
  await page.getByRole('link', { name: /^PREVIOUS/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(firstTitle!);
  await page.getByRole('link', { name: 'Back to archive' }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(2);
});

test('search and gallery keep separate controls and URL state', async ({ page }) => {
  await mockNasa(page); await page.goto('./?q=Nebula&sort=title&order=asc');
  await expect(page.locator('.list-card')).toHaveCount(2);
  await page.getByRole('link', { name: 'Gallery', exact: true }).click();
  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.locator('.gallery-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Mars', exact: true }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(2);
  await page.getByRole('link', { name: 'Explore', exact: true }).click();
  await expect(page).toHaveURL(/\/mp2\/$/);
  await expect(page.locator('.list-card')).toHaveCount(12);
  await expect(page.getByRole('searchbox', { name: 'Search the archive' })).toHaveValue('');
});

test('list detail links, direct URLs, refresh, and one-item navigation', async ({ page }) => {
  await mockNasa(page); await page.goto('./?q=Nebula%20Alpha');
  await page.locator('.list-card').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nebula Alpha');
  await expect(page.getByRole('button', { name: 'NEXT', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nebula Alpha');
  await page.goto('image/Mars-B');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mars Beta');
  await expect(page.getByText('NASA test credit', { exact: true })).toBeVisible();
  await page.goto('image/missing-record');
  await expect(page.getByText('This image was not found in NASA’s archive.')).toBeVisible();
});

test('failed API requests recover using retry', async ({ page }) => {
  await page.route('https://images-api.nasa.gov/**', route => route.abort());
  await page.goto('./');
  await expect(page.getByText('Connection interrupted')).toBeVisible();
  await page.unroute('https://images-api.nasa.gov/**');
  await mockNasa(page);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.list-card')).toHaveCount(12);
});

test('outside-catalog navigation survives NEXT, PREVIOUS, refresh and both boundaries', async ({ page }) => {
  await mockNasa(page);
  await page.goto('image/OutsideCatalog');
  await expect(page.locator('h1')).toHaveText('Outside catalog image');
  await expect(page.locator('.detail-position')).toContainText('1 / 13');
  await page.getByRole('link', { name: /^NEXT/ }).click();
  await expect(page).toHaveURL(/anchor=OutsideCatalog/);
  await page.reload();
  await expect(page.locator('.detail-position')).toContainText('2 / 13');
  await page.getByRole('link', { name: /^PREVIOUS/ }).click();
  await expect(page.locator('h1')).toHaveText('Outside catalog image');
  await page.getByRole('link', { name: /^PREVIOUS/ }).click();
  await expect(page.locator('.detail-position')).toContainText('13 / 13');
  await page.getByRole('link', { name: /^NEXT/ }).click();
  await expect(page.locator('h1')).toHaveText('Outside catalog image');
  await page.getByRole('link', { name: 'Back to archive' }).click();
  await expect(page).not.toHaveURL(/anchor=/);
  await expect(page.locator('.list-card')).toHaveCount(12);
});

test('production static 404 fallback restores direct routes, parameters and hashes', async ({ page }) => {
  // Serve built files without Vite's SPA rewrite, just like GitHub Pages.
  const root = resolve('dist');
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const path = resolve(root, decodeURIComponent(pathname.replace(/^\/mp2\//, '')) || 'index.html');
    const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
    try {
      if (!pathname.startsWith('/mp2/') || !path.startsWith(root + sep)) throw new Error('Not found');
      const content = await readFile(path);
      response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' });
      response.end(content);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/html' });
      response.end(await readFile(resolve(root, '404.html')));
    }
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Static test server failed');
  try {
    await mockNasa(page);
    const url = `http://127.0.0.1:${address.port}/mp2/image/Nebula-A?q=Nebula&sort=title&order=asc&view=list#details`;
    await page.goto(url);
    await expect(page.locator('h1')).toHaveText('Nebula Alpha');
    await expect(page).toHaveURL(url);
    await page.reload();
    await expect(page.locator('h1')).toHaveText('Nebula Alpha');
    await expect(page).toHaveURL(url);
    await expect(page.locator('script:not([src]), [style], table')).toHaveCount(0);
    await page.goto(`http://127.0.0.1:${address.port}/mp2/gallery?topic=nebulae&topic=galaxies&center=JPL`);
    await expect(page.locator('.gallery-card')).toHaveCount(2);
    await expect(page).toHaveURL(/topic=nebulae&topic=galaxies&center=JPL$/);
  } finally {
    await page.close();
    await new Promise<void>((done, reject) => server.close(error => error ? reject(error) : done()));
  }
});

test('partial results remain usable and retry recovers missing collections', async ({ page }) => {
  await mockNasa(page);
  await page.route('https://images-api.nasa.gov/search**', route => new URL(route.request().url()).searchParams.get('q') === 'nebula' ? route.abort() : route.fallback());
  await page.goto('gallery');
  await expect(page.getByText('Some collections are unavailable')).toBeVisible();
  await expect(page.locator('.gallery-card')).toHaveCount(10);
  await page.unroute('https://images-api.nasa.gov/search**');
  await mockNasa(page);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.gallery-card')).toHaveCount(12);
  await expect(page.getByText('Some collections are unavailable')).toHaveCount(0);
});

test('mobile layout, broken images, and no inline styles or layout tables', async ({ page }) => {
  await mockNasa(page);
  await page.route('https://images-assets.nasa.gov/**', route => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('gallery');
  await expect(page.locator('.gallery-card')).toHaveCount(12);
  await expect(page.getByText('Image unavailable').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Vite injects a React refresh script in development; the production HTML has only an external script.
  await expect(page.locator('[style], table')).toHaveCount(0);
  await page.locator('.gallery-card').first().click();
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('live NASA archive and visual screenshots', async ({ page }) => {
  test.skip(process.env.NASA_LIVE_TEST !== '1', 'Opt-in live API check');
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('gallery');
  await expect(page.locator('.gallery-card').first()).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => { const image = document.querySelector('.gallery-card img') as HTMLImageElement | null; return image?.complete && image.naturalWidth > 0; });
  await page.screenshot({ path: 'test-results/nasa-desktop.png', fullPage: false });
  await page.locator('.gallery-card').first().click();
  await expect(page.locator('.detail-description')).toBeVisible();
  await page.screenshot({ path: 'test-results/nasa-details.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('gallery');
  await expect(page.locator('.gallery-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/nasa-mobile.png', fullPage: false });
});
