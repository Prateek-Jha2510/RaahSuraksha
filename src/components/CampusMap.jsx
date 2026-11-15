import React, { useEffect, useRef, useState } from 'react';
import { mountCampusMap } from '../services/campusMap.js';

export default function CampusMap({ trip, position }) {
  const container = useRef(null);
  const handle=useRef(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    setTileError(false);
    handle.current=mountCampusMap(container.current, setTileError, trip);
    return () => {handle.current.dispose();handle.current=null;};
  }, [trip]);

  useEffect(()=>{if(position) handle.current?.position(position);},[position,trip]);
  return <section className="map-panel" aria-label="DTU campus map">
    <div className="map" ref={container} aria-label="Interactive map" />
    {tileError && <p className="map-message" role="status">Map tiles unavailable. Check your connection.</p>}
  </section>;
}
