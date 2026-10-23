import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp.tsx';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element for Admin Control Center.');
createRoot(root).render(<AdminApp />);
