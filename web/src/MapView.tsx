import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { type LatLon, type GuessResult } from './api'
import type { FeatureCollection } from 'geojson'

type Props = {
  guess: LatLon | null
  onMapClick: (lat: number, lon: number) => void
  result: GuessResult | null
}

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

function unwrapLon(lon: number, nearLon: number): number {
  if (lon - nearLon > 180) return lon - 360
  if (lon - nearLon < -180) return lon + 360
  return lon
}

export default function MapView({ guess, onMapClick, result }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const cityMarkersRef = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    onMapClickRef.current = onMapClick
  })

  useEffect(() => {
    if (!containerRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [10, 30],
      zoom: 1.5,
    })
    mapRef.current = map

    map.on('load', () => {
      map.addSource('guess-line', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'guess-line',
        type: 'line',
        source: 'guess-line',
        paint: { 'line-color': '#e11d48', 'line-width': 2, 'line-dasharray': [2, 2] },
      })
    })

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
      markerRef.current = new maplibregl.Marker({ color: '#e11d48' })
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

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}