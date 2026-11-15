import React,{useEffect,useId,useRef,useState} from 'react';

export default function PlaceField({label,place,onChange,allowLocation}){
  const id=useId(),input=useRef(null),timer=useRef(),pending=useRef(),version=useRef(0);
  const [text,setText]=useState(place?.name||''),[matches,setMatches]=useState([]),[active,setActive]=useState(-1);
  const [message,setMessage]=useState('');
  function cancel(){
    clearTimeout(timer.current);pending.current?.abort();version.current++;
  }
  useEffect(()=>()=>cancel(),[]);
  function dismiss(){
    cancel();setMatches([]);setActive(-1);setMessage('');
  }
  function choose(value){
    dismiss();setText(value.name);onChange(value);
  }
  async function lookup(q,manual=false){
    cancel();const token=version.current,controller=new AbortController();pending.current=controller;
    setMessage(manual?'Searching…':'Finding suggestions…');
    try{
      const res=await fetch('/api/'+(manual?'places':'suggest')+'?'+new URLSearchParams({q}),{signal:controller.signal});
      const data=await res.json();
      if(token!==version.current)return;
      if(!res.ok)throw Error();
      setMatches(data);setActive(-1);
      setMessage(data.length?'':manual?'No matches. Try adding a locality or city.':'No suggestions. Add a locality or try Search.');
    }catch{
      if(token===version.current){setMatches([]);setMessage(manual?'Search unavailable. Try again.':'Suggestions unavailable. Try Search for this address.');}
    }
  }
  function schedule(value){
    dismiss();const q=value.trim();
    if(q.length>=3)timer.current=setTimeout(()=>lookup(q),350);
  }
  function keys(e){
    if(e.nativeEvent.isComposing)return;
    if(e.key==='Escape'){e.preventDefault();dismiss();return;}
    if(matches.length && ['ArrowDown','ArrowUp'].includes(e.key)){
      e.preventDefault();setActive(i=>e.key==='ArrowDown'?(i+1)%matches.length:(i<=0?matches.length-1:i-1));return;
    }
    if(e.key==='Enter' && !place){e.preventDefault();if(matches.length)choose(matches[Math.max(active,0)]);else if(text.trim().length>=3)lookup(text.trim(),true);}
  }
  return <div className="place-field" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))dismiss();}}>
    <label htmlFor={id}>{label}</label><input id={id} ref={input} role="combobox" aria-autocomplete="list" aria-expanded={!!matches.length}
      aria-controls={id+'-list'} aria-activedescendant={active>=0?id+'-'+active:undefined} autoComplete="off" maxLength={160} value={text} placeholder="Place or address in India"
      onFocus={e=>{if(place?.gps)e.target.select();else if(!place)schedule(text);}}
      onChange={e=>{const v=e.target.value;setText(v);onChange(null);schedule(v);}} onKeyDown={keys}/>
    <ul id={id+'-list'} role="listbox" aria-label={label+' suggestions'} className="address-options" hidden={!matches.length}>
      {matches.map((m,i)=><li key={i} id={id+'-'+i} role="option" aria-selected={active===i} onPointerDown={e=>e.preventDefault()} onClick={()=>choose(m)}>{m.name}</li>)}
    </ul>
    <div className="choice"><button type="button" className="chip" disabled={text.trim().length<3||Boolean(place)} onClick={()=>{input.current.focus();lookup(text.trim(),true);}}>Search {label.toLowerCase()}</button>
    {allowLocation&&!place?.gps&&<button type="button" className="chip" onClick={()=>choose({name:'My location',gps:true})}>My location</button>}</div>
    <p role="status" aria-live="polite">{message || (matches.length?matches.length+' suggestions':'')}</p>
  </div>;
}