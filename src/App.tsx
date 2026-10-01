import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, ChevronRight, CircleHelp, ExternalLink, Grid2X2, ImageOff, List, Orbit, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { loadCatalog, loadImage, type CatalogResult } from './lib/api';
import { adjacentImages, filterImages, readFilters, topics, type Filters, type SpaceImage } from './lib/catalog';

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function Image({ item, eager = false }: { item: SpaceImage; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.image]);
  return failed ? <div className="image-fallback"><ImageOff /><span>Image unavailable</span></div>
    : <img src={item.image} alt={item.title} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />;
}

function Header() {
  const { pathname, search } = useLocation();
  const detailSource = new URLSearchParams(search).get('view');
  const galleryDetail = pathname.startsWith('/image/') && detailSource === 'gallery';
  return <header className="header"><div className="shell header-inner">
    <Link to="/" className="brand" aria-label="NASA Explorer home"><span className="brand-mark"><Orbit size={27} /></span><span>NASA<span className="brand-slash">/</span><span className="brand-light">EXPLORER</span></span></Link>
    <nav aria-label="Main navigation">
      <NavLink to="/" end className={pathname.startsWith('/image/') && !galleryDetail ? 'active' : undefined}>Explore</NavLink>
      <NavLink to="/gallery" className={({ isActive }) => isActive || galleryDetail ? 'active' : undefined}>Gallery</NavLink>
      <NavLink to="/about">About the archive <ArrowUpRight size={13} /></NavLink>
    </nav>
    <span className="header-status"><span className="status-dot" /> THE UNIVERSE IS OPEN</span>
  </div></header>;
}

function Notice({ title, children, retry }: { title: string; children: React.ReactNode; retry?: () => void }) {
  return <div className="notice" role="status"><CircleHelp size={21} /><div><strong>{title}</strong><p>{children}</p></div>{retry && <button className="button secondary" onClick={retry}><RefreshCw size={15} /> Try again</button>}</div>;
}

function Loading() {
  return <div className="loading" role="status"><Orbit className="spinning" size={32} /><span>Connecting to the cosmos…</span><small>Retrieving images from NASA’s archive</small></div>;
}

