import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initializeAppearance } from './services/appearanceStorage.ts'

const initialAppearancePreference = initializeAppearance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialAppearancePreference={initialAppearancePreference} />
  </StrictMode>,
)
