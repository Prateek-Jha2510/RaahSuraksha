import React,{useEffect,useRef,useState} from 'react';
import CampusMap from './CampusMap.jsx';
import PlaceField from './PlaceField.jsx';
import {walks} from '../data/walks.js';
import ThemeToggle from './ThemeToggle.jsx';
import Trip from './Trip.jsx';
import Rating from './Rating.jsx';

function locate(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(Error('Enter a starting place to continue.'));
    navigator.geolocation.getCurrentPosition(p=>resolve({name:'My location',point:[p.coords.latitude,p.coords.longitude]}),()=>reject(Error('Location unavailable. Search for a starting place.')),{timeout:10000,maximumAge:30000});
  });
}
function distance(m){return m<1000?Math.round(m)+' m':(m/1000).toFixed(1)+' km';}
function Explanation({trip,extra}){
  const [text,setText]=useState('');
  useEffect(()=>{
    let current=true;const controller=new AbortController();
    const route=trip.selected,s=route.safety,mode=!route.recommended?'Manual':route.selectionUnavailable?'Faster':trip.preference;
    const fallback=(mode==='Manual'?'You selected this route.':mode==='Faster'?'This is the quickest available walk.':s.risk===null?'No scored route fits the detour limit.':'This route has the lowest observed risk index within the limit.')+' '+(s.confidence==='Low'?'Available evidence is limited.':'Confidence: '+s.confidence+'.');
    setText(fallback);
    fetch('/api/explain',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({mode,extra,risk:s.risk,confidence:s.confidence,coverage:s.coverage})})
      .then(r=>r.json()).then(data=>{if(current && typeof data.text==='string')setText(data.text);}).catch(()=>{});
    return ()=>{current=false;controller.abort();};
  },[trip,extra]);
  return <p className="explanation">{text}</p>;
}
export default function Planner(){
  const [from,setFrom]=useState({name:'My location',gps:true}),[to,setTo]=useState(null);
  const [pref,setPref]=useState('Alternate'),[time,setTime]=useState(''),[limit,setLimit]=useState('10');
  const [trip,setTrip]=useState(null),[travel,setTravel]=useState(false),[feedback,setFeedback]=useState(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[hi,setHi]=useState(false),[notice,setNotice]=useState('');
  const [walk,setWalk]=useState('library');
  const audio=useRef(null),t=(en,hindi)=>hi?hindi:en;
  useEffect(()=>{document.documentElement.lang=hi?'hi':'en';},[hi]);
  async function find(e,demo=false){
    e.preventDefault();if(busy)return;setError('');setNotice('');
    if(pref==='Alternate' && (!limit.trim() || !Number.isInteger(+limit)||+limit<0||+limit>120)){setError('Choose 0 to 120 extra minutes.');return;}
    if(!demo && (!from||!to)){setError('Search and choose a match for each place.');return;}
    setBusy(true);
    try{
      const origin=!demo&&from.gps?await locate():from;
      const params=new URLSearchParams({time,walk,preference:pref,limit:pref==='Alternate'?limit:'0'});
      if(!demo){params.set('from',origin.point.join(','));params.set('to',to.point.join(','));}
      const res=await fetch('/api/'+(demo?'demo':'routes')+'?'+params), data=await res.json();
      if(!res.ok)throw Error(data.error);
      const result=demo?data:{from:origin,to,routes:data};
      setTrip({...result,preference:pref,demo,selected:result.routes.find(r=>r.recommended)||result.routes[0]});
      window.scrollTo(0,0);
    }catch(e){setError(e.message||'Routing unavailable. Try the DTU demo.');}
    finally{setBusy(false);}
  }
  function start(){
    try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio.current ||= new Audio();audio.current.resume().catch(()=>{});}}catch{}
    setTravel(true);window.scrollTo(0,0);
  }
  function finish(offer){setTravel(false);setFeedback(offer?{offer,demo:trip.demo}:null);setTrip(null);setNotice('Trip ended.');audio.current?.close().catch(()=>{});audio.current=null;}
  const selected=trip?.selected,s=selected?.safety,extra=trip?Math.ceil(Math.max(0,selected.seconds-trip.routes[0].seconds)/60):0;
  return <main className="app"><header className="topbar"><span className="wordmark"><span className="brand-mark" aria-hidden="true">↗</span>Raah Suraksha</span>
    <div className="header-actions"><ThemeToggle/><button type="button" className="chip" lang={hi?'en':'hi'} onClick={()=>setHi(!hi)}>{hi?'English':'हिन्दी'}</button></div></header>
    {travel?<Trip trip={trip} onEnd={finish} t={t} audioRef={audio}/>:<div className="workspace"><CampusMap trip={trip}/><section className="sheet"><div className="sheet-inner">
    <p className="location">{trip?.demo?trip.title+' · Demo':t('Walking routes','पैदल मार्ग')}</p>
    <h1>{trip?t('Your walking route','आपका पैदल मार्ग'):t('Plan your route','अपना मार्ग चुनें')}</h1>
    {trip?<><p className="itinerary">{trip.from.name} → {trip.to.name}</p>
      <div className="summary"><div className="duration"><strong>{selected.minutes}</strong> min</div><div>+{extra} min vs fastest<br/>{distance(selected.metres)} · {time||'Now'} IST</div></div>
      <p className="confidence">{t('Confidence','विश्वास स्तर')} · {s.confidence}</p>
      <section className="score-shell" aria-label="Route score and street comments">
        <div className="score-head"><div><p className="metric-label">Observed risk index</p><strong className="score-number">{s.risk??'—'}</strong>{s.risk!==null&&<span> / 100</span>}</div>
        <div className="coverage"><p className="metric-label">Evidence coverage</p><strong>{s.coverage}%</strong><progress value={s.coverage} max="100" aria-label="Evidence coverage"/></div></div>
        <h2>Street comments</h2>
        {selected.reviews?.length?selected.reviews.map((review,i)=><blockquote key={i}><p>{review.comment}</p><footer>{review.source}{review.at?' · '+new Date(review.at).toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'Asia/Kolkata'})+(review.night?' · Night':' · Day'):''}</footer></blockquote>):<p className="hint">No comments on this stretch yet.</p>}
      </section>
      <Explanation trip={trip} extra={extra}/>
      <p className="hint">{s.reason||('Evidence covers '+s.coverage+'% of the route.')}</p>
      {s.factors.map(f=><p className="hint" key={f.label}>{f.label} · {f.metres} m observed, {f.adverseMetres} m with adverse signals</p>)}
      <div className="route-options">{trip.routes.map((r,i)=><button type="button" key={r.id} className="chip route-option" aria-pressed={r.id===selected.id} onClick={()=>setTrip({...trip,selected:r})}>
        {r.label||('Route '+(i+1))}{r.recommended?' · Recommended':''} — {r.minutes} min · {distance(r.metres)}<br/>{r.safety.risk===null?'Risk unknown':'Risk index '+r.safety.risk+'/100'} · {r.safety.confidence} confidence</button>)}</div>
      {trip.routes.length===1&&<p>Only one walking route was returned.</p>}
      {trip.demo&&<p>Demo routes, observations and example comments are fictional.</p>}
      <div className="actions"><button className="secondary" onClick={()=>setTrip(null)}>{t('Change','बदलें')}</button><button className="primary" onClick={start}>{t('Start trip','यात्रा शुरू करें')}</button></div>
    </>:<form onSubmit={find}><fieldset disabled={busy}><PlaceField label="From" place={from} onChange={setFrom} allowLocation/><PlaceField label="To" place={to} onChange={setTo}/>
      <fieldset><legend>{t('Departure time','प्रस्थान समय')} · IST</legend><div className="choice"><button className="chip" type="button" aria-pressed={!time} onClick={()=>setTime('')}>{t('Now','अभी')}</button><input aria-label="Pick departure time" type="time" value={time} onChange={e=>setTime(e.target.value)}/></div></fieldset>
      <fieldset><legend>{t('Route preference','मार्ग की प्राथमिकता')}</legend><div className="segment">{['Alternate','Faster'].map(mode=><button key={mode} type="button" aria-pressed={mode===pref} onClick={()=>setPref(mode)}>{mode==='Alternate'?t('Alternate','वैकल्पिक मार्ग'):t('Faster','कम समय')}</button>)}</div></fieldset>
      {pref==='Alternate'&&<label className="detour">{t('Maximum extra minutes','अधिकतम अतिरिक्त मिनट')}<input type="number" min="0" max="120" step="1" required value={limit} onChange={e=>setLimit(e.target.value)}/></label>}
      <button className="primary submit" type="submit">{busy?t('Finding route…','खोज जारी है…'):t('Find route','मार्ग खोजें')}</button>
      <section className="demo-picker"><label htmlFor="walk">Demo walks</label><select id="walk" value={walk} onChange={e=>setWalk(e.target.value)}>{walks.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select><p className="hint">{walks.find(w=>w.id===walk).description}</p>
      <button className="secondary submit" type="button" onClick={e=>find(e,true)}>{t('Open demo walk','डेमो खोलें')}</button></section></fieldset>
      {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}</form>}
      <p className="hint disclaimer">{t('Mapped signals can be incomplete. No route guarantees personal safety.','मानचित्र की जानकारी अधूरी हो सकती है। कोई मार्ग सुरक्षा की गारंटी नहीं देता।')}</p>
      <p className="credits">© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> · OSRM / FOSSGIS · <a href="https://www.openstreetmap.org/fixthemap">Fix the map</a></p>
    </div></section></div>}
    {feedback&&<Rating {...feedback} t={t} close={m=>{setFeedback(null);setNotice(m||'Trip ended.');}}/>}
  </main>;
}