function Browse({ catalog, loading, error, retry, gallery = false }: {
  catalog?: CatalogResult; loading: boolean; error: string; retry: () => void; gallery?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const storedFilters = readFilters(params);
  // Each route owns only the controls required for that view. This prevents a
  // hidden search query from affecting Gallery, or hidden gallery filters from
  // affecting the searchable List View.
  const filters: Filters = gallery
    ? { ...storedFilters, query: '', sort: 'date' as const, direction: 'desc' as const }
    : { ...storedFilters, topics: [], center: '' };
  const images = catalog?.images ?? [];
  const results = filterImages(images, filters);
  const centers = [...new Set(images.map(image => image.center))].sort();
  const hero = images.find(image => image.topics.includes('nebulae'));
  const activeCount = gallery
    ? filters.topics.length + Number(Boolean(filters.center))
    : Number(Boolean(filters.query));
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }
  function toggleTopic(id: string) {
    const selected = filters.topics.includes(id) ? filters.topics.filter(topic => topic !== id) : [...filters.topics, id];
    const next = new URLSearchParams(params);
    next.delete('topic'); selected.forEach(topic => next.append('topic', topic));
    setParams(next, { replace: true });
  }
  function toDetail(id: string) {
    const next = new URLSearchParams();
    if (gallery) {
      filters.topics.forEach(topic => next.append('topic', topic));
      if (filters.center) next.set('center', filters.center);
    } else {
      if (filters.query) next.set('q', filters.query);
      next.set('sort', filters.sort);
      next.set('order', filters.direction);
    }
    next.set('view', gallery ? 'gallery' : 'list');
    return `/image/${encodeURIComponent(id)}?${next.toString()}`;
  }
  return <>
    {!gallery && <section className="hero shell">
      <div className="hero-copy"><p className="eyebrow"><span className="tiny-cross">+</span> NASA IMAGE ARCHIVE <span className="eyebrow-line" /></p>
        <h1>A universe<br />to <em>discover.</em></h1>
        <p className="hero-description">From our blue planet to the edge of the cosmos.<br className="desktop-break" /> Explore the extraordinary through NASA’s lens.</p>
        <a className="button primary" href="#archive">Explore the archive <ArrowRight size={17} /></a>
        <div className="hero-meta"><span><span className="status-dot" /> OPEN ACCESS</span><span>POWERED BY NASA</span><span>01 — ∞</span></div>
      </div>
      <div className="hero-visual">
        {hero && <Image item={hero} eager />}
        <div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" />
        <div className="hero-coordinate top">OBSERVATION / DEEP SPACE</div><div className="hero-coordinate bottom">LOOK BEYOND THE FAMILIAR <Sparkles size={12} /></div>
        <span className="visual-cross cross-top">+</span><span className="visual-cross cross-bottom">+</span>
        <div className="image-caption"><span className="caption-number">01</span><div><span>IN FOCUS</span><p>{hero?.title ?? 'The cosmos awaits'}</p></div><ArrowUpRight size={18} /></div>
      </div>
    </section>}
    <section className={`archive shell${gallery ? ' gallery-archive' : ''}`} id="archive" aria-labelledby="archive-title">
      <div className="section-heading"><div><p className="eyebrow">{gallery ? 'THE NASA VISUAL INDEX' : 'YOUR WINDOW INTO SPACE'}</p><h2 id="archive-title">{gallery ? 'Choose your perspective' : 'Explore the archive'}<span className="heading-dot">.</span></h2>{gallery && <p className="gallery-intro">Select one or more collections, then explore the images below.</p>}</div><span className="archive-note"><Orbit size={16} /> SIX COLLECTIONS. ENDLESS PERSPECTIVES.</span></div>
      {!gallery && <div className="search-toolbar">
        <label className="search-field"><Search size={19} /><span className="sr-only">Search the archive</span><input type="search" placeholder="Search images, missions, keywords…" value={filters.query} onChange={event => update('q', event.target.value)} />{filters.query && <button aria-label="Clear search" onClick={() => update('q', '')}><X size={16} /></button>}</label>
        <div className="sort-control"><SlidersHorizontal size={16} /><label htmlFor="sort">Sort by</label><select id="sort" value={filters.sort} onChange={event => update('sort', event.target.value)}><option value="date">Date created</option><option value="title">Title</option><option value="center">NASA center</option></select><button className="direction-button" aria-label={filters.direction === 'asc' ? 'Ascending order; switch to descending' : 'Descending order; switch to ascending'} title={filters.direction === 'asc' ? 'Ascending' : 'Descending'} onClick={() => update('order', filters.direction === 'asc' ? 'desc' : 'asc')}>{filters.direction === 'asc' ? <ArrowUp size={17} /> : <ArrowDown size={17} />}<span>{filters.direction === 'asc' ? 'ASC' : 'DESC'}</span></button></div>
      </div>}
      {gallery && <div className="gallery-filter-panel">
        <div className="gallery-filter-header"><div className="filter-copy"><span className="filter-step">01</span><div><strong>Collection</strong><p>Choose as many subjects as you like.</p></div></div><label className="center-filter"><span>NASA center</span><select aria-label="Filter by NASA center" value={filters.center} onChange={event => update('center', event.target.value)}><option value="">All NASA centers</option>{centers.map(center => <option key={center}>{center}</option>)}</select></label></div>
        <div className="topic-filters" role="group" aria-label="Filter by collection"><button className={!filters.topics.length ? 'chip selected' : 'chip'} aria-pressed={!filters.topics.length} onClick={() => { const next = new URLSearchParams(params); next.delete('topic'); setParams(next, { replace: true }); }}>All collections</button>{topics.map(topic => <button key={topic.id} className={filters.topics.includes(topic.id) ? 'chip selected' : 'chip'} aria-pressed={filters.topics.includes(topic.id)} onClick={() => toggleTopic(topic.id)}>{filters.topics.includes(topic.id) && <Check size={12} />}{topic.name}</button>)}</div>
      </div>}
      <div className="results-toolbar"><p aria-live="polite"><strong>{results.length}</strong> images <span>in {gallery && filters.topics.length ? 'selected collections' : gallery ? 'all collections' : 'the search index'}</span>{activeCount > 0 && <button className="reset-link" onClick={() => { const next = new URLSearchParams(params); (gallery ? ['topic', 'center'] : ['q']).forEach(key => next.delete(key)); setParams(next, { replace: true }); }}>{gallery ? 'Clear filters' : 'Clear search'} <X size={12} /></button>}</p><span className="result-mode">{gallery ? <Grid2X2 size={14} /> : <List size={15} />}{gallery ? 'VISUAL GALLERY' : 'SEARCH RESULTS'}</span></div>
      {error && <Notice title="Connection interrupted" retry={retry}>{error}</Notice>}
      {catalog?.failedTopics.length ? <Notice title="Some collections are unavailable" retry={retry}>You can still explore the available images. Missing collections: {catalog.failedTopics.join(', ')}.</Notice> : null}
      {loading ? <Loading /> : !error && results.length === 0 ? <div className="empty-state">{gallery ? <Grid2X2 size={32} /> : <Search size={32} />}<h3>No images on this trajectory.</h3><p>{gallery ? 'Choose another collection or NASA center.' : 'Try another title, mission, keyword, or NASA center.'}</p><button className="button secondary" onClick={() => setParams({}, { replace: true })}>{gallery ? 'Reset gallery filters' : 'Reset search'}</button></div> : gallery ?
        <div className="gallery-grid">{results.map((item, index) => <Link to={toDetail(item.id)} key={item.id} className="gallery-card"><div className="card-image"><Image item={item} eager={index < 4} /><span className="image-index">{String(index + 1).padStart(3, '0')}</span><span className="card-open"><ArrowUpRight size={19} /></span></div><div className="card-body"><div className="card-meta"><span>{topics.find(topic => topic.id === item.topics[0])?.name ?? 'NASA archive'}</span><span>{item.center}</span></div><h3>{item.title}</h3><p>{dateLabel(item.date)} <ArrowUpRight size={15} /></p></div></Link>)}</div> :
        <div className="image-list">{results.map((item, index) => <Link to={toDetail(item.id)} key={item.id} className="list-card"><span className="list-index">{String(index + 1).padStart(3, '0')}</span><div className="list-image"><Image item={item} eager={index < 3} /></div><div className="list-content"><div className="card-meta"><span>{topics.find(topic => topic.id === item.topics[0])?.name ?? 'NASA archive'}</span><span>{item.center}</span></div><h3>{item.title}</h3><p>{item.description}</p></div><div className="list-date"><span>DATE CREATED</span><time dateTime={item.date}>{dateLabel(item.date)}</time></div><ArrowUpRight className="list-arrow" size={22} /></Link>)}</div>}
      {!loading && results.length > 0 && <div className="archive-end"><span />END OF COLLECTION · KEEP LOOKING UP<span /></div>}
    </section>
  </>;
}

