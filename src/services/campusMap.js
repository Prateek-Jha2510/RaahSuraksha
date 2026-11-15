import L from 'leaflet';
import { campus } from '../data/campus.js';
import { initialZoom, tileOptions, tileUrl } from '../config/map.js';

export function mountCampusMap(container, onTileError, trip) {
  const map = L.map(container, { zoomControl: false }).setView(campus.center, initialZoom);
  L.control.zoom({ position: 'topright' }).addTo(map);
  const tiles = L.tileLayer(tileUrl, tileOptions);
  tiles.on('tileerror', () => onTileError(true));
  tiles.on('loading', () => onTileError(false));
  tiles.addTo(map);

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
      const tooltip = document.createElement("span");
      tooltip.textContent = place.name;
      L.circleMarker(place.point, {
        radius: 7, color: '#164d3d', weight: 3, fillColor: '#fff', fillOpacity: 1
      }).bindTooltip(tooltip).addTo(map);
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
    tiles.off('tileerror');
    tiles.off('loading');
    map.remove();
  }};
}
