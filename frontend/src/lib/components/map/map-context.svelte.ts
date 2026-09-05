import { createContext } from 'svelte';
import type { Map as MapLibreMap } from 'maplibre-gl';

export interface StyledMap {
	map: MapLibreMap;
	epoch: number;
}

export class MapHandle {
	map = $state<MapLibreMap | null>(null);
	styleEpoch = $state(0);
	styled = $derived<StyledMap | null>(
		this.map !== null && this.styleEpoch > 0 ? { map: this.map, epoch: this.styleEpoch } : null
	);
}

export const [getMapHandle, setMapHandle] = createContext<MapHandle>();
