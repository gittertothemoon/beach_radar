import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles/globals.css'
import App from './app/App'
import RegisterPage from './app/RegisterPage'

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
    <RootComponent />
  </StrictMode>,
)
