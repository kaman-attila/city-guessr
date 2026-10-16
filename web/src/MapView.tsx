import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { type LatLon, type GuessResult } from './api'
import type { FeatureCollection } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { MinusIcon, PlusIcon } from './icons'
import './MapView.css'

maplibregl.setWorkerUrl(workerUrl)

type Props = {
  guess: LatLon | null
  onMapClick: (lat: number, lon: number) => void
  result: GuessResult | null
  dark: boolean
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'

function unwrapLon(lon: number, nearLon: number): number {
  if (lon - nearLon > 180) return lon - 360
  if (lon - nearLon < -180) return lon + 360
  return lon
}

function addGuessLine(map: maplibregl.Map) {
  if (map.getSource('guess-line')) return
  map.addSource('guess-line', { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: 'guess-line',
    type: 'line',
    source: 'guess-line',
    paint: { 'line-color': '#e11d48', 'line-width': 2, 'line-dasharray': [2, 2] },
  })
}

function pinElement(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'map-pin'
  el.innerHTML =
    '<svg viewBox="0 0 40 48" width="40" height="48" aria-hidden="true">' +
    '<path d="M20 46s16-14.5 16-27A16 16 0 0 0 4 19c0 12.5 16 27 16 27z"/>' +
    '<circle cx="20" cy="19" r="6"/></svg>'
  return el
}

export default function MapView({ guess, onMapClick, result, dark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const cityMarkersRef = useRef<maplibregl.Marker[]>([])
  const styleUrl = dark ? DARK_STYLE : LIGHT_STYLE
  const styleRef = useRef(styleUrl)

  useEffect(() => {
    onMapClickRef.current = onMapClick
  })

  useEffect(() => {
    const map = mapRef.current
    if (!map || styleRef.current === styleUrl) return
    styleRef.current = styleUrl
    map.setStyle(styleUrl, { diff: false })
  }, [styleUrl])

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleRef.current,
      center: [10, 30],
      zoom: 1.5,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.on('style.load', () => addGuessLine(map))

    map.on('click', (e) => {
      const { lat, lng } = e.lngLat.wrap()
      onMapClickRef.current(lat, lng)
    })

    return () => {
      markerRef.current?.remove()
      markerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!guess) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ element: pinElement(), anchor: 'bottom' })
        .setLngLat([guess.lon, guess.lat])
        .addTo(map)
    } else {
      markerRef.current.setLngLat([guess.lon, guess.lat])
    }
  }, [guess])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    cityMarkersRef.current.forEach((m) => m.remove())
    cityMarkersRef.current = []
    const line = map.getSource('guess-line') as maplibregl.GeoJSONSource | undefined
    line?.setData(EMPTY)

    if (!result || !guess) return

    result.cities.forEach((city, i) => {
      const color = i === result.closest ? '#16a34a' : '#64748b'
      const marker = new maplibregl.Marker({ color })
        .setLngLat([unwrapLon(city.lon, guess.lon), city.lat])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setText(`${city.name}, ${city.country}`))
        .addTo(map)
      cityMarkersRef.current.push(marker)
    })

    const nearest = result.cities[result.closest]
    const nearestLon = unwrapLon(nearest.lon, guess.lon)

    line?.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [guess.lon, guess.lat],
          [nearestLon, nearest.lat],
        ],
      },
    })

    const bounds = new maplibregl.LngLatBounds()
    bounds.extend([guess.lon, guess.lat])
    bounds.extend([nearestLon, nearest.lat])
    map.fitBounds(bounds, { padding: 80, maxZoom: 10 })
  }, [result, guess])

  return (
    <div className={result ? 'map-view' : 'map-view guessing'}>
      <div ref={containerRef} className="map-view-canvas" />
      <div className="map-zoom">
        <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <PlusIcon strokeWidth={2.2} />
        </button>
        <div className="map-zoom-divider" />
        <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <MinusIcon strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}
