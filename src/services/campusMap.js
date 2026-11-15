import L from 'leaflet';
import { campus } from '../data/campus.js';
import { initialZoom, streetCredit } from '../config/map.js';

import {mountStreetLayer} from './streetLayer.js';
import {places,getDemoTrip} from '../data/demoRoutes.js';

export function mountCampusMap(container, onTileError, trip) {
  const map = L.map(container, { zoomControl: false, minZoom:2, maxZoom:19, zoomAnimation:false }).setView(campus.center, initialZoom);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const guide=L.layerGroup();
  function endpoint(place){
    const label=document.createElement('span');
    label.textContent=place.name;
    return L.circleMarker(place.point,{radius:6,color:'#164d3d',weight:3,fillColor:'#fff',fillOpacity:1})
      .bindTooltip(label,{permanent:true,direction:'top',offset:[0,-5]});
  }
  if(!trip){
    const preview=getDemoTrip('gate','library','faster');
    preview.routes.forEach(r=>L.polyline(r.points,{color:'#687885',weight:4,dashArray:'6 6'}).addTo(guide));
    Object.values(places).forEach(place=>endpoint(place).addTo(guide));
    guide.addTo(map);
  }
  const setUnavailable=value=>{
    onTileError(value);
    if(!trip){if(value)guide.addTo(map);else guide.remove();}
  };
  map.attributionControl.addAttribution(streetCredit);
  const stopStreets=mountStreetLayer(map,setUnavailable);

  let bounds;
  if (trip) {
    const ordered = trip.selected ? [...trip.routes.filter(r => r.id !== trip.selected.id), trip.selected] : trip.routes;
    for (const route of ordered) {
      const chosen = route.id === trip.selected?.id;
      L.polyline(route.points, {
        color: chosen ? '#14654c' : '#656e71',
        weight: chosen ? 7 : 5, dashArray: chosen ? null : '7 8', interactive: false
      }).addTo(map);
    }
    for (const place of [trip.from, trip.to]) {
      endpoint(place).addTo(map);
    }
    bounds = L.latLngBounds(trip.routes.flatMap(route => route.points));
  }
  const layout = () => {
    map.invalidateSize({ pan: false });
    if (bounds) map.fitBounds(bounds, { paddingTopLeft: [32, 24], paddingBottomRight: [52, 32], maxZoom: 17, animate: false });
  };
  layout();
  const observer = new ResizeObserver(layout);
  observer.observe(container);
  let dot;
  return {position(p) {
    if (!p) return;
    if(dot) dot.setLatLng(p);
    else dot=L.circleMarker(p,{radius:8,color:'#fff',weight:3,fillColor:'#236cb5',fillOpacity:1}).bindTooltip('Current location').addTo(map);
    if(!map.getBounds().contains(p)) map.panTo(p);
  },dispose() {
    observer.disconnect();
    stopStreets();
    map.remove();
  }};
}
