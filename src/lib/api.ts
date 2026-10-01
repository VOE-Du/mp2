import axios from 'axios';
import { topics, type SpaceImage } from './catalog';

interface NasaItem {
  data?: {
    nasa_id: string; title: string; description?: string; description_508?: string;
    date_created?: string; center?: string; keywords?: string[];
    photographer?: string; secondary_creator?: string; location?: string;
  }[];
  links?: { href: string; rel?: string; render?: string }[];
}
interface SearchResponse { collection: { items: NasaItem[] } }

const api = axios.create({ baseURL: 'https://images-api.nasa.gov', timeout: 20000 });
const cacheKey = 'nasa-explorer.catalog.v1';
const cacheLifetime = 1000 * 60 * 60 * 12;
let pending: Promise<CatalogResult> | undefined;
export interface CatalogResult { images: SpaceImage[]; failedTopics: string[]; cached: boolean }

// NASA descriptions sometimes contain HTML. Parse to text, never render API HTML.
function plainText(value: string): string {
  const doc = new DOMParser().parseFromString(value, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(item: NasaItem, topicIds: string[] = []): SpaceImage | undefined {
  const data = item.data?.[0];
  const preview = item.links?.find(link => link.rel === 'preview' && link.render === 'image')?.href
    ?? item.links?.find(link => link.render === 'image')?.href;
  if (!data || !preview || !preview.startsWith('https://')) return;
  return {
    id: data.nasa_id, title: plainText(data.title),
    description: plainText(data.description_508 || data.description || 'No description provided by NASA.'),
    date: data.date_created ?? '', center: data.center || 'Not specified',
    credit: data.photographer || data.secondary_creator || `NASA / ${data.center || 'Image Library'}`,
    location: data.location || 'Not specified', keywords: data.keywords ?? [], image: preview,
    original: item.links?.find(link => link.rel === 'canonical')?.href ?? preview,
    topics: topicIds,
  };
}

async function fetchCatalog(): Promise<CatalogResult> {
  const results = await Promise.allSettled(topics.map(async topic => {
    const { data } = await api.get<SearchResponse>('/search', {
      params: { q: topic.query, media_type: 'image', page_size: 24 },
    });
    return data.collection.items.map(item => normalize(item, [topic.id])).filter((item): item is SpaceImage => Boolean(item));
  }));
  const images = new Map<string, SpaceImage>();
  const failedTopics: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected' || !result.value.length) { failedTopics.push(topics[index].name); return; }
    result.value.forEach(item => {
      const existing = images.get(item.id);
      if (existing) existing.topics = [...new Set([...existing.topics, ...item.topics])];
      else images.set(item.id, item);
    });
  });
  if (!images.size) throw new Error('NASA’s archive could not be reached. Check your connection and try again.');
  const catalog = { images: [...images.values()], failedTopics, cached: false };
  // Do not cache a partial response: retry must be able to recover missing collections.
  if (!failedTopics.length) {
    try { localStorage.setItem(cacheKey, JSON.stringify({ ...catalog, savedAt: Date.now() })); } catch { /* Storage may be unavailable. */ }
  }
  return catalog;
}

export async function loadCatalog(force = false): Promise<CatalogResult> {
  if (!force) {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) ?? 'null');
      if (cached && Date.now() - cached.savedAt < cacheLifetime && Array.isArray(cached.images) && cached.images.length) {
        return { images: cached.images, failedTopics: [], cached: true };
      }
    } catch { /* Ignore invalid or inaccessible cache. */ }
  }
  if (!pending) pending = fetchCatalog().finally(() => { pending = undefined; });
  return pending;
}

export async function loadImage(id: string, signal: AbortSignal): Promise<SpaceImage> {
  const { data } = await api.get<SearchResponse>('/search', { params: { nasa_id: id, media_type: 'image' }, signal });
  const image = data.collection.items.map(item => normalize(item)).find(item => item?.id === id);
  if (!image) throw new Error('This image was not found in NASA’s archive.');
  return image;
}
