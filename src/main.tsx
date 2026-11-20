import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {startPreloadGlbs} from './engine3d/glbRegistry';
import './index.css';

startPreloadGlbs();

createRoot(document.getElementById('root')!).render(<App />);

