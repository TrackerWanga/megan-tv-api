export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': '*' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      if (path === '/' || path === '/api') {
        const stats = await env.TV_CACHE.get('stats', 'json') || {};
        return json({ 
          name: "Megan TV API", version: "1.0.0",
          description: "13,000+ live TV channels from 200+ countries",
          totalChannels: stats.totalChannels || 0,
          totalCountries: stats.totalCountries || 0,
          lastUpdated: stats.lastUpdated || null,
          endpoints: {
            countries: "/api/countries",
            country: "/api/country/:code",
            categories: "/api/categories",
            category: "/api/category/:name",
            search: "/api/search?q=CNN",
            stream: "/api/stream/:id",
            proxy: "/api/proxy/:id",
          }
        }, cors);
      }

      if (path === '/api/countries') {
        const data = await loadJSON(env, 'index/countries.json');
        return json(data || [], cors);
      }

      if (path.startsWith('/api/country/')) {
        const code = path.split('/')[3].toUpperCase();
        const data = await loadJSON(env, `countries/${code}.json`);
        if (!data) return json({ error: "Country not found" }, cors, 404);
        return json(data, cors);
      }

      if (path === '/api/categories') {
        const data = await loadJSON(env, 'index/categories.json');
        return json(data || [], cors);
      }

      if (path.startsWith('/api/category/')) {
        const name = path.split('/')[3].toLowerCase();
        const data = await loadJSON(env, `categories/${name}.json`);
        if (!data) return json({ error: "Category not found" }, cors, 404);
        return json(data, cors);
      }

      if (path === '/api/search') {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        if (!q) return json({ error: "q required" }, cors, 400);
        const cacheKey = `search:${q}`;
        let results = await env.TV_CACHE.get(cacheKey, 'json');
        if (!results) {
          const allChannels = await loadJSON(env, 'index/all.json');
          if (allChannels?.channels) {
            results = allChannels.channels.filter(c => 
              (c.name || '').toLowerCase().includes(q) || (c.country || '').toLowerCase().includes(q)
            ).slice(0, 50);
            await env.TV_CACHE.put(cacheKey, JSON.stringify(results), { expirationTtl: 3600 });
          } else { results = []; }
        }
        return json({ query: q, count: results.length, channels: results }, cors);
      }

      if (path.startsWith('/api/stream/')) {
        const id = path.split('/')[3];
        const allChannels = await loadJSON(env, 'index/all.json');
        const channel = allChannels?.channels?.find(c => c.id === id);
        if (!channel) return json({ error: "Channel not found" }, cors, 404);
        return json({
          id: channel.id, name: channel.name, country: channel.country,
          category: channel.category, logo: channel.logo,
          streamUrl: channel.url,
          proxyUrl: `${url.origin}/api/proxy/${id}`,
          embedUrl: channel.youtubeId ? `https://www.youtube.com/embed/${channel.youtubeId}?autoplay=1` : null,
        }, cors);
      }

      if (path.startsWith('/api/proxy/')) {
        const id = path.split('/')[3];
        const allChannels = await loadJSON(env, 'index/all.json');
        const channel = allChannels?.channels?.find(c => c.id === id);
        if (!channel) return new Response('Not found', { status: 404 });
        return await proxyStream(channel.url, url.origin, id);
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
  // Try R2 first (always fresh), then fall back to KV
  try {
    const obj = await env.TV_STREAMS.get(key);
    if (obj) {
      const data = await obj.json();
      // Cache in KV for faster next read
      await env.TV_CACHE.put(key, JSON.stringify(data), { expirationTtl: 3600 });
      return data;
    }
  } catch (e) {}
  
  // Fall back to KV if R2 fails
  const cached = await env.TV_CACHE.get(key, 'json');
  return cached || null;
}

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
