import React,{useLayoutEffect,useState} from 'react';
function initialTheme(){
  try {const saved=localStorage.getItem('raah.theme');if(['light','dark'].includes(saved))return saved;}catch{}
  return window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}
export default function ThemeToggle(){
  const [theme,setTheme]=useState(initialTheme);
  useLayoutEffect(()=>{document.documentElement.dataset.theme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#080f1d':'#edf4f8');
  },[theme]);
  function toggle(){const next=theme==='dark'?'light':'dark';setTheme(next);try{localStorage.setItem('raah.theme',next);}catch{}}
  return <button className="chip theme-toggle" type="button" aria-label="Dark mode" aria-pressed={theme==='dark'} onClick={toggle}><span aria-hidden="true">{theme==='dark'?'☾':'☀'}</span> {theme==='dark'?'Dark':'Light'}</button>;
}
