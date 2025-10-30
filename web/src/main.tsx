import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';

// import './index.css';
import App from './App.tsx';
import {WebRTCProvider} from './providers/WebRTC.tsx';
import {WSTestPage} from './WS.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* <WebRTCProvider> */}
      <App />
    {/* </WebRTCProvider> */}
  </StrictMode>
);

// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     <WSTestPage />
//   </StrictMode>
// );
