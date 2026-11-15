import React,{useState} from 'react';
export default function Rating({offer,demo,close,t}){
  const [rating,setRating]=useState(''),[tags,setTags]=useState([]),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  const [comment,setComment]=useState('');
  async function save(){
    setBusy(true);
    try{const res=await fetch('/api/rating',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:offer.token,rating,tags,comment})});
      const data=await res.json();if(!res.ok)throw Error(data.error);close(data.saved?'Rating saved.':'Already rated today.');}
    catch(e){setMsg(e.message);setBusy(false);}
  }
  return <div className="overlay"><section className="panel" role="dialog" aria-modal="true" aria-label="Rate this street">
    <p className="location">{demo?'Demo · Practice feedback':'Optional feedback'}</p><h2>{t('How did this street feel?','यह सड़क कैसी लगी?')}</h2><p>Stretch near {offer.point.join(', ')}.</p>
    <div className="choice">{[['bad','Not good'],['okay','Okay'],['fine','Felt fine']].map(([id,label])=><button className="chip" key={id} aria-pressed={rating===id} onClick={()=>setRating(id)}>{label}</button>)}</div>
    <div className="choice">{['Dark','Empty','Crowded','Shops open','Felt fine'].map(tag=><button className="chip" key={tag} aria-pressed={tags.includes(tag)} onClick={()=>setTags(tags.includes(tag)?tags.filter(v=>v!==tag):[...tags,tag])}>{tag}</button>)}</div>
    <label className="comment-label">Street comment (optional)<textarea rows="3" maxLength={240} value={comment} onChange={e=>setComment(e.target.value)} placeholder="What did you notice on this stretch?"/></label>
    <p className="hint">Shown with this street's route score. Leave out names and contact details. {comment.length}/240</p>
    <p role="status">{msg}</p><div className="actions"><button className="secondary" disabled={busy} onClick={()=>close('')}>{t('Skip','छोड़ें')}</button><button className="primary" disabled={!rating||busy} onClick={save}>Save rating</button></div></section></div>;
}
