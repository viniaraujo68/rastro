<script lang="ts" module>
	const LINE_SOURCE_ID = 'rastro-trail';
	const LINE_LAYER_ID = 'rastro-trail-line';
	const POINTS_SOURCE_ID = 'rastro-trail-points';
	const POINTS_LAYER_ID = 'rastro-trail-points-layer';
	const POPUP_OFFSET = 16;
	const EDGE_RADIUS = 9;
	const MAX_INNER_RADIUS = 8;
	const BASE_INNER_RADIUS = 4;
	const FOCUS_RADIUS_BONUS = 3;
</script>

<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import type { GeoJSONSource, MapLayerMouseEvent } from 'maplibre-gl';
	import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
	import { onDestroy, untrack } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import {
		clusterLocations,
		gradientColor,
		GRADIENT_COOL,
		GRADIENT_MID,
		GRADIENT_WARM,
		summarizeCluster,
		type LocationCluster
	} from '$lib/geo.js';
	import { t } from '$lib/messages.js';
	import type { Location } from '$lib/types.js';
	import { getMapHandle } from './map-context.svelte.js';

	interface Props {
		locations: Location[];
		focusedId?: number | null;
		onPointClick?: (location: Location) => void;
	}

	const { locations, focusedId = null, onPointClick }: Props = $props();

	const handle = getMapHandle();

	let hoveredIndex = $state<number | null>(null);
	let popupElement = $state<HTMLDivElement>();
	let popup: maplibregl.Popup | undefined;
	let hoverableClusters: readonly LocationCluster[] = [];

	const clusters = $derived(clusterLocations(locations));
	const lastIndex = $derived(clusters.length - 1);

	const lineData = $derived<FeatureCollection<LineString>>({
		type: 'FeatureCollection',
		features:
			clusters.length > 1
				? [
						{
							type: 'Feature',
							geometry: {
								type: 'LineString',
								coordinates: clusters.map((cluster) => [cluster.longitude, cluster.latitude])
							},
							properties: {}
						} satisfies Feature<LineString>
					]
				: []
	});

	const pointsData = $derived<FeatureCollection<Point>>({
		type: 'FeatureCollection',
		features: clusters.map((cluster, index) => {
			const isEdge = index === 0 || (index === lastIndex && lastIndex > 0);
			const isFocused =
				focusedId != null && cluster.locations.some((entry) => entry.id === focusedId);
			const baseRadius = isEdge
				? EDGE_RADIUS
				: Math.min(MAX_INNER_RADIUS, BASE_INNER_RADIUS + Math.log2(cluster.locations.length + 1));

			return {
				type: 'Feature',
				id: index,
				geometry: { type: 'Point', coordinates: [cluster.longitude, cluster.latitude] },
				properties: {
					index,
					color: gradientColor(lastIndex > 0 ? index / lastIndex : 0),
					radius: isFocused ? baseRadius + FOCUS_RADIUS_BONUS : baseRadius,
					strokeWidth: isFocused ? 3 : 2
				}
			} satisfies Feature<Point>;
		})
	});

	const hoveredCluster = $derived(hoveredIndex === null ? null : (clusters[hoveredIndex] ?? null));
	const summary = $derived(hoveredCluster ? summarizeCluster(hoveredCluster) : null);

	const applyData = (map: maplibregl.Map, sourceId: string, data: FeatureCollection) => {
		const source = map.getSource(sourceId) as GeoJSONSource | undefined;
		source?.setData(data);
	};

	$effect(() => {
		const styled = handle.styled;
		if (!styled) return;
		const map = styled.map;

		map.addSource(LINE_SOURCE_ID, {
			type: 'geojson',
			data: untrack(() => lineData),
			lineMetrics: true
		});
		map.addLayer({
			id: LINE_LAYER_ID,
			type: 'line',
			source: LINE_SOURCE_ID,
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 5],
				'line-opacity': 0.9,
				'line-gradient': [
					'interpolate',
					['linear'],
					['line-progress'],
					0,
					GRADIENT_COOL,
					0.5,
					GRADIENT_MID,
					1,
					GRADIENT_WARM
				]
			}
		});

		map.addSource(POINTS_SOURCE_ID, { type: 'geojson', data: untrack(() => pointsData) });
		map.addLayer({
			id: POINTS_LAYER_ID,
			type: 'circle',
			source: POINTS_SOURCE_ID,
			paint: {
				'circle-radius': ['get', 'radius'],
				'circle-color': ['get', 'color'],
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': ['get', 'strokeWidth']
			}
		});

		const canvas = map.getCanvas();

		const readIndex = (event: MapLayerMouseEvent): number | null => {
			const value = event.features?.[0]?.properties?.index;
			return typeof value === 'number' ? value : null;
		};

		const onMove = (event: MapLayerMouseEvent) => {
			const index = readIndex(event);
			if (index === null) return;
			canvas.style.cursor = 'pointer';
			hoveredIndex = index;
		};

		const onLeave = () => {
			canvas.style.cursor = '';
			hoveredIndex = null;
		};

		const onClick = (event: MapLayerMouseEvent) => {
			const index = readIndex(event);
			if (index === null) return;
			const cluster = clusters[index];
			if (!cluster) return;
			hoveredIndex = index;
			onPointClick?.(cluster.locations[0]);
		};

		map.on('mousemove', POINTS_LAYER_ID, onMove);
		map.on('mouseleave', POINTS_LAYER_ID, onLeave);
		map.on('click', POINTS_LAYER_ID, onClick);

		return () => {
			map.off('mousemove', POINTS_LAYER_ID, onMove);
			map.off('mouseleave', POINTS_LAYER_ID, onLeave);
			map.off('click', POINTS_LAYER_ID, onClick);

			try {
				canvas.style.cursor = '';
				if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
				if (map.getSource(LINE_SOURCE_ID)) map.removeSource(LINE_SOURCE_ID);
				if (map.getLayer(POINTS_LAYER_ID)) map.removeLayer(POINTS_LAYER_ID);
				if (map.getSource(POINTS_SOURCE_ID)) map.removeSource(POINTS_SOURCE_ID);
			} catch {
				return;
			}
		};
	});

	$effect(() => {
		const styled = handle.styled;
		const nextLine = lineData;
		const nextPoints = pointsData;
		if (!styled) return;

		applyData(styled.map, LINE_SOURCE_ID, nextLine);
		applyData(styled.map, POINTS_SOURCE_ID, nextPoints);
	});

	$effect(() => {
		const next = clusters;
		untrack(() => {
			if (next === hoverableClusters) return;
			hoverableClusters = next;
			hoveredIndex = null;
		});
	});

	$effect(() => {
		const styled = handle.styled;
		const cluster = hoveredCluster;
		if (!styled || !popupElement) return;

		if (!cluster) {
			popup?.remove();
			return;
		}

		popup ??= new maplibregl.Popup({
			anchor: 'bottom',
			offset: POPUP_OFFSET,
			closeButton: false,
			closeOnClick: false,
			className: 'rastro-popup'
		}).setDOMContent(popupElement);

		popup.setLngLat([cluster.longitude, cluster.latitude]).addTo(styled.map);
	});

	onDestroy(() => {
		popup?.remove();
		popup = undefined;
	});
</script>

<div hidden>
	<div bind:this={popupElement} class="flex max-w-56 flex-col gap-1">
		{#if summary}
			<strong class="text-sm leading-tight font-semibold">{summary.title}</strong>
			{#if summary.detail}
				<span class="text-xs text-base-content/70">{summary.detail}</span>
			{/if}
			{#if summary.battery}
				<span class="flex items-center gap-1 text-xs text-base-content/70">
					<Icon name="battery" class="size-3.5" label={t('dashboard.battery')} />
					{summary.battery}
				</span>
			{/if}
			{#if summary.address}
				<span class="text-xs leading-snug text-base-content/60">{summary.address}</span>
			{/if}
		{/if}
	</div>
</div>
