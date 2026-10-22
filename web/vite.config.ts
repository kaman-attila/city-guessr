import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const DATA_CREDITS = `PinTheCity third-party notices
==============================

Map and place data
------------------
Map data (c) OpenStreetMap contributors, available under the Open Database License (ODbL).
  https://www.openstreetmap.org/copyright
Map tiles and styles (c) OpenMapTiles, styles licensed under CC BY 4.0.
  https://openmaptiles.org/
Map tiles served by OpenFreeMap.
  https://openfreemap.org/
Place names and coordinates (c) GeoNames, licensed under CC BY 4.0.
The data has been modified: places were filtered and grouped by name.
  https://www.geonames.org/
  https://creativecommons.org/licenses/by/4.0/
How well known each city is comes from Wikidata (number of Wikipedia articles), CC0.
  https://www.wikidata.org/
Country borders from Natural Earth (public domain), simplified.
  https://www.naturalearthdata.com/

Software and fonts
------------------
The following packages are bundled into this website. Each notice is reproduced
from the package's own licence file.`

// node_modules/<name> or node_modules/@scope/<name> that a bundled module came from
function packageRoot(id: string): string | null {
  const path = id.replace(/\\/g, '/').replace(/^\0/, '').split('?')[0]
  const marker = '/node_modules/'
  const at = path.lastIndexOf(marker)
  if (at === -1) return null
  const parts = path.slice(at + marker.length).split('/')
  const name = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
  return path.slice(0, at + marker.length) + name
}

function licenseText(root: string): string | null {
  const file = readdirSync(root).find((f) => /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(f))
  return file ? readFileSync(join(root, file), 'utf8').trim() : null
}

function thirdPartyLicenses(): Plugin {
  return {
    name: 'third-party-licenses',
    apply: 'build',
    generateBundle() {
      const roots = new Set<string>()
      for (const id of this.getModuleIds()) {
        const root = packageRoot(id)
        if (root && existsSync(join(root, 'package.json'))) roots.add(root)
      }

      const sections = [...roots]
        .map((root) => {
          const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
          const title = `${pkg.name} ${pkg.version} (${pkg.license ?? 'licence not stated'})`
          const text = licenseText(root) ?? `Licensed under ${pkg.license ?? 'an unstated licence'}.`
          return { name: pkg.name as string, body: `${title}\n${'-'.repeat(title.length)}\n${text}` }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((s) => s.body)

      this.emitFile({
        type: 'asset',
        fileName: 'licenses.txt',
        source: [DATA_CREDITS, ...sections].join('\n\n\n') + '\n',
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), thirdPartyLicenses()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        howToPlay: 'how-to-play/index.html',
        about: 'about/index.html',
        faq: 'faq/index.html',
      },
    },
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
