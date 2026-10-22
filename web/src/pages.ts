import '@fontsource-variable/unbounded'
import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import './pages.css'
import { isDark, loadLocalSettings } from './settings'

document.documentElement.dataset.theme = isDark(loadLocalSettings().theme) ? 'dark' : 'light'
