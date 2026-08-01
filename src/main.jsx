import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import '@fontsource-variable/inter';
import '@/common/styles/default.sass';
import '@/common/styles/app.sass';
import '@/common/styles/buttons.sass';
import App from '@/App';
import {applySubtitleStyle} from '@/common/utils/prefs';

applySubtitleStyle();

const BASE = import.meta.env.BASE_URL;
const basename = BASE.replace(/\/$/, '');

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter basename={basename}>
            <App/>
        </BrowserRouter>
    </StrictMode>,
);
