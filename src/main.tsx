import { createRoot } from 'react-dom/client'
import '@fontsource/be-vietnam-pro/400.css'
import '@fontsource/be-vietnam-pro/600.css'
import '@fontsource/be-vietnam-pro/800.css'
import './index.css'
import { App } from './App'
import { BackgroundMusic } from './ui/music'

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    {/* Outside App so the music keeps playing across screens. */}
    <BackgroundMusic />
  </>,
)
