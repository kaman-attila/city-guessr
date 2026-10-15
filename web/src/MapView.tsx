import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { type LatLon } from './api'

type Props = {
  guess: LatLon | null
  onMapClick: (lat: number, lon: number) => void
}

export default function MapView({ guess, onMapClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const onMapClickRef = useRef(onMapClick)

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

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}