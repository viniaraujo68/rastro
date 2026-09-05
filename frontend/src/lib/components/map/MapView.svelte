<script lang="ts" module>
	export type LatLng = [number, number];

	export const DEFAULT_CENTER: LatLng = [-22.9068, -43.1729];
	export const DEFAULT_ZOOM = 12;
	export const FOCUSED_ZOOM = 14;

	const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
	const LIGHT_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
	const EASE_DURATION_MS = 500;
</script>

<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import { onMount, type Snippet } from 'svelte';
	import { getThemeContext } from '@viniaraujo68/plinth/theme';
	import { t } from '$lib/messages.js';
	import { MapHandle, setMapHandle } from './map-context.svelte.js';

	interface Props {
		center?: LatLng;
		zoom?: number;
		animate?: boolean;
		children?: Snippet;
	}

	let {
		center = DEFAULT_CENTER,
		zoom = DEFAULT_ZOOM,
		animate = false,
		children
	}: Props = $props();

	const theme = getThemeContext();
	const handle = new MapHandle();
	setMapHandle(handle);

	const latitude = $derived(center[0]);
	const longitude = $derived(center[1]);

	let container = $state<HTMLDivElement>();
	let instance: maplibregl.Map | undefined;
	let appliedStyleUrl: string | undefined;

	const styleUrlFor = (dark: boolean): string => (dark ? DARK_STYLE_URL : LIGHT_STYLE_URL);

	onMount(() => {
		if (!container) return;

		appliedStyleUrl = styleUrlFor(theme.dark);
		const map = new maplibregl.Map({
			container,
			style: appliedStyleUrl,
			center: [center[1], center[0]],
			zoom,
			maxZoom: 19,
			dragRotate: false,
			touchPitch: false,
			attributionControl: { compact: true }
		});

		map.on('style.load' as 'load', () => {
			handle.styleEpoch += 1;
		});
		map.on('load', () => {
			handle.map = map;
		});

		instance = map;

		return () => {
			handle.map = null;
			instance = undefined;
			map.remove();
		};
	});

	$effect(() => {
		const nextStyleUrl = styleUrlFor(theme.dark);
		if (!instance || nextStyleUrl === appliedStyleUrl) return;
		appliedStyleUrl = nextStyleUrl;
		instance.setStyle(nextStyleUrl);
	});

	$effect(() => {
		const map = handle.map;
		if (!map) return;

		const target = { center: [longitude, latitude] as [number, number], zoom };
		if (animate) map.easeTo({ ...target, duration: EASE_DURATION_MS });
		else map.jumpTo(target);
	});
</script>

<div bind:this={container} class="size-full" role="region" aria-label={t('map.region')}></div>

{#if handle.map}
	{@render children?.()}
{/if}
