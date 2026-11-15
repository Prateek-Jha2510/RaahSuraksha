import {randomUUID} from 'node:crypto';
import {saveRating,attachReviews} from './scoring/feedback.js';
import {explanation} from './scoring/explain.js';
import {recommend} from './scoring/recommend.js';
import {assess} from './scoring/service.js';
import {scenario} from './src/data/walks.js';
// One shared queue and response cache per provider for this single-process campus app.
function provider(base, fetcher) {
  let tail = Promise.resolve();
  let nextStart = 0;
  const cache = new Map();
  return path => {
    const hit = cache.get(path);
    if (hit && hit.expires > Date.now()) return hit.result;
    const result = tail.then(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, nextStart - Date.now())));
      nextStart = Date.now() + 1100;
      const res = await fetcher(base.replace(/\/$/, '') + path, {
        headers: { 'User-Agent': 'RaahSuraksha-DTU-CampusPlanner/0.3', Accept: 'application/json' },
        signal: AbortSignal.timeout(12000)
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); if (['NoRoute','NoSegment'].includes(body.code)) return {routes:[]}; throw new Error('Provider unavailable'); }
      return res.json();
    });
    tail = result.catch(() => {cache.delete(path);});
    if (cache.size >= 256) cache.delete(cache.keys().next().value);
    cache.set(path, { expires: Date.now() + 3600000, result });
    return result;
  };
}

export function services(env = {}, fetcher = fetch) {
  const search = provider(env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org', fetcher);
  const suggest = provider(env.PHOTON_URL || 'https://photon.komoot.io', fetcher);
  const walk = provider(env.OSRM_FOOT_URL || 'https://routing.openstreetmap.de/routed-foot', fetcher);
  return async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    function send(status, body) {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    }
    try {
      if(req.method==='POST' && ['/explain','/rating'].includes(url.pathname)){
        if(req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) return send(403,{error:'Origin mismatch.'});
        if(!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'JSON required.'});
        let text='';
        for await(const chunk of req){text+=chunk;if(text.length>4096)return send(413,{error:'Request too large.'});}
        try {
          const body=JSON.parse(text);
          if(url.pathname==='/explain')return send(200,{text:await explanation(body,env,fetcher)});
          let device=req.headers.cookie?.match(/(?:^|; )raah_device=([a-f0-9-]{36})(?:;|$)/)?.[1];
          if(!device){device=randomUUID();res.setHeader('Set-Cookie','raah_device='+device+'; HttpOnly; SameSite=Strict; Path=/api; Max-Age=15552000');}
          return send(200,{saved:await saveRating(body,device)});
        } catch(e){return send(400,{error:e.code?'Feedback store unavailable.':e.message});}
      }
      if (req.method !== 'GET') return send(405, {error:'Use GET.'});
      if (url.pathname === '/places' || url.pathname === '/suggest') {
        const q = (url.searchParams.get('q') || '').trim().replace(/\s+/g,' ').toLowerCase();
        if (q.length < 3 || q.length > 160) return send(400,{error:'Enter a place name between 3 and 160 characters.'});
        if(url.pathname==='/suggest'){
          const params=new URLSearchParams({q,countrycode:'IN',lang:'en',limit:'8',lat:'28.75',lon:'77.117'});
          const data=await suggest('/api/?'+params);
          const matches=[],seen=new Set();
          for(const f of data.features){
            const p=f.properties||{}, xy=f.geometry?.coordinates;
            if(p.countrycode?.toUpperCase()!=='IN'||f.geometry?.type!=='Point'||!Array.isArray(xy))continue;
            const point=[xy[1],xy[0]];
            const street=[p.housenumber,p.street].filter(Boolean).join(' ');
            const name=[...new Set([p.name,street,p.district,p.city,p.state,p.postcode].filter(Boolean))].join(', ');
            if(!name||!validPoint(point)||seen.has(name))continue;
            seen.add(name);matches.push({name,point});
            if(matches.length===5)break;
          }
          return send(200,matches);
        }
        const params = new URLSearchParams({q, format:'jsonv2', limit:'5', countrycodes:'in', 'accept-language':'en', viewbox:'76.96,28.88,77.31,28.58'});
        const matches = await search('/search?' + params);
        return send(200, matches.map(m => ({name:m.display_name, point:[Number(m.lat),Number(m.lon)]})));
      }
      const time=url.searchParams.get('time') || '';
      if(time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return send(400,{error:'Choose a valid departure time.'});
      const safer=['Alternate','Safer'].includes(url.searchParams.get('preference')),limit=Number(url.searchParams.get('limit')??10);
      if(!Number.isFinite(limit)||limit<0||limit>120) return send(400,{error:'Choose a detour between 0 and 120 minutes.'});
      if(url.pathname === '/demo'){
        const demo=scenario(url.searchParams.get('walk') || 'library');
        if(!demo)return send(404,{error:'Unknown demo walk.'});
        const fixtures=demo.routes.map(r=>({id:r.id,label:demo.id==='library'?(r.id==='faster'?'Side lane':'Library approach'):r.label,points:r.points,minutes:r.minutes,seconds:r.minutes*60,
          metres:Math.round(r.points.slice(1).reduce((sum,[lat,lon],i)=>sum+111195*Math.hypot(lat-r.points[i][0],(lon-r.points[i][1])*Math.cos(lat*Math.PI/180)),0))})).sort((a,b)=>a.seconds-b.seconds);
        const ranked=await recommend(await assess(fixtures,time,{demo:true,demoObservations:demo.observations}),safer,limit);
        const routes=await attachReviews(ranked,true);
        for(const [i,r] of routes.entries()) r.reviews.push({source:'Seeded example',comment:demo.notes[i],rating:'okay'});
        return send(200,{from:demo.from,to:demo.to,title:demo.title,routes});
      }
      if (url.pathname !== '/routes') return send(404,{error:'Unknown request.'});
      const points = ['from','to'].map(k => (url.searchParams.get(k) || '').split(',').map(v => v.trim() ? Number(v) : NaN));
      if (!points.every(validPoint)) return send(400,{error:'Choose a valid start and destination.'});
      if (points[0].toString() === points[1].toString()) return send(400,{error:'Choose two different places.'});
      const coords = points.map(([lat,lon]) => lon + ',' + lat).join(';');
      const data = await walk('/route/v1/foot/' + coords + '?alternatives=true&geometries=geojson&overview=full');
      const routes = (data.routes || []).filter(r => Number.isFinite(r.duration) && Number.isFinite(r.distance) && r.geometry?.type === 'LineString' && r.geometry.coordinates.length >= 2)
        .map((r,id) => ({id, seconds:r.duration, minutes:Math.max(1,Math.round(r.duration/60)), metres:r.distance, points:r.geometry.coordinates.map(([lon,lat]) => [lat,lon])}))
        .filter(r => r.points.every(validPoint)).sort((a,b) => a.seconds-b.seconds);
      if (!routes.length) return send(422,{error:'No walking route found. Try a nearby street or a different endpoint.'});
      const ranked=await recommend(await assess(routes,time,{endpoint:env.OVERPASS_URL,fetcher}),safer,limit);
      send(200,await attachReviews(ranked,false));
    } catch { send(503,{error:'The map service could not complete this request. Please try again.'}); }
  };
}
function validPoint(p) {return p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;}
