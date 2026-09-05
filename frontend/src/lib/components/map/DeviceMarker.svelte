<script lang="ts">
	import maplibregl from 'maplibre-gl';
	import Icon from '$lib/components/Icon.svelte';
	import { format } from '$lib/format.js';
	import { t } from '$lib/messages.js';
	import type { Location } from '$lib/types.js';
	import { getMapHandle } from './map-context.svelte.js';

	interface Props {
		location: Location;
		deviceName: string;
	}

	const { location, deviceName }: Props = $props();

	const handle = getMapHandle();

	let markerElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let marker: maplibregl.Marker | undefined;

	$effect(() => {
		const map = handle.map;
		if (!map || !markerElement || !popupElement) return;

		const popup = new maplibregl.Popup({
			anchor: 'bottom',
			offset: 16,
			closeButton: false,
			className: 'rastro-popup'
		}).setDOMContent(popupElement);

		marker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
			.setLngLat([location.longitude, location.latitude])
			.setPopup(popup)
			.addTo(map);

		return () => {
			marker?.remove();
			marker = undefined;
		};
	});

	$effect(() => {
		marker?.setLngLat([location.longitude, location.latitude]);
	});
</script>

<div hidden>
	<div bind:this={markerElement} class="device-marker">
		<span class="device-marker-ring"></span>
		<span class="device-marker-dot"></span>
	</div>

	<div bind:this={popupElement} class="flex min-w-40 flex-col gap-1">
		<strong class="text-sm leading-tight font-semibold">{deviceName}</strong>
		{#if location.address}
			<span class="text-xs leading-snug text-base-content/60">{location.address}</span>
		{/if}
		<span class="text-xs text-base-content/70">{format.datetime(location.timestamp)}</span>
		{#if location.battery_level != null}
			<span class="flex items-center gap-1 text-xs text-base-content/70">
				<Icon name="battery" class="size-3.5" label={t('dashboard.battery')} />
				{location.battery_level}%
			</span>
		{/if}
	</div>
</div>

<style>
	.device-marker {
		position: relative;
		display: flex;
		width: 24px;
		height: 24px;
		align-items: center;
		justify-content: center;
	}

	.device-marker-dot {
		position: relative;
		z-index: 1;
		width: 12px;
		height: 12px;
		border: 2px solid var(--color-base-100);
		border-radius: 50%;
		background: var(--color-primary);
		box-shadow: 0 1px 4px color-mix(in oklch, var(--color-base-content) 40%, transparent);
	}

	.device-marker-ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: var(--color-primary);
		opacity: 0;
		animation: device-marker-pulse 2s ease-out infinite;
	}

	@keyframes device-marker-pulse {
		0% {
			opacity: 0.7;
			transform: scale(0.4);
		}
		100% {
			opacity: 0;
			transform: scale(2);
		}
	}
</style>
