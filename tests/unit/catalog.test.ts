import { describe, expect, it } from 'vitest';
import { adjacentImages, filterImages, readFilters, type SpaceImage } from '../../src/lib/catalog';

function image(id: string, title: string, date: string, center: string, topic: string): SpaceImage {
  return { id, title, date, center, topics: [topic], description: 'A distant star', keywords: ['Hubble'], image: '', original: '', credit: '', location: '' };
}
const images = [image('a', 'Zebra Nebula', '2001-01-01', 'JPL', 'nebulae'), image('b', 'Andromeda', '2020-01-01', 'GSFC', 'galaxies'), image('c', 'Mars rover', '2015-01-01', 'JPL', 'mars')];
const defaults = readFilters(new URLSearchParams());

describe('NASA catalog behavior', () => {
  it('filters as text changes, ignoring case and excess spaces', () => {
    expect(filterImages(images, { ...defaults, query: '  ZEBRA   hubble ' }).map(item => item.id)).toEqual(['a']);
    expect(filterImages(images, { ...defaults, query: 'not in the archive' })).toEqual([]);
  });
  it('matches metadata keywords and NASA IDs', () => {
    expect(filterImages(images, { ...defaults, query: 'Hubble' })).toHaveLength(3);
    expect(filterImages(images, { ...defaults, query: 'b GSFC' }).map(item => item.id)).toEqual(['b']);
  });
  it('combines multi-topic OR with center and search AND', () => {
    expect(filterImages(images, { ...defaults, topics: ['nebulae', 'mars'], center: 'JPL' })).toHaveLength(2);
    expect(filterImages(images, { ...defaults, topics: ['nebulae', 'mars'], center: 'JPL', query: 'rover' }).map(item => item.id)).toEqual(['c']);
  });
  it.each([
    ['title', 'asc', ['b', 'c', 'a']], ['title', 'desc', ['a', 'c', 'b']],
    ['date', 'asc', ['a', 'c', 'b']], ['date', 'desc', ['b', 'c', 'a']],
    ['center', 'asc', ['b', 'a', 'c']], ['center', 'desc', ['a', 'c', 'b']],
  ] as const)('sorts by %s in %s order', (sort, direction, ids) => {
    expect(filterImages(images, { ...defaults, sort, direction }).map(item => item.id)).toEqual(ids);
  });
  it('wraps next and previous at collection boundaries', () => {
    expect(adjacentImages(images, 'a').previous?.id).toBe('c');
    expect(adjacentImages(images, 'c').next?.id).toBe('a');
  });
  it('handles a missing item, singleton and empty collection', () => {
    expect(adjacentImages([], 'a').next).toBeUndefined();
    expect(adjacentImages([images[0]], 'a').previous).toBeUndefined();
    expect(adjacentImages(images, 'missing').index).toBe(-1);
  });
  it('reads repeated topics and rejects invalid sort values', () => {
    expect(readFilters(new URLSearchParams('topic=mars&topic=earth&topic=invalid&sort=invalid&order=asc'))).toEqual({ ...defaults, topics: ['mars', 'earth'], direction: 'asc' });
  });
  it('does not mutate the original collection while sorting', () => {
    filterImages(images, defaults);
    expect(images.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });
});
