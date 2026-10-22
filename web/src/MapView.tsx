import { useEffect, useRef } from 'react'
import 'maplibre-gl/dist/maplibre-gl.css'
import { type LatLon, type GuessResult, type Units } from './api'
import type { Feature, FeatureCollection } from 'geojson'
import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { MinusIcon, PlusIcon } from './icons'
import { formatDistance } from './settings'
import './MapView.css'

maplibregl.setWorkerUrl(workerUrl)

type Props = {
  guess: LatLon | null
  onMapClick: (lat: number, lon: number) => void
  result: GuessResult | null
  dark: boolean
  units: Units
}

type LineData = Feature | FeatureCollection

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }
const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron'
const DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark'

function unwrapLon(lon: number, nearLon: number): number {
  if (lon - nearLon > 180) return lon - 360
  if (lon - nearLon < -180) return lon + 360
  return lon
}

function addGuessLine(map: maplibregl.Map, data: LineData) {
  if (map.getSource('guess-line')) return
  map.addSource('guess-line', { type: 'geojson', data })
  map.addLayer({
    id: 'guess-line',
    type: 'line',
    source: 'guess-line',
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#4fa318', 'line-width': 3, 'line-dasharray': [2, 2] },
  })
}

const BORDER_WIDTH: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  0,
  0.8,
  3,
  1.3,
  6,
  1.9,
  12,
  3.2,
]

type PaintArgs = Parameters<maplibregl.Map['setPaintProperty']>
type LayoutArgs = Parameters<maplibregl.Map['setLayoutProperty']>

function setPaint(map: maplibregl.Map, layer: string, property: PaintArgs[1], value: PaintArgs[2]) {
  if (map.getLayer(layer)) map.setPaintProperty(layer, property, value)
}

function setLayout(
  map: maplibregl.Map,
  layer: string,
  property: LayoutArgs[1],
  value: LayoutArgs[2],
) {
  if (map.getLayer(layer)) map.setLayoutProperty(layer, property, value)
}

function tuneLightStyle(map: maplibregl.Map) {
  for (const layer of ['boundary_2', 'boundary_disputed']) {
    setPaint(map, layer, 'line-color', '#7d869e')
    setPaint(map, layer, 'line-opacity', 1)
    setPaint(map, layer, 'line-width', BORDER_WIDTH)
  }
  if (map.getLayer('label_country_3') && map.getLayer('label_city_capital')) {
    map.moveLayer('label_country_3', 'label_city_capital')
  }
}

function fixMissingIcons(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol') continue
    const icon = layer.layout?.['icon-image']
    if (icon === undefined || !JSON.stringify(icon).includes('circle-11')) continue
    const fixed = JSON.parse(JSON.stringify(icon).replaceAll('circle-11', 'circle_11'))
    map.setLayoutProperty(layer.id, 'icon-image', fixed)
  }
}

function tuneDarkStyle(map: maplibregl.Map) {
  fixMissingIcons(map)

  for (const layer of ['boundary_country_z0-4', 'boundary_country_z5-']) {
    if (!map.getLayer(layer)) continue
    const filter = map.getFilter(layer) as maplibregl.ExpressionSpecification | null | undefined
    map.setFilter(layer, ['all', ['!=', ['get', 'maritime'], 1], ...(filter ? [filter] : [])])
    setPaint(map, layer, 'line-color', '#7a84a6')
    setPaint(map, layer, 'line-blur', 0)
    setPaint(map, layer, 'line-width', BORDER_WIDTH)
  }

  if (map.getLayer('place_other')) {
    for (const layer of ['place_state', 'place_country_other']) {
      if (map.getLayer(layer)) map.moveLayer(layer, 'place_other')
    }
  }
  if (map.getLayer('place_country_minor') && map.getLayer('place_city_large')) {
    map.moveLayer('place_country_minor', 'place_city_large')
  }
  setPaint(map, 'place_state', 'text-color', 'rgb(88,92,108)')

  setPaint(map, 'place_city_large', 'text-color', '#d4d8e6')
  setPaint(map, 'place_city', 'text-color', '#c3c8d9')
  setPaint(map, 'place_town', 'text-color', '#a9afc3')
  setPaint(map, 'place_village', 'text-color', '#8c93aa')
  for (const layer of ['place_country_major', 'place_country_minor', 'place_country_other']) {
    setPaint(map, layer, 'text-color', '#9aa1ba')
  }

  setLayout(map, 'place_city_large', 'text-size', [
    'interpolate',
    ['exponential', 1.2],
    ['zoom'],
    4,
    13,
    7,
    15,
    11,
    19,
  ])
  setLayout(map, 'place_city', 'text-size', [
    'interpolate',
    ['exponential', 1.2],
    ['zoom'],
    4,
    11,
    7,
    13,
    11,
    17,
  ])
  setLayout(map, 'place_town', 'text-size', [
    'interpolate',
    ['exponential', 1.2],
    ['zoom'],
    6,
    10,
    11,
    14,
  ])
}

function tuneStyle(map: maplibregl.Map) {
  if (map.getLayer('place_state')) tuneDarkStyle(map)
  else tuneLightStyle(map)
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

function cityDotElement(nearest: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = nearest ? 'city-dot city-dot-nearest' : 'city-dot'
  return el
}

function labelElement(text: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'line-label'
  el.textContent = text
  return el
}

export default function MapView({ guess, onMapClick, result, dark, units }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const cityMarkersRef = useRef<maplibregl.Marker[]>([])
  const styleUrl = dark ? DARK_STYLE : LIGHT_STYLE
  const styleRef = useRef(styleUrl)
  const lineDataRef = useRef<LineData>(EMPTY)

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

    map.on('style.load', () => {
      tuneStyle(map)
      addGuessLine(map, lineDataRef.current)
    })

    map.on('click', (e) => {
      const { lat, lng } = e.lngLat.wrap()
      onMapClickRef.current(lat, lng)
    })

    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      markerRef.current?.remove()
      markerRef.current = null
      cityMarkersRef.current.forEach((m) => m.remove())
      cityMarkersRef.current = []
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
    const setLine = (data: LineData) => {
      lineDataRef.current = data
      line?.setData(data)
    }
    setLine(EMPTY)

    if (!result || !guess) return

    result.cities.forEach((city, i) => {
      const marker = new maplibregl.Marker({ element: cityDotElement(i === result.closest) })
        .setLngLat([unwrapLon(city.lon, guess.lon), city.lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(`${city.name}, ${city.country}`))
        .addTo(map)
      cityMarkersRef.current.push(marker)
    })

    const nearest = result.cities[result.closest]
    const nearestLon = unwrapLon(nearest.lon, guess.lon)

    setLine({
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

    const label = new maplibregl.Marker({
      element: labelElement(formatDistance(result.distance_m, units)),
    })
      .setLngLat([(guess.lon + nearestLon) / 2, (guess.lat + nearest.lat) / 2])
      .addTo(map)
    cityMarkersRef.current.push(label)

    const wide = map.getContainer().clientWidth > 760
    const padding = wide
      ? { top: 90, right: 90, bottom: 90, left: 410 }
      : { top: 70, right: 40, bottom: 300, left: 40 }

    const bounds = new maplibregl.LngLatBounds()
    bounds.extend([guess.lon, guess.lat])
    bounds.extend([nearestLon, nearest.lat])
    map.fitBounds(bounds, { padding, maxZoom: 10 })
  }, [result, guess, units])

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
