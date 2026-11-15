export async function explanation(body,env,fetcher) {
  const {risk,confidence,coverage,extra,mode}=body;
  if(!(risk===null || Number.isInteger(risk) && risk>=0 && risk<=100) ||
    !['Low','Medium','High','No data'].includes(confidence) || !Number.isInteger(coverage) || coverage<0 || coverage>100 ||
    !Number.isInteger(extra) || extra<0 || extra>100000 || !['Faster','Alternate','Safer','Manual'].includes(mode)) throw Error('Invalid explanation input.');
  const first=mode==='Manual'?'You selected this walking route.':mode==='Faster'?'This route has the shortest estimated walking time.':
    risk===null?'There is too little mapped evidence to rank the eligible routes by risk.':'This route has the lowest observed risk index within your detour limit.';
  const second=confidence==='Low'?'Evidence is limited and covers '+coverage+'% of this walk.':
    confidence==='No data'?'Safety confidence is unknown.':'The confidence level is '+confidence.toLowerCase()+' with evidence across '+coverage+'% of this walk.';
  const fallback=first+' '+second;
  if(!env.OPENAI_API_KEY) return fallback;
  // Allow only evidence-backed sentences; scores and route choices never enter a model output path.
  const variants=[first, first.replace('estimated walking time','estimated duration').replace('You selected','You chose')];
  try {
    const res=await fetcher('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({model:env.RAAH_MODEL || 'gpt-4o-mini',response_format:{type:'json_object'},messages:[
        {role:'system',content:'Return JSON with sentences, an array of two strings. Choose an approved first sentence and copy the required second sentence exactly.'},
        {role:'user',content:JSON.stringify({risk,confidence,coverage,extra,approved:variants,required:second})}]}),signal:AbortSignal.timeout(4500)});
    if(!res.ok) return fallback;
    const reply=JSON.parse((await res.json()).choices[0].message.content).sentences;
    return Array.isArray(reply)&&reply.length===2&&variants.includes(reply[0])&&reply[1]===second ? reply.join(' ') : fallback;
  } catch{return fallback;}
}
