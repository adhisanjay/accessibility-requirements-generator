import { Router } from 'express';
export const metadataRouter = Router();
metadataRouter.get('/', (_request, response) => response.json([
    { id: '1.1.1', name: 'Non-text Content' },
    { id: '1.3.1', name: 'Info and Relationships' },
    { id: '1.4.3', name: 'Contrast (Minimum)' },
    { id: '2.1.1', name: 'Keyboard' },
    { id: '2.4.7', name: 'Focus Visible' },
    { id: '4.1.2', name: 'Name, Role, Value' },
]));
