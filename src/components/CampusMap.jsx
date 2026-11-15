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
    {(trip?.demo || tileError) && <p className="map-message" role="status">{trip?.demo?(tileError?'Street map unavailable · demo route diagram':'Demo route · seeded observations'):trip?'Street map unavailable · showing route geometry':'Street map unavailable · showing DTU demo paths'}</p>}
  </section>;
}
