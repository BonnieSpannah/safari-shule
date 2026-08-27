import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import { App } from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container not found');

createRoot(container).render(<App />);
