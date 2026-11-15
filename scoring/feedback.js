import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {nearStreet} from './review-view.js';
import path from 'node:path';
const directory=path.resolve(process.env.RAAH_DATA_DIR || '.raah-data');
const file=path.join(directory,'ratings.json');
const offers=new Map();
let writes=Promise.resolve();
export const tags=['Dark','Empty','Crowded','Shops open','Felt fine'];
const today=ms=>new Date(ms+19800000).toISOString().slice(0,10);
const digest=s=>createHash('sha256').update(s).digest('hex');
async function read() {
  try {return JSON.parse(await readFile(file,'utf8'));}
  catch(e){if(e.code==='ENOENT') return [];throw e;}
}
export function offer(lat,lon,night,demo) {
  const now=Date.now();
  for(const [k,v] of offers) if(v.until<now) offers.delete(k);
  const token=randomUUID(), segment=[lat.toFixed(4),lon.toFixed(4)].join(',');
  offers.set(token,{segment,night,demo,until:now+12*3600000});
  return {token,point:segment.split(',').map(Number)};
}
export async function saveRating(body,device) {
  const ref=offers.get(body.token);
  if(!ref || ref.until<Date.now()) throw Error('This feedback request has expired.');
  if(!['bad','okay','fine'].includes(body.rating) || !Array.isArray(body.tags) || body.tags.length>5 || !body.tags.every(t=>tags.includes(t))) throw Error('Invalid rating.');
  if(body.comment!==undefined && (typeof body.comment!=='string'||body.comment.length>240)) throw Error('Use up to 240 characters for the comment.');
  const comment=(body.comment||'').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
  const job=writes.then(async()=>{
    const now=Date.now(), day=today(now);
    const rows=(await read()).filter(r=>now-r.at<180*86400000);
    const user=digest(device+'|'+ref.segment+'|'+ref.demo);
    if(rows.some(r=>r.user===user && today(r.at)===day)) return false;
    rows.push({segment:ref.segment,night:ref.night,demo:ref.demo,user,comment,rating:body.rating,tags:[...new Set(body.tags)],at:now});
    await mkdir(directory,{recursive:true});
    const temp=file+'.'+randomUUID();await writeFile(temp,JSON.stringify(rows));await rename(temp,file);
    return true;
  });
  writes=job.catch(()=>{});return job;
}
export async function ratingSignals(demo,night) {
  const groups=new Map(), now=Date.now();
  for(const r of await read()) {
    if(r.demo!==demo || r.night!==night || now-r.at>180*86400000) continue;
    if(!groups.has(r.segment)) groups.set(r.segment,new Map());
    groups.get(r.segment).set(r.user,r);
  }
  const signals=[];
  for(const [key,users] of groups){
    if(users.size<3) continue;
    let sum=0, total=0;
    for(const r of users.values()){
      const w=2**(-(now-r.at)/(30*86400000)); total+=w; sum+=w*({bad:1,okay:0,fine:-1}[r.rating]);
    }
    if(total>=1.5 && Math.abs(sum/total)>=0.5) signals.push([...key.split(',').map(Number),sum>0?'negative':'positive']);
  }
  return signals;
}

export async function attachReviews(routes,demo) {
  const rows=(await read()).filter(r=>r.demo===demo && typeof r.comment==='string' && r.comment && Date.now()-r.at<180*86400000).sort((a,b)=>b.at-a.at);
  return routes.map(route=>({...route,reviews:rows.filter(r=>nearStreet(r.segment.split(',').map(Number),route.points)).slice(0,5).map(r=>({
    comment:r.comment,rating:r.rating,at:r.at,night:r.night,source:demo?'Practice review':'Street review'
  }))}));
}
