import React,{useEffect,useRef,useState} from 'react';
import CampusMap from './CampusMap.jsx';

function readSettings(){try{return JSON.parse(localStorage.getItem('raah.sos'))||{};}catch{return {};}}
function normalize(s){return s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim();}
function sms(phone,fix){
  const where=fix && Date.now()-fix.time<120000?'My location: https://maps.google.com/?q='+fix.point.join(','):'Current location unavailable. Please call me.';
  return 'sms:'+phone+(/iPhone|iPad|iPod/.test(navigator.userAgent)?'&':'?')+'body='+encodeURIComponent('I need help. '+where);
}
export default function Trip({trip,onEnd,t,audioRef}){
  const [cfg,setCfg]=useState(readSettings),[sheet,setSheet]=useState(false);
  const [phone,setPhone]=useState(cfg.phone||''),[phrase,setPhrase]=useState(cfg.phrase||'');
  const [voice,setVoice]=useState(false),[mic,setMic]=useState(''),[fix,setFix]=useState(null),[gps,setGps]=useState('Waiting for location');
  const [deadline,setDeadline]=useState(0),[seconds,setSeconds]=useState(5),[alert,setAlert]=useState(false),[audioMsg,setAudioMsg]=useState('');
  const passed=useRef(false),tone=useRef(null),latest=useRef(null);
  const candidate=trip.selected.feedback,Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  function mute(){if(tone.current){try{tone.current.stop();}catch{}tone.current=null;}}
  useEffect(()=>()=>mute(),[]);
  useEffect(()=>{
    if(trip.demo || !navigator.geolocation){setGps(trip.demo?'Simulated walk':'Location unavailable');return;}
    const id=navigator.geolocation.watchPosition(p=>{
      const point=[p.coords.latitude,p.coords.longitude],value={point,time:p.timestamp};
      latest.current=value;setFix(value);setGps('Location updated');
      if(candidate && Date.now()-p.timestamp<120000 && p.coords.accuracy<=65 &&
        111195*Math.hypot(point[0]-candidate.point[0],(point[1]-candidate.point[1])*Math.cos(point[0]*Math.PI/180))<65)passed.current=true;
    },()=>setGps('Location unavailable. SOS can still prepare a message.'),{timeout:12000,maximumAge:5000,enableHighAccuracy:true});
    return ()=>navigator.geolocation.clearWatch(id);
  },[trip,candidate]);
  function trigger(){setVoice(false);setSeconds(5);setDeadline(d=>d||Date.now()+5000);}
  useEffect(()=>{
    if(!deadline)return;
    const timer=setInterval(()=>{
      const left=Math.ceil((deadline-Date.now())/1000);
      if(left>0){setSeconds(left);return;}
      clearInterval(timer);setDeadline(0);setAlert(true);
      try{
        const ctx=audioRef.current;if(ctx?.state!=='running')throw Error();
        const osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=880;gain.gain.value=.2;
        osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+12);tone.current=osc;
      }catch{setAudioMsg('Alarm audio unavailable on this device.');}
      if(cfg.phone && !trip.demo)window.location.href=sms(cfg.phone,latest.current);
    },100);return ()=>clearInterval(timer);
  },[deadline,cfg.phone,trip.demo]);
  useEffect(()=>{
    if(!voice||!Recognition)return;
    const r=new Recognition();let active=true;r.continuous=true;r.interimResults=false;r.lang=/[\u0900-\u097f]/.test(cfg.phrase)?'hi-IN':'en-IN';
    r.onstart=()=>active && setMic('Listening for your SOS phrase');
    r.onresult=e=>{for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal && (' '+normalize(e.results[i][0].transcript)+' ').includes(' '+normalize(cfg.phrase)+' '))trigger();};
    r.onerror=()=>{if(active){setMic('Microphone unavailable. Use the SOS button.');setVoice(false);}};
    r.onend=()=>{if(active){setVoice(false);setMic(s=>s.startsWith('Microphone')?s:'Listening stopped.');}};
    try{r.start();}catch{setVoice(false);setMic('Voice recognition unavailable.');}
    return ()=>{active=false;r.onresult=null;try{r.abort();}catch{}};
  },[voice,cfg.phrase,Recognition]);
  return <div className="workspace"><CampusMap trip={trip} position={fix?.point}/><section className="sheet"><div className="sheet-inner trip-inner">
    <p className="location">{trip.demo?trip.title+' · Practice trip':'Walking'}</p><h1>{t('Trip in progress','यात्रा जारी है')}</h1>
    <p>{trip.from.name} → {trip.to.name}</p><p className="hint">{gps}</p>
    {trip.demo && <p>Practice mode keeps emergency calls and SMS handoff disabled.</p>}
    <div className="actions"><button className="secondary" disabled={!!deadline||alert} onClick={()=>{setVoice(false);setSheet(true);}}>{t('SOS settings','SOS सेटिंग्स')}</button>
    <button className="secondary" disabled={!!deadline||alert} onClick={()=>onEnd(candidate&&(trip.demo||passed.current)?candidate:null)}>{t('End trip','यात्रा समाप्त करें')}</button></div>
    {Recognition && cfg.phrase && <button className="secondary submit" disabled={!!deadline||alert} onClick={()=>{setMic('');setVoice(!voice);}}>{voice?'Stop listening':'Enable voice SOS'}</button>}
    <p className="hint" role="status">{Recognition?mic||(cfg.phrase?'Voice listening is off.':'Set a phrase to enable voice SOS.'):'Voice recognition unavailable. Use the SOS button.'}</p>
    <p className="hint">Keep the trip screen open. Location and microphone require permission. Confirm the prepared SMS in your messaging app.</p>
    {!sheet&&!deadline&&!alert&&<button className="sos" onClick={trigger}>SOS</button>}
    {sheet&&<div className="overlay"><form className="panel" onSubmit={e=>{e.preventDefault();const c={phone:phone.trim(),phrase:normalize(phrase)?phrase.trim():''};setCfg(c);try{localStorage.setItem('raah.sos',JSON.stringify(c));}catch{}setSheet(false);}}>
      <h2>SOS settings</h2><label>Trusted contact number<input type="tel" pattern="[+]?[0-9]{7,15}" value={phone} placeholder="+91…" onChange={e=>setPhone(e.target.value)}/></label>
      <label>Trigger phrase<input value={phrase} maxLength={100} placeholder="Mujhe bachao" onChange={e=>setPhrase(e.target.value)}/></label><p>Saved on this device.</p>
      <div className="actions"><button className="secondary" type="button" onClick={()=>{setPhone(cfg.phone||'');setPhrase(cfg.phrase||'');setSheet(false);}}>Cancel</button><button className="primary">Save</button></div></form></div>}
    {!!deadline&&<div className="overlay"><div className="panel" role="alertdialog" aria-label="SOS countdown"><h2>SOS in {seconds}</h2><button autoFocus className="primary submit" onClick={()=>setDeadline(0)}>{t('Cancel SOS','SOS रद्द करें')}</button></div></div>}
    {alert&&<div className="overlay"><div className="panel" role="alertdialog" aria-label="SOS actions"><h2>{trip.demo?'Practice SOS':'SOS actions'}</h2><p>{trip.demo?'No call or message was started.':cfg.phone?'Confirm the prepared message in your SMS app.':'No trusted contact is set. Call for help below.'}</p>
      {!trip.demo&&<div className="links">{cfg.phone&&<a href={sms(cfg.phone,fix)}>Open prepared SMS</a>}<a href="tel:112">Call 112 · Emergency</a><a href="tel:1091">Call 1091 · Delhi women's helpline</a></div>}
      {audioMsg&&<p>{audioMsg}</p>}<button autoFocus className="primary submit" onClick={()=>{mute();setAlert(false);setAudioMsg('');}}>Stop alarm and close</button></div></div>}
  </div></section></div>;
}
