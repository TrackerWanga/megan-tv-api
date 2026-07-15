import json, re, os

with open('data/master.m3u', 'r', encoding='utf-8') as f:
    content = f.read()

channels = []
pattern = r'#EXTINF:-1 tvg-id="([^"]+)" tvg-logo="([^"]*)" group-title="([^"]*)",(.*?)\n(https?://[^\n]+)'
for m in re.finditer(pattern, content):
    tvg_id = m.group(1)
    parts = tvg_id.split('.')
    country = parts[1] if len(parts) > 1 else tvg_id[:2].upper()
    country = re.sub(r'@.*', '', country)[:3].upper()
    if len(country) < 2: continue
    channels.append({
        "id": tvg_id, "name": m.group(4).strip(), "logo": m.group(2),
        "category": m.group(3), "url": m.group(5).strip(),
        "country": country, "source": "iptv-org"
    })

print(f"IPTV-org: {len(channels)} channels")

# Add Pluto TV
pluto = [
    {"id": "pluto-movies", "name": "Pluto TV Movies", "category": "Movies", "url": "https://pluto-live.plutotv.net/pluto-01/pluto01/master.m3u8"},
    {"id": "pluto-action", "name": "Pluto TV Action", "category": "Action", "url": "https://pluto-live.plutotv.net/pluto-02/pluto02/master.m3u8"},
    {"id": "pluto-comedy", "name": "Pluto TV Comedy", "category": "Comedy", "url": "https://pluto-live.plutotv.net/pluto-03/pluto03/master.m3u8"},
    {"id": "pluto-kids", "name": "Pluto TV Kids", "category": "Kids", "url": "https://pluto-live.plutotv.net/pluto-06/pluto06/master.m3u8"},
    {"id": "pluto-sports", "name": "Pluto TV Sports", "category": "Sports", "url": "https://pluto-live.plutotv.net/pluto-07/pluto07/master.m3u8"},
    {"id": "pluto-news", "name": "Pluto TV News", "category": "News", "url": "https://pluto-live.plutotv.net/pluto-08/pluto08/master.m3u8"},
    {"id": "pluto-music", "name": "Pluto TV Music", "category": "Music", "url": "https://pluto-live.plutotv.net/pluto-09/pluto09/master.m3u8"},
    {"id": "pluto-anime", "name": "Pluto TV Anime", "category": "Animation;Anime", "url": "https://pluto-live.plutotv.net/pluto-12/pluto12/master.m3u8"},
    {"id": "pluto-nature", "name": "Pluto TV Nature", "category": "Documentary", "url": "https://pluto-live.plutotv.net/pluto-13/pluto13/master.m3u8"},
    {"id": "pluto-sci-fi", "name": "Pluto TV Sci-Fi", "category": "Science Fiction", "url": "https://pluto-live.plutotv.net/pluto-14/pluto14/master.m3u8"},
    {"id": "pluto-food", "name": "Pluto TV Food", "category": "Entertainment;Cooking", "url": "https://pluto-live.plutotv.net/pluto-17/pluto17/master.m3u8"},
    {"id": "pluto-crime", "name": "Pluto TV Crime", "category": "Entertainment;Crime", "url": "https://pluto-live.plutotv.net/pluto-19/pluto19/master.m3u8"},
]
for p in pluto:
    p["source"] = "pluto"
    p["country"] = "US"
    channels.append(p)
print(f"Pluto TV: {len(pluto)} channels")

# Add Samsung TV Plus
samsung = [
    {"id": "samsung-news", "name": "Samsung TV Plus - News", "category": "News", "url": "https://samsung-us.tizen.tv/live/usa/news.m3u8"},
    {"id": "samsung-movies", "name": "Samsung TV Plus - Movies", "category": "Movies", "url": "https://samsung-us.tizen.tv/live/usa/movies.m3u8"},
    {"id": "samsung-entertainment", "name": "Samsung TV Plus - Entertainment", "category": "Entertainment", "url": "https://samsung-us.tizen.tv/live/usa/entertainment.m3u8"},
    {"id": "samsung-kids", "name": "Samsung TV Plus - Kids", "category": "Kids", "url": "https://samsung-us.tizen.tv/live/usa/kids.m3u8"},
    {"id": "samsung-sports", "name": "Samsung TV Plus - Sports", "category": "Sports", "url": "https://samsung-us.tizen.tv/live/usa/sports.m3u8"},
]
for s in samsung:
    s["source"] = "samsung"
    s["country"] = "US"
    channels.append(s)
print(f"Samsung TV Plus: {len(samsung)} channels")

# Add GoLiveAfrica Kenya channels
golive = [
    {"id": "golive-capuchin", "name": "Capuchin TV", "category": "Religious", "url": "https://goliveafrica.media:9998/live/64227f58b8413/index.m3u8"},
    {"id": "golive-meru", "name": "Meru TV", "category": "General", "url": "https://goliveafrica.media:9998/live/628e5c1991061/index.m3u8"},
    {"id": "golive-mof", "name": "MOF TV", "category": "Religious", "url": "https://goliveafrica.media:9998/live/6425a6efa15c8/index.m3u8"},
    {"id": "golive-younib", "name": "Younib Media TV", "category": "Entertainment", "url": "https://goliveafrica.media:9998/live/6257fbe7383d6/index.m3u8"},
]
for g in golive:
    g["source"] = "goliveafrica"
    g["country"] = "KE"
    g["online"] = True
    channels.append(g)
print(f"GoLiveAfrica: {len(golive)} channels")

# Save
os.makedirs('data/index', exist_ok=True)
os.makedirs('data/countries', exist_ok=True)
os.makedirs('data/categories', exist_ok=True)

with open('data/index/all.json', 'w') as f:
    json.dump({"channels": channels, "total": len(channels)}, f)

countries = {}
for c in channels:
    cc = c['country']
    if cc not in countries: countries[cc] = []
    countries[cc].append(c)
for cc, chs in countries.items():
    with open(f'data/countries/{cc}.json', 'w') as f:
        json.dump({"country": cc, "channels": chs, "count": len(chs)}, f)

categories = {}
for c in channels:
    for cat in c['category'].split(';'):
        cat = cat.strip().lower()
        if cat not in categories: categories[cat] = []
        categories[cat].append(c)
for cat, chs in categories.items():
    with open(f'data/categories/{cat}.json', 'w') as f:
        json.dump({"category": cat, "channels": chs, "count": len(chs)}, f)

with open('data/index/countries.json', 'w') as f:
    json.dump([{"code": cc, "count": len(chs)} for cc, chs in sorted(countries.items())], f)
with open('data/index/categories.json', 'w') as f:
    json.dump([{"name": cat, "count": len(chs)} for cat, chs in sorted(categories.items())], f)

from datetime import datetime, timezone
with open('data/stats.json', 'w') as f:
    json.dump({
        "totalChannels": len(channels),
        "totalCountries": len(countries),
        "lastUpdated": datetime.now(timezone.utc).isoformat()
    }, f)

print(f"\nTOTAL: {len(channels)} channels, {len(countries)} countries, {len(categories)} categories")
