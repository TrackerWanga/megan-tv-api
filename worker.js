export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      // ═══ HOME ═══
      if (path === '/' || path === '/api') {
        const stats = await env.TV_CACHE.get('stats', 'json') || {};
        return json({ 
          name: "Megan TV API", version: "2.0.0", codename: "Unified",
          description: "Live TV + Cartoons + PBS Kids + Pluto + Samsung",
          totalChannels: stats.totalChannels || 0,
          totalCountries: stats.totalCountries || 0,
          lastUpdated: stats.lastUpdated || null,
          endpoints: {
            // TV Channels
            countries: "/api/countries",
            country: "/api/country/:code",
            categories: "/api/categories",
            category: "/api/category/:name",
            search: "/api/search?q=CNN",
            stream: "/api/stream/:id",
            proxy: "/api/proxy/:id",
            // Cartoons
            cartoons: "/api/cartoons",
            cartoon: "/api/cartoon/:id",
            cartoonSearch: "/api/cartoons/search?q=spongebob",
            // PBS Kids
            pbskids: "/api/pbskids",
            pbsShow: "/api/pbskids/:slug",
            pbsVideo: "/api/pbskids/video/:id",
            // Platforms
            pluto: "/api/platform/pluto",
            samsung: "/api/platform/samsung",
            goliveafrica: "/api/platform/goliveafrica",
            // Health
            health: "/api/health",
            stats: "/api/stats",
          }
        }, cors);
      }

      // ═══ COUNTRIES ═══
      if (path === '/api/countries') {
        const data = await loadJSON(env, 'index/countries.json');
        return json(data || [], cors);
      }

      // ═══ COUNTRY ═══
      if (path.startsWith('/api/country/')) {
        const code = path.split('/')[3].toUpperCase();
        const onlineOnly = url.searchParams.get('online') !== 'false';
        let data = await loadJSON(env, `countries/${code}.json`);
        if (!data) return json({ error: "Country not found" }, cors, 404);
        if (onlineOnly && data.channels) {
          data.channels = data.channels.filter(c => c.online !== false);
          data.count = data.channels.length;
        }
        return json(data, cors);
      }

      // ═══ CATEGORIES ═══
      if (path === '/api/categories') {
        const data = await loadJSON(env, 'index/categories.json');
        return json(data || [], cors);
      }

      // ═══ CATEGORY ═══
      if (path.startsWith('/api/category/')) {
        const name = path.split('/')[3].toLowerCase();
        const data = await loadJSON(env, `categories/${name}.json`);
        if (!data) return json({ error: "Category not found" }, cors, 404);
        return json(data, cors);
      }

      // ═══ SEARCH (TV + Cartoons + PBS) ═══
      if (path === '/api/search') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        if (!q) return json({ error: "q required" }, cors, 400);
        
        const results = { tv: [], cartoons: [], pbskids: [] };
        
        // Search TV channels
        const cacheKey = `search:${q}`;
        let tvResults = await env.TV_CACHE.get(cacheKey, 'json');
        if (!tvResults) {
          const all = await loadJSON(env, 'index/all.json');
          if (all?.channels) {
            tvResults = all.channels.filter(c => 
              (c.name || '').toLowerCase().includes(q) ||
              (c.country || '').toLowerCase().includes(q) ||
              (c.category || '').toLowerCase().includes(q)
            ).slice(0, 30);
            await env.TV_CACHE.put(cacheKey, JSON.stringify(tvResults), { expirationTtl: 3600 });
          }
        }
        results.tv = tvResults || [];
        
        // Search cartoons
        const cartoons = await loadJSON(env, 'cartoons/index.json');
        if (cartoons?.channels) {
          results.cartoons = cartoons.channels.filter(c =>
            (c.name || '').toLowerCase().includes(q)
          ).slice(0, 20);
        }
        
        // Search PBS Kids
        const pbs = await loadJSON(env, 'pbskids/index.json');
        if (pbs?.shows) {
          results.pbskids = pbs.shows.filter(s =>
            (s.title || '').toLowerCase().includes(q)
          ).slice(0, 20);
        }
        
        const total = results.tv.length + results.cartoons.length + results.pbskids.length;
        return json({ query: q, totalResults: total, results }, cors);
      }

      // ═══ CARTOONS ═══
      if (path === '/api/cartoons') {
        const page = parseInt(url.searchParams.get('page') || '1');
        const perPage = parseInt(url.searchParams.get('perPage') || '20');
        const data = await loadJSON(env, 'cartoons/index.json');
        if (!data?.channels) return json({ error: "No cartoons available" }, cors, 404);
        
        const start = (page - 1) * perPage;
        const items = data.channels.slice(start, start + perPage);
        return json({
          success: true, page, perPage, total: data.channels.length,
          totalPages: Math.ceil(data.channels.length / perPage),
          cartoons: items
        }, cors);
      }

      // ═══ CARTOON DETAIL ═══
      if (path.startsWith('/api/cartoon/')) {
        const id = path.split('/')[3];
        const data = await loadJSON(env, 'cartoons/index.json');
        const cartoon = data?.channels?.find(c => c.id === id);
        if (!cartoon) return json({ error: "Cartoon not found" }, cors, 404);
        return json({ success: true, ...cartoon }, cors);
      }

      // ═══ CARTOON SEARCH ═══
      if (path === '/api/cartoons/search') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        if (!q) return json({ error: "q required" }, cors, 400);
        const data = await loadJSON(env, 'cartoons/index.json');
        const results = (data?.channels || []).filter(c =>
          (c.name || '').toLowerCase().includes(q)
        ).slice(0, 30);
        return json({ query: q, count: results.length, cartoons: results }, cors);
      }

      // ═══ PBS KIDS ═══
      if (path === '/api/pbskids') {
        const page = parseInt(url.searchParams.get('page') || '1');
        const perPage = parseInt(url.searchParams.get('perPage') || '20');
        const data = await loadJSON(env, 'pbskids/index.json');
        if (!data?.shows) return json({ error: "No PBS Kids data" }, cors, 404);
        
        const start = (page - 1) * perPage;
        const items = data.shows.slice(start, start + perPage);
        return json({
          success: true, page, perPage, total: data.shows.length,
          totalPages: Math.ceil(data.shows.length / perPage),
          shows: items
        }, cors);
      }

      // ═══ PBS KIDS SHOW ═══
      if (path.startsWith('/api/pbskids/') && !path.includes('/video/')) {
        const slug = path.split('/')[3];
        const data = await loadJSON(env, `pbskids/shows/${slug}.json`);
        if (!data) return json({ error: "Show not found" }, cors, 404);
        return json({ success: true, ...data }, cors);
      }

      // ═══ PBS KIDS VIDEO ═══
      if (path.startsWith('/api/pbskids/video/')) {
        const videoId = path.split('/')[4];
        // PBS videos are stored with their direct URLs
        const data = await loadJSON(env, `pbskids/videos/${videoId}.json`);
        if (!data) return json({ error: "Video not found" }, cors, 404);
        return json({ success: true, ...data }, cors);
      }

      // ═══ PLATFORMS ═══
      if (path.startsWith('/api/platform/')) {
        const platform = path.split('/')[3];
        const data = await loadJSON(env, `platforms/${platform}.json`);
        if (!data) return json({ error: "Platform not found" }, cors, 404);
        return json(data, cors);
      }

      // ═══ STREAM ═══
      if (path.startsWith('/api/stream/')) {
        const id = path.split('/')[3];
        const all = await loadJSON(env, 'index/all.json');
        const channel = all?.channels?.find(c => c.id === id);
        if (!channel) return json({ error: "Channel not found" }, cors, 404);
        return json({
          id: channel.id, name: channel.name, country: channel.country,
          category: channel.category, logo: channel.logo,
          streamUrl: channel.url, online: channel.online !== false,
          proxyUrl: `${url.origin}/api/proxy/${id}`,
        }, cors);
      }

      // ═══ PROXY ═══
      if (path.startsWith('/api/proxy/')) {
        const id = path.split('/')[3];
        const all = await loadJSON(env, 'index/all.json');
        const channel = all?.channels?.find(c => c.id === id);
        if (!channel) return new Response('Not found', { status: 404 });
        return await proxyStream(channel.url, url.origin, id);
      }

      // ═══ HEALTH / STATS ═══
      if (path === '/api/health') {
        return json({ status: 'healthy', uptime: Math.floor((Date.now() - START) / 1000) }, cors);
      }
      if (path === '/api/stats') {
        const [tv, cartoons, pbs] = await Promise.all([
          env.TV_CACHE.get('stats', 'json'),
          loadJSON(env, 'cartoons/index.json'),
          loadJSON(env, 'pbskids/index.json'),
        ]);
        return json({
          tv: { channels: tv?.totalChannels || 0, countries: tv?.totalCountries || 0 },
          cartoons: cartoons?.channels?.length || 0,
          pbskids: pbs?.shows?.length || 0,
          lastUpdated: tv?.lastUpdated || null,
        }, cors);
      }

      return json({ error: "Not found" }, cors, 404);
    } catch (err) {
      return json({ error: err.message }, cors, 500);
    }
  }
};

function json(data, cors, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

async function loadJSON(env, key) {
  try {
    const obj = await env.TV_STREAMS.get(key);
    if (obj) {
      const data = await obj.json();
      await env.TV_CACHE.put(key, JSON.stringify(data), { expirationTtl: 3600 });
      return data;
    }
  } catch (e) {}
  const cached = await env.TV_CACHE.get(key, 'json');
  return cached || null;
}

const START = Date.now();

async function proxyStream(streamUrl, origin, id) {
  const resp = await fetch(streamUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) return new Response('Stream unavailable', { status: 404 });
  let content = await resp.text();
  const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
  const lines = content.split('\n');
  const rewritten = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const segUrl = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
    return `${origin}/api/proxy/${id}/segment?url=${encodeURIComponent(segUrl)}`;
  });
  return new Response(rewritten.join('\n'), {
    headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }
  });
}
