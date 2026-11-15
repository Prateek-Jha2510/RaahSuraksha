// Police numbers from the Delhi Police directory. Locations are station map pins.
// Only offer a direct line within 5 km of a listed station.
const stations = [
  {name: 'K.N. Katju Marg Police Station', phone: '+911127571171', lat: 28.73086, lon: 77.12167},
  {name: 'Shahbad Dairy Police Station', phone: '+917065036322', lat: 28.74769, lon: 77.07883},
  {name: 'Alipur Police Station', phone: '+917065036325', lat: 28.79893, lon: 77.13859}
];

export function nearestListedStation(point) {
  if (!point || !point.every(Number.isFinite)) return null;
  const [lat, lon] = point;
  let closest = null;
  let limit = 5000;
  for (const station of stations) {
    const east = (station.lon - lon) * Math.cos(lat * Math.PI / 180);
    const metres = 111195 * Math.hypot(station.lat - lat, east);
    if (metres <= limit) {
      closest = station;
      limit = metres;
    }
  }
  return closest;
}
