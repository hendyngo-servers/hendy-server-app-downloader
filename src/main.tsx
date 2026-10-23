import { createRoot } from 'react-dom/client';
import PublicStoreApp from './PublicStoreApp.tsx';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element for public store.');
createRoot(root).render(<PublicStoreApp />);
