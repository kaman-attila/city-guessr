import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const DATA_CREDITS = `CityGuessr third-party notices
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

// the dependency's install folder: nested under the package first, then the project's node_modules
function resolveDependency(fromRoot: string, name: string): string | null {
  const nested = join(fromRoot, 'node_modules', name)
  const hoisted = join(import.meta.dirname, 'node_modules', name)
  const found = [nested, hoisted].find((dir) => existsSync(join(dir, 'package.json')))
  // same slash style as packageRoot, so one package never shows up twice
  return found ? found.replace(/\\/g, '/') : null
}

function licenseText(root: string): string | null {
  const file = readdirSync(root).find((f) => /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(f))
  return file ? readFileSync(join(root, file), 'utf8').trim() : null
}

// MIT, BSD and OFL require their notices to travel with the code, and the minified bundle drops them
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

      // prebuilt packages like maplibre-gl ship their dependencies inside their own dist files
      const queue = [...roots]
      while (queue.length > 0) {
        const root = queue.pop()!
        const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
        for (const name of Object.keys(pkg.dependencies ?? {})) {
          const dep = resolveDependency(root, name)
          if (dep && !roots.has(dep)) {
            roots.add(dep)
            queue.push(dep)
          }
        }
      }

      const sections = [...roots]
        .map((root) => {
          const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
          const title = `${pkg.name} ${pkg.version} (${pkg.license ?? 'licence not stated'})`
          const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
          const text =
            licenseText(root) ??
            `Copyright (c) ${author ?? `the ${pkg.name} authors`}. ` +
              `Licensed under ${pkg.license ?? 'an unstated licence'} (the package ships no licence file).`
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
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
