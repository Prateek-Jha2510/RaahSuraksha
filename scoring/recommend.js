import {execFile} from 'node:child_process';
import path from 'node:path';
export async function recommend(routes, safer, limit) {
  const input=[[limit,Number(safer),routes.length],...routes.map(r=>[r.seconds,r.safety.risk??-1])].map(a=>a.join(' ')).join('\n');
  let index;
  try {
    index=await new Promise((resolve,reject)=>{
      const child=execFile(path.resolve('build',process.platform==='win32'?'scorer.exe':'scorer'),['choose'],{timeout:3000,windowsHide:true},(err,out)=>err?reject(err):resolve(Number(out.trim())));
      child.stdin.on('error',()=>{}); child.stdin.end(input);
    });
    if(!routes[index]) throw Error('Invalid choice');
  } catch {
    index=routes.reduce((best,r,i)=>r.seconds<routes[best].seconds?i:best,0);
    for(const r of routes) r.selectionUnavailable=true;
  }
  return routes.map((r,i)=>({...r,recommended:i===index}));
}
