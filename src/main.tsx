import { Suspense, StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles/globals.css'

// Set --svh to the stable small viewport height (excludes browser chrome).
// Fallback to window.innerHeight if the CSS svh unit is unsupported (older WebViews).
function setStableSvh() {
  const svhPx = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--svh', `${svhPx}px`);
}
setStableSvh();
// Update only on orientationchange, not on scroll (avoids keyboard resize flicker on iOS)
window.addEventListener('orientationchange', () => setTimeout(setStableSvh, 200));

const App = lazy(() => import('./app/App'))
const RegisterPage = lazy(() => import('./app/RegisterPage'))

const normalizedPath =
  typeof window !== 'undefined'
    ? window.location.pathname.replace(/\/+$/, '') || '/'
    : '/'
const RootComponent =
  normalizedPath === '/register' || normalizedPath === '/app/register'
    ? RegisterPage
    : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <RootComponent />
    </Suspense>
  </StrictMode>,
)
