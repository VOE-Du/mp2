export const topics = [
  { id: 'nebulae', name: 'Nebulae', query: 'nebula' },
  { id: 'galaxies', name: 'Galaxies', query: 'galaxy' },
  { id: 'mars', name: 'Mars', query: 'mars rover' },
  { id: 'moon', name: 'The Moon', query: 'moon apollo' },
  { id: 'earth', name: 'Earth', query: 'earth from space' },
  { id: 'missions', name: 'Spaceflight', query: 'space shuttle launch' },
] as const;

export interface SpaceImage {
  id: string;
  title: string;
  description: string;
  date: string;
  center: string;
  credit: string;
  location: string;
  keywords: string[];
  image: string;
  original: string;
  topics: string[];
}

export type SortKey = 'date' | 'title' | 'center';
export interface Filters {
  query: string;
  topics: string[];
  center: string;
  sort: SortKey;
  direction: 'asc' | 'desc';
}

export function readFilters(params: URLSearchParams): Filters {
  const sort = params.get('sort');
  return {
    query: params.get('q') ?? '',
    topics: params.getAll('topic').filter(id => topics.some(topic => topic.id === id)),
    center: params.get('center') ?? '',
    sort: sort === 'title' || sort === 'center' ? sort : 'date',
    direction: params.get('order') === 'asc' ? 'asc' : 'desc',
  };
}

export function filterImages(images: SpaceImage[], filters: Filters): SpaceImage[] {
  const terms = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return images.filter(item => {
    const haystack = [item.title, item.description, item.id, item.center, ...item.keywords].join(' ').toLocaleLowerCase();
    return terms.every(term => haystack.includes(term)) &&
      (!filters.topics.length || filters.topics.some(topic => item.topics.includes(topic))) &&
      (!filters.center || item.center === filters.center);
  }).sort((a, b) => {
    const comparison = filters.sort === 'date'
      ? a.date.localeCompare(b.date)
      : a[filters.sort].localeCompare(b[filters.sort], 'en', { sensitivity: 'base', numeric: true });
    return (filters.direction === 'asc' ? comparison : -comparison) || a.id.localeCompare(b.id);
  });
}

export function adjacentImages(images: SpaceImage[], id: string) {
  const index = images.findIndex(image => image.id === id);
  if (index < 0 || images.length < 2) return { previous: undefined, next: undefined, index };
  return {
    previous: images[(index - 1 + images.length) % images.length],
    next: images[(index + 1) % images.length],
    index,
  };
}
