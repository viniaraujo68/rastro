<script lang="ts" module>
	const SOURCE_ID = 'rastro-heat';
	const LAYER_ID = 'rastro-heat-layer';
</script>

<script lang="ts">
	import type { GeoJSONSource } from 'maplibre-gl';
	import type { Feature, FeatureCollection, Point } from 'geojson';
	import { untrack } from 'svelte';
	import type { Location } from '$lib/types.js';
	import { getMapHandle } from './map-context.svelte.js';

	interface Props {
		locations: Location[];
	}

	const { locations }: Props = $props();

	const handle = getMapHandle();

	const data = $derived<FeatureCollection<Point>>({
		type: 'FeatureCollection',
		features: locations.map(
			(location) =>
				({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [location.longitude, location.latitude] },
					properties: {}
				}) satisfies Feature<Point>
		)
	});

	$effect(() => {
		const styled = handle.styled;
		if (!styled) return;
		const map = styled.map;

		map.addSource(SOURCE_ID, { type: 'geojson', data: untrack(() => data) });
		map.addLayer({
			id: LAYER_ID,
			type: 'heatmap',
			source: SOURCE_ID,
			paint: {
				'heatmap-weight': 1,
				'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 12, 1.2, 17, 3],
				'heatmap-color': [
					'interpolate',
					['linear'],
					['heatmap-density'],
					0,
					'rgba(0,0,0,0)',
					0.1,
					'rgba(59,127,245,0.55)',
					0.3,
					'#60a5fa',
					0.55,
					'#a78bfa',
					0.78,
					'#c084fc',
					1,
					'#f87171'
				],
				'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 12, 12, 28, 17, 55],
				'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.75, 17, 0.9]
			}
		});

		return () => {
			try {
				if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
				if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
			} catch {
				return;
			}
		};
	});

	$effect(() => {
		const styled = handle.styled;
		const next = data;
		if (!styled) return;
		const source = styled.map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
		source?.setData(next);
	});
</script>
