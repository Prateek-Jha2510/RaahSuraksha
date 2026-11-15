// Fixed Stage 2 examples. Coordinates, travel times and reasons are illustrative.
export const places = {
  gate: { name: 'DTU Main Gate', point: [28.74923, 77.11847] },
  library: { name: 'Central Library', point: [28.75089, 77.11487] }
};

const safer = {
  id: 'safer', label: 'Alternate', minutes: 12, confidence: 'Medium',
  reasons: ['More of this sample route has lighting marked.', 'It passes more places marked open in the demo.'],
  points: [places.gate.point, [28.74898, 77.11779], [28.74873, 77.11687], [28.75050, 77.11639], places.library.point]
};
const faster = {
  id: 'faster', label: 'Faster', minutes: 8, confidence: 'Low',
  reasons: ['This is the quickest of the two sample routes.', 'The demo has limited lighting information along this route.'],
  points: [places.gate.point, [28.74957, 77.11779], [28.74994, 77.11675], [28.75029, 77.11573], places.library.point]
};

export function getDemoTrip(origin, destination, preference) {
  const from = origin === 'my-location' ? 'gate' : origin;
  if (!Object.hasOwn(places, from) || !Object.hasOwn(places, destination) || from === destination) return null;
  const routes = [safer, faster].map(route => ({
    ...route, points: from === 'gate' ? route.points : [...route.points].reverse()
  }));
  const selected = routes.find(route => route.id === preference);
  if (!selected) return null;
  return {
    from: places[from], to: places[destination], routes, selected,
    extraMinutes: selected.minutes - Math.min(...routes.map(route => route.minutes))
  };
}
