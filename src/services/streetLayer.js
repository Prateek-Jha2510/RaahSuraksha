import {streetStyle} from '../config/map.js';

// The online renderer is optional. Leaflet owns all routes, labels, controls and GPS.
let rendererRequest;
function loadRenderer(){
  if(window.maplibregl)return Promise.resolve(window.maplibregl);
  if(!rendererRequest)rendererRequest=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    script.async=true;
    script.onload=()=>window.maplibregl?resolve(window.maplibregl):reject(Error('Renderer unavailable'));
    script.onerror=()=>{script.remove();reject(Error('Renderer unavailable'));};
    document.head.append(script);
  }).catch(error=>{rendererRequest=null;throw error;});
  return rendererRequest;
}
export function mountStreetLayer(map,onUnavailable){
  let closed=false, streets;
  const container=document.createElement('div');
  container.className='street-background';
  container.setAttribute('aria-hidden','true');
  map.getContainer().prepend(container);
  const sync=()=>{
    if(!streets)return;
    const center=map.getCenter();
    streets.jumpTo({center:[center.lng,center.lat],zoom:map.getZoom()-1});
  };
  const resize=()=>{streets?.resize();sync();};
  const unavailable=()=>{if(!closed)onUnavailable(true);};
  const timeout=setTimeout(unavailable,9000);
  async function start(){
    try{
      const renderer=await loadRenderer();
      if(closed)return;
      const center=map.getCenter();
      streets=new renderer.Map({container,style:streetStyle,center:[center.lng,center.lat],
        zoom:map.getZoom()-1,interactive:false,attributionControl:false,trackResize:false,fadeDuration:0});
      streets.on('error',unavailable);
      streets.on('idle',()=>{if(!closed && streets.areTilesLoaded() && streets.queryRenderedFeatures().length){
        clearTimeout(timeout);onUnavailable(false);
      }});
      map.on('move zoom',sync).on('resize',resize);
      resize();
    }catch{unavailable();}
  }
  start();
  return ()=>{
    closed=true;clearTimeout(timeout);
    map.off('move zoom',sync).off('resize',resize);
    streets?.remove();container.remove();
  };
}
