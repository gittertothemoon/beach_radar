import { Suspense, StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles/globals.css'

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
