import * as L from 'leaflet'

declare module 'leaflet' {
  function heatLayer(
    latlngs: Array<[number, number] | [number, number, number]>,
    options?: {
      minOpacity?: number
      maxZoom?: number
      max?: number
      radius?: number
      blur?: number
      gradient?: Record<string, string>
    },
  ): Layer
}

declare module 'leaflet.heat' {
  export default undefined
}
