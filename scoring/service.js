import {ratingSignals,offer} from './feedback.js';
import {execFile} from 'node:child_process';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import weights from './weights.json' with {type:'json'};
import seed from './dtu-seed.json' with {type:'json'};

const labels = ['No data','Low','Medium','High'];
const factors = ['Mapped lighting','Places with known hours','Activity / isolation observations','Street ratings'];
const pending = new Map();
export const unknown = reason => ({risk:null,confidence:'No data',coverage:0,factors:[],reason});

function hoursValue(hours, minute) {
  if (hours === '24/7') return 0;
  // Recognize only unconditional daily intervals; more complex schedules stay unknown.
  if (!hours || !/^(?:[01]\d|2[0-3]):[0-5]\d-(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)(?:\s*,\s*(?:[01]\d|2[0-3]):[0-5]\d-(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00))*$/.test(hours)) return null;
  const minutes = s => Number(s.slice(0,2))*60 + Number(s.slice(3));
  let ambiguous=false;
  for(const interval of hours.split(/\s*,\s*/)) {
    const [a,b]=interval.split('-').map(minutes);
    if(a===b) {ambiguous=true;continue;}
    if(a<b ? minute>=a && minute<b : minute>=a || minute<b) return 0;
  }
  return ambiguous ? null : 1;
}
function signalsAt(observations,minute) {
  const kinds = {lamp:[0,0],unlit:[0,1],active:[2,0],isolated:[2,1],negative:[3,1],positive:[3,0]};
  return observations.flatMap(([lat,lon,kind,hours])=>{
    const pair = kind==='venue' ? [1,hoursValue(hours,minute)] : kinds[kind];
    return Number.isFinite(lat) && Number.isFinite(lon) && pair && pair[1] !== null ? [[lat,lon,...pair]] : [];
  });
}
export function score(route, observations, minute) {
  const signals=signalsAt(observations,minute);
  const w=weights;
  const night=minute>=1200 || minute<360;
  const header=[w.lighting,w.openPlaces,w.isolation,w.ratings,w.nightLightingMultiplier,w.nightActivityMultiplier,w.nightRiskMultiplier,Number(night),route.points.length,signals.length];
  const input=[header,...route.points,...signals].map(row=>row.join(' ')).join('\n');
  return new Promise((resolve,reject)=>{
    const child=execFile(process.env.RAAH_SCORER || path.resolve('build',process.platform==='win32'?'scorer.exe':'scorer'),[],{timeout:5000,windowsHide:true},(err,out)=>{
      if(err) return reject(err);
      const [summary,segments='',candidate='']=out.trim().split(/\r?\n/);
      const [raw,level,coverage,...lengths]=summary.split(/\s+/).map(Number);
      resolve({candidate:candidate ? candidate.split(/\s+/).map(Number) : null,risk:raw<0?null:raw,confidence:labels[level],coverage,segmentConfidence:Array.from(segments,n=>labels[Number(n)]),
        factors:factors.map((label,i)=>({label,metres:lengths[i],adverseMetres:lengths[4+i]})).filter(x=>x.metres>0).sort((a,b)=>b.metres-a.metres).slice(0,2)});
    });
    child.stdin.on('error',()=>{}); child.stdin.end(input);
  });
}

async function loadArea(bounds, endpoint,fetcher) {
  const key=bounds.join('_');
  const file=path.resolve('.cache','overpass',key+'.json');
  try {
    const cached=JSON.parse(await readFile(file,'utf8'));
    if(cached.endpoint===endpoint && Date.now()-cached.at<86400000 && Array.isArray(cached.rows)) return cached.rows;
  } catch { /* Cache miss. */ }
  const query='[out:json][timeout:8][bbox:'+bounds.join(',')+'];(node[highway=street_lamp];node[highway][lit~"^(yes|no)$"];node[highway=bus_stop];nwr[shop];nwr[amenity~"^(pharmacy|fuel|hospital)$"];);out center;';
  const res=await fetcher(endpoint,{method:'POST',body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(10500)});
  if(!res.ok) throw Error('Overpass unavailable');
  const data=await res.json();
  if(data.remark || !Array.isArray(data.elements)) throw Error('Incomplete response');
  const rows=data.elements.flatMap(e=>{
    const tags=e.tags || {};
    const point=[e.lat??e.center?.lat,e.lon??e.center?.lon];
    const rows=[];
    if(tags.highway==='street_lamp' || tags.lit==='yes') rows.push([...point,'lamp']);
    if(tags.lit==='no') rows.push([...point,'unlit']);
    // A separate mapped transit stop is an activity proxy, not a head count.
    if(tags.highway==='bus_stop') rows.push([...point,'active']);
    if(tags.shop || tags.amenity) rows.push([...point,'venue',tags.opening_hours]);
    return rows;
  });
  try {
    await mkdir(path.dirname(file),{recursive:true});
    const temp=file+'.'+randomUUID()+'.tmp';
    await writeFile(temp,JSON.stringify({endpoint,at:Date.now(),rows})); await rename(temp,file);
  } catch { /* Live results remain usable without disk caching. */ }
  return rows;
}
export async function assess(routes,time,{demo=false,demoObservations=seed.observations,endpoint='https://overpass-api.de/api/interpreter',fetcher=fetch}={}) {
  // IST uses UTC+05:30 year-round, including on mobile runtimes without ICU.
  const clock=time || new Date(Date.now() + 330 * 60000).toISOString().slice(11,16);
  const [h,m]=clock.split(':').map(Number);
  let observations=demoObservations;
  if(!demo){
    const b=[90,180,-90,-180];
    for(const route of routes) for(const [lat,lon] of route.points) {
      b[0]=Math.min(b[0],lat); b[1]=Math.min(b[1],lon); b[2]=Math.max(b[2],lat); b[3]=Math.max(b[3],lon);
    }
    const bounds=b.map((v,i)=>i<2 ? Math.floor((v-.001)*100)/100 : Math.ceil((v+.001)*100)/100);
    if((bounds[2]-bounds[0])*(bounds[3]-bounds[1])>.012) return routes.map(r=>({...r,safety:unknown('Outside the campus-scale data query limit.')}));
    const key=endpoint+bounds.join(',');
    try {
      if(!pending.has(key)) pending.set(key,loadArea(bounds,endpoint,fetcher).finally(()=>pending.delete(key)));
      observations=await pending.get(key);
    } catch {return routes.map(r=>({...r,safety:unknown('Overpass data unavailable.')}));}
  }
  const minute=h*60+m, night=minute>=1200 || minute<360;
  const ratings=await ratingSignals(demo,night).catch(()=>[]);
  observations=observations.concat(ratings);
  return Promise.all(routes.map(async r=>{
    try{
      const {candidate,...safety}=await score(r,observations,minute);
      return {...r,feedback:candidate?offer(...candidate,night,demo):null,safety:{...safety,source:demo?'Seeded DTU demo':'OpenStreetMap'}};
    }
    catch {return {...r,safety:unknown('C++ scorer unavailable. Run npm run scorer and retry.')};}
  }));
}