function Details({ catalog, loading }: { catalog?: CatalogResult; loading: boolean }) {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const anchorId = params.get('anchor') || id;
  const [remote, setRemote] = useState<SpaceImage>();
  const [remoteAnchor, setRemoteAnchor] = useState<SpaceImage>();
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const existing = catalog?.images.find(image => image.id === id);
  const item = existing ?? (remote?.id === id ? remote : undefined);
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    setError('');
    if (existing) { setFetching(false); return; }
    const controller = new AbortController();
    setFetching(true);
    loadImage(id, controller.signal).then(image => {
      setRemote(image);
      if (image.id === anchorId) setRemoteAnchor(image);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load this image.');
    }).finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [id, existing, attempt, anchorId]);
  // Carry the independently opened record through navigation and page refreshes.
  // Its ID lives in the URL, while its metadata is retained within this view.
  useEffect(() => {
    if (anchorId === id || catalog?.images.some(image => image.id === anchorId) || remoteAnchor?.id === anchorId) return;
    const controller = new AbortController();
    loadImage(anchorId, controller.signal).then(setRemoteAnchor).catch(() => {
      // An unavailable anchor must not prevent the current image from opening.
    });
    return () => controller.abort();
  }, [anchorId, id, catalog, remoteAnchor]);
  useEffect(() => {
    document.title = item ? `${item.title} — NASA Explorer` : 'Image details — NASA Explorer';
    return () => { document.title = 'NASA Explorer — A universe to discover'; };
  }, [item]);
  const filtered = filterImages(catalog?.images ?? [], readFilters(params));
  const anchor = catalog?.images.find(image => image.id === anchorId)
    ?? (remoteAnchor?.id === anchorId ? remoteAnchor : undefined)
    ?? (item?.id === anchorId ? item : undefined);
  const extraAnchor = anchor && !filtered.some(image => image.id === anchor.id) ? anchor : undefined;
  const anchoredSequence = extraAnchor ? [extraAnchor, ...filtered] : filtered;
  const sequence = item && !anchoredSequence.some(image => image.id === item.id) ? [item, ...anchoredSequence] : anchoredSequence;
  const { previous, next, index } = adjacentImages(sequence, id);
  const backParams = new URLSearchParams(params); backParams.delete('view'); backParams.delete('anchor');
  const back = `${params.get('view') === 'gallery' ? '/gallery' : '/'}${backParams.size ? `?${backParams}` : ''}`;
  function itemUrl(image: SpaceImage) {
    const nextParams = new URLSearchParams(params);
    if (extraAnchor) nextParams.set('anchor', extraAnchor.id);
    return `/image/${encodeURIComponent(image.id)}${nextParams.size ? `?${nextParams}` : ''}`;
  }
  return <main className="shell detail-page"><div className="detail-top"><Link to={back} className="back-link"><ArrowLeft size={16} /> Back to archive</Link><span className="mono">IMAGE RECORD / {item?.id ?? id}</span></div>
    {!item && (fetching || loading) ? <Loading /> : error && !item ? <Notice title="Image unavailable" retry={() => setAttempt(value => value + 1)}>{error}</Notice> : item && <>
      <div className="detail-layout"><div className="detail-photo"><Image item={item} eager /><div className="detail-photo-label"><span>NASA IMAGE LIBRARY</span><span>{item.center}</span></div></div><article className="detail-copy"><p className="eyebrow">ANOTHER PERSPECTIVE ON OUR UNIVERSE</p><h1>{item.title}</h1><p className="detail-description">{item.description}</p><dl className="metadata"><div><dt>Date created</dt><dd>{dateLabel(item.date)}</dd></div><div><dt>NASA center</dt><dd>{item.center}</dd></div><div><dt>Image credit</dt><dd>{item.credit}</dd></div><div><dt>Location</dt><dd>{item.location}</dd></div><div><dt>NASA ID</dt><dd>{item.id}</dd></div><div><dt>Media type</dt><dd>Image</dd></div></dl>{item.keywords.length > 0 && <div className="keyword-section"><h2>Keywords</h2><div className="keyword-tags">{item.keywords.map((keyword, i) => <span key={`${keyword}-${i}`}>{keyword}</span>)}</div></div>}<a className="button secondary" href={`https://images.nasa.gov/details/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer">View NASA source <ExternalLink size={15} /></a></article></div>
      <nav className="detail-navigation" aria-label="Browse images">{previous ? <Link to={itemUrl(previous)} className="detail-nav-link"><ArrowLeft size={21} /><div><span>PREVIOUS</span><p>{previous.title}</p></div></Link> : <button className="detail-nav-link" disabled><ArrowLeft size={21} /> PREVIOUS</button>}<span className="detail-position">{index + 1} / {sequence.length}<small>{sequence.length > 1 ? 'LOOP THROUGH THE COLLECTION' : 'ONE IMAGE IN THIS COLLECTION'}</small></span>{next ? <Link to={itemUrl(next)} className="detail-nav-link next"><div><span>NEXT</span><p>{next.title}</p></div><ArrowRight size={21} /></Link> : <button className="detail-nav-link next" disabled>NEXT <ArrowRight size={21} /></button>}</nav>
    </>}
  </main>;
}

function About() {
  return <main className="shell about-page"><p className="eyebrow">CURIOSITY HAS NO BOUNDARIES</p><h1>The universe,<br /><em>through NASA’s lens.</em></h1><p>NASA Explorer is an independent student project that brings together six themed collections from the NASA Image and Video Library. Every image, date, description, and credit comes from NASA’s public archive.</p><div className="about-grid"><article><Search /><h2>Search the archive</h2><p>The Explore page searches titles, descriptions, keywords, NASA IDs, and centers as you type. Results can be sorted by title, creation date, or NASA center in either direction.</p></article><article><Grid2X2 /><h2>Browse the gallery</h2><p>The separate Gallery page begins with visual collection and NASA center filters. Open any image for its story and use Previous and Next to cycle through the current selection.</p></article><article><Sparkles /><h2>Open to everyone</h2><p>This application uses NASA’s public Image and Video Library API, which requires no API key. Images are loaded in six curated batches of up to 24 and cached locally for 12 hours.</p></article></div><p className="about-disclosure">Search and sorting apply to the loaded collection, not the entire NASA archive. Collection labels reflect the NASA search used to retrieve each image. This project is not affiliated with or endorsed by NASA.</p><Link to="/" className="button primary">Start exploring <ArrowRight size={16} /></Link></main>;
}

export default function App() {
  const [catalog, setCatalog] = useState<CatalogResult>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    loadCatalog(attempt > 0).then(data => { if (active) setCatalog(data); }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to reach NASA’s archive.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const browseProps = { catalog, loading, error, retry: () => setAttempt(value => value + 1) };
  return <><a className="skip-link" href="#main">Skip to content</a><Header /><div id="main"><Routes><Route path="/" element={<main><Browse {...browseProps} /></main>} /><Route path="/gallery" element={<main><Browse {...browseProps} gallery /></main>} /><Route path="/image/:id" element={<Details catalog={catalog} loading={loading} />} /><Route path="/about" element={<About />} /><Route path="*" element={<main className="shell empty-state"><h1>Lost in space?</h1><p>This page is outside our orbit.</p><Link className="button primary" to="/">Return to the archive <ChevronRight size={16} /></Link></main>} /></Routes></div><footer className="footer shell"><Link to="/" className="footer-brand"><Orbit size={19} /> NASA / EXPLORER</Link><span>A LITTLE CURIOSITY. AN INFINITE UNIVERSE.</span></footer></>;
}
