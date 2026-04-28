'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  MapPin, Navigation, Car, ArrowRight, AlertCircle, Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParkingNavDto {
  societyName:      string
  gateAddress:      string
  gateLat:          number
  gateLng:          number
  parkingLevelName: string | null
  slotNumber:       string | null
  floorPlanUrl:     string | null
  navigationUrl:    string | null
  instructions:     string | null
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ParkingNavPage() {
  const { token } = useParams<{ token: string }>()
  const [data,    setData]    = useState<ParkingNavDto | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)

  // Fetch nav data from the API
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000'
    fetch(`${apiUrl}/api/v1/parking/nav/${encodeURIComponent(token)}`)
      .then(r => {
        if (!r.ok) throw new Error('Invalid or expired navigation link.')
        return r.json() as Promise<ParkingNavDto>
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [token])

  // Initialise MapLibre once data is ready
  useEffect(() => {
    if (!data || !mapRef.current || mapInstance.current) return

    // Dynamic import so MapLibre is not in the server bundle
    import('maplibre-gl').then(({ default: maplibregl }) => {
      const map = new maplibregl.Map({
        container: mapRef.current!,
        style: 'https://tiles.openfreemap.org/styles/liberty',   // free OSM-based style
        center:  [data.gateLng, data.gateLat],
        zoom:    16,
        attributionControl: false,
      })

      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl(), 'top-right')

      // Gate marker
      const el = document.createElement('div')
      el.className = 'gate-marker'
      el.innerHTML = `
        <div style="
          background:#2563eb;color:#fff;border-radius:50%;width:44px;height:44px;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.35);border:3px solid #fff;
        ">
          <svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24'
               fill='none' stroke='currentColor' stroke-width='2.5'>
            <path d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'/>
            <circle cx='12' cy='9' r='2.5'/>
          </svg>
        </div>
      `

      new maplibregl.Marker({ element: el })
        .setLngLat([data.gateLng, data.gateLat])
        .setPopup(new maplibregl.Popup({ offset: 28 }).setHTML(
          `<div style="font-size:13px;font-weight:600">${data.societyName} — Gate 1</div>
           <div style="font-size:11px;color:#6b7280;margin-top:2px">${data.gateAddress}</div>`
        ))
        .addTo(map)

      // Floor plan overlay (if provided)
      if (data.floorPlanUrl) {
        map.on('load', () => {
          // Approximate bounding box ~80m around gate — adjust per society
          const delta = 0.0004
          map.addSource('floor-plan', {
            type: 'image',
            url: data.floorPlanUrl!,
            coordinates: [
              [data.gateLng - delta, data.gateLat + delta],
              [data.gateLng + delta, data.gateLat + delta],
              [data.gateLng + delta, data.gateLat - delta],
              [data.gateLng - delta, data.gateLat - delta],
            ],
          })
          map.addLayer({
            id: 'floor-plan-layer',
            type: 'raster',
            source: 'floor-plan',
            paint: { 'raster-opacity': 0.75 },
          })
        })
      }

      mapInstance.current = map
    })

    return () => {
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove()
        mapInstance.current = null
      }
    }
  }, [data])

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
      <h1 className="font-bold text-xl text-gray-800 mb-1">Link Expired</h1>
      <p className="text-gray-500 text-sm">{error ?? 'This navigation link is invalid or has expired.'}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header bar */}
      <div className="bg-white border-b border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <div className="bg-brand-600 rounded-xl p-2">
          <Car className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">{data.societyName}</p>
          <p className="text-xs text-gray-400">Visitor Parking Navigation</p>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1" style={{ minHeight: '55vh' }}>
        <div ref={mapRef} className="w-full h-full" style={{ minHeight: '55vh' }} />

        {/* Slot badge overlay */}
        {data.slotNumber && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-lg px-5 py-3 flex items-center gap-3 border border-gray-100">
            <div className="bg-brand-100 rounded-xl p-2">
              <Car className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Your slot</p>
              <p className="font-bold text-gray-900 text-lg leading-tight">{data.slotNumber}</p>
              {data.parkingLevelName && (
                <p className="text-xs text-brand-600">{data.parkingLevelName}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info card */}
      <div className="bg-white rounded-t-3xl shadow-2xl -mt-4 relative z-10 p-5 space-y-4">
        {/* Address row */}
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-gray-800">{data.societyName} — Gate 1</p>
            <p className="text-sm text-gray-500">{data.gateAddress}</p>
          </div>
        </div>

        {/* Instructions */}
        {data.instructions && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wide">Parking Instructions</p>
            <p className="text-sm text-blue-800 leading-relaxed">{data.instructions}</p>
          </div>
        )}

        {/* Navigate button */}
        {data.navigationUrl && (
          <a
            href={data.navigationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl font-semibold text-sm transition"
          >
            <Navigation className="w-4 h-4" />
            Navigate with Google Maps
            <ArrowRight className="w-4 h-4" />
          </a>
        )}

        <p className="text-center text-xs text-gray-300">
          Powered by Digital Societies
        </p>
      </div>

      {/* MapLibre CSS */}
      <style>{`
        @import url('https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css');
        .gate-marker { cursor: pointer; }
      `}</style>
    </div>
  )
}
