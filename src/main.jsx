import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import './theme.css';
import Planner from './components/Planner.jsx';

createRoot(document.getElementById('root')).render(<StrictMode><Planner /></StrictMode>);
