<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import {
		buildRange,
		DateRangePicker,
		Select,
		type DateRange,
		type DateRangePreset,
		type SelectOption
	} from '@viniaraujo68/plinth/components';
	import { AsyncButton } from '@viniaraujo68/plinth/components';
	import { errorMessage, errorStatus } from '@viniaraujo68/plinth/http';
	import { toast } from '@viniaraujo68/plinth/toast';
	import { getDevices, getLatestLocation, getLocations } from '$lib/api.js';
	import FloatingPanel from '$lib/components/dashboard/FloatingPanel.svelte';
	import MapOverlayCard from '$lib/components/dashboard/MapOverlayCard.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import DeviceMarker from '$lib/components/map/DeviceMarker.svelte';
	import HeatmapLayer from '$lib/components/map/HeatmapLayer.svelte';
	import MapView, {
		DEFAULT_CENTER,
		DEFAULT_ZOOM,
		FOCUSED_ZOOM,
		type LatLng
	} from '$lib/components/map/MapView.svelte';
	import TrailLayer from '$lib/components/map/TrailLayer.svelte';
	import { format, formatKm } from '$lib/format.js';
	import { totalDistanceKm } from '$lib/geo.js';
	import { t, type MessageKey } from '$lib/messages.js';
	import { POLLING_STORAGE_KEY, readPollingMs } from '$lib/prefs.js';
	import type { Device, Location, ViewMode } from '$lib/types.js';

	const DAY_MS = 86_400_000;
	const RANGE_PRESETS: readonly DateRangePreset[] = [
		{ id: '24h', label: '24h', durationMs: DAY_MS }
	];
	const RANGE_RE_ANCHOR_MS = 60_000;
	const NOT_FOUND = 404;
	const RELATIVE_TICK_MS = 5_000;

	const VIEW_MODES: readonly { value: ViewMode; labelKey: MessageKey }[] = [
		{ value: 'realtime', labelKey: 'dashboard.viewRealtime' },
		{ value: 'trail', labelKey: 'dashboard.viewTrail' },
		{ value: 'heatmap', labelKey: 'dashboard.viewHeatmap' }
	];

	let devices = $state<Device[]>([]);
	let devicesLoading = $state(true);
	let devicesFailed = $state(false);
	let selectedDeviceId = $state<string | null>(null);
	let viewMode = $state<ViewMode>('realtime');
	let range = $state<DateRange>(buildRange(RANGE_PRESETS[0]));
	let latestLocation = $state<Location | null>(null);
	let latestLoading = $state(false);
	let latestFailed = $state(false);
	let trailLocations = $state<Location[]>([]);
	let trailLoading = $state(false);
	let trailFailed = $state(false);
	let focusedLocation = $state<Location | null>(null);
	let stableCenter = $state<LatLng | null>(null);
	let animateMap = $state(false);
	let now = $state(Date.now());

	let pollingMs = $state(readPollingMs());
	let latestRequestId = 0;
	let trailDeviceId: string | null = null;

	const selectedDevice = $derived(devices.find((device) => device.id === selectedDeviceId) ?? null);

	const deviceOptions = $derived<SelectOption[]>(
		devices.map((device) => ({ value: device.id, label: device.name }))
	);

	const deviceById = (id: string): Device | null =>
		devices.find((device) => device.id === id) ?? null;

	const mapCenter = $derived<LatLng>(
		focusedLocation
			? [focusedLocation.latitude, focusedLocation.longitude]
			: (stableCenter ?? DEFAULT_CENTER)
	);

	const mapZoom = $derived(stableCenter || focusedLocation ? FOCUSED_ZOOM : DEFAULT_ZOOM);

	const trailDistanceKm = $derived(totalDistanceKm(trailLocations));

	const showNoDevices = $derived(!devicesLoading && !devicesFailed && devices.length === 0);

	const showWaitingForLocation = $derived(
		viewMode === 'realtime' &&
			selectedDeviceId !== null &&
			!latestLoading &&
			!latestFailed &&
			latestLocation === null &&
			devices.length > 0
	);

	const showUpdateFailed = $derived(viewMode === 'realtime' ? latestFailed : trailFailed);

	const fetchLatest = (deviceId: string) => {
		const requestId = (latestRequestId += 1);
		latestLoading = true;
		getLatestLocation(deviceId)
			.then((response) => {
				if (requestId !== latestRequestId) return;
				latestLocation = response.location;
				latestFailed = false;
			})
			.catch((error: unknown) => {
				if (requestId !== latestRequestId) return;
				if (errorStatus(error) === NOT_FOUND) {
					latestLocation = null;
					latestFailed = false;
					return;
				}
				latestFailed = true;
			})
			.finally(() => {
				if (requestId === latestRequestId) latestLoading = false;
			});
	};

	const resetFocus = () => {
		focusedLocation = null;
		animateMap = false;
	};

	const selectDevice = (value: string | null) => {
		selectedDeviceId = value;
		resetFocus();
	};

	const selectViewMode = (mode: ViewMode) => {
		viewMode = mode;
		resetFocus();
	};

	const moveStableCenter = (latitude: number, longitude: number) => {
		const current = untrack(() => stableCenter);
		if (current && current[0] === latitude && current[1] === longitude) return;
		stableCenter = [latitude, longitude];
	};

	const focusPoint = (location: Location) => {
		animateMap = true;
		focusedLocation = location;
	};

	const loadDevices = async () => {
		devicesLoading = true;
		try {
			const loaded = await getDevices();
			devices = loaded;
			devicesFailed = false;
			if (selectedDeviceId === null && loaded.length > 0) selectedDeviceId = loaded[0].id;
		} catch (error) {
			devicesFailed = true;
			toast.error(errorMessage(error));
		} finally {
			devicesLoading = false;
		}
	};

	onMount(() => {
		loadDevices();
		pollingMs = readPollingMs();

		const onStorage = (event: StorageEvent) => {
			if (event.key !== null && event.key !== POLLING_STORAGE_KEY) return;
			pollingMs = readPollingMs();
		};

		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	});

	$effect(() => {
		if (viewMode !== 'realtime') return;

		now = Date.now();
		const timer = setInterval(() => {
			now = Date.now();
		}, RELATIVE_TICK_MS);

		return () => clearInterval(timer);
	});

	$effect(() => {
		const deviceId = viewMode === 'realtime' ? selectedDeviceId : null;
		if (deviceId === null) return;

		const intervalMs = pollingMs;
		latestLocation = null;
		latestFailed = false;
		fetchLatest(deviceId);
		const timer = setInterval(() => fetchLatest(deviceId), intervalMs);

		return () => {
			latestRequestId += 1;
			clearInterval(timer);
		};
	});

	$effect(() => {
		const deviceId = viewMode === 'realtime' ? null : selectedDeviceId;
		if (deviceId === null) return;

		if (deviceId !== trailDeviceId) {
			trailDeviceId = deviceId;
			trailLocations = [];
			trailFailed = false;
		}

		const { from, to } = range;
		let cancelled = false;
		trailLoading = true;

		getLocations(deviceId, from, to)
			.then((response) => {
				if (cancelled) return;
				trailLocations = response.locations ?? [];
				trailFailed = false;
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				trailFailed = true;
				toast.error(errorMessage(error));
			})
			.finally(() => {
				if (!cancelled) trailLoading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const location = latestLocation;
		if (location) moveStableCenter(location.latitude, location.longitude);
	});

	$effect(() => {
		const last = trailLocations.at(-1);
		if (last) moveStableCenter(last.latitude, last.longitude);
	});
</script>

<svelte:head>
	<title>{t('page.map.title')} · {t('app.name')}</title>
</svelte:head>

<div class="relative h-full w-full overflow-hidden">
	<h1 class="sr-only">{t('page.map.title')}</h1>

	<MapView center={mapCenter} zoom={mapZoom} animate={animateMap}>
		{#if viewMode === 'realtime' && latestLocation && selectedDevice}
			<DeviceMarker location={latestLocation} deviceName={selectedDevice.name} />
		{/if}
		{#if viewMode === 'trail'}
			<TrailLayer
				locations={trailLocations}
				focusedId={focusedLocation?.id ?? null}
				onPointClick={focusPoint}
			/>
		{/if}
		{#if viewMode === 'heatmap'}
			<HeatmapLayer locations={trailLocations} />
		{/if}
	</MapView>

	<div class="pointer-events-none absolute inset-x-3 top-3 z-30 flex flex-col items-start gap-2">
		<div class="flex w-full flex-wrap items-start justify-between gap-2">
			<FloatingPanel class="gap-2 py-1 ps-3 pe-1">
				<span
					class={[
						'size-2 shrink-0 rounded-full',
						selectedDevice?.is_active ? 'bg-success' : 'bg-base-content/40'
					]}
					role="img"
					aria-label={selectedDevice?.is_active
						? t('dashboard.deviceStatusActive')
						: t('dashboard.deviceStatusInactive')}
				></span>
				<div class="device-picker flex">
					<Select
						options={deviceOptions}
						value={selectedDeviceId}
						onchange={selectDevice}
						placeholder={t('dashboard.devicePlaceholder')}
						aria-label={t('dashboard.device')}
						disabled={devicesLoading || devices.length === 0}
						class="max-w-56"
					>
						{#snippet option(candidate)}
							{@const active = deviceById(candidate.value)?.is_active ?? false}
							<span class="flex min-w-0 items-center gap-2">
								<span
									class={[
										'size-2 shrink-0 rounded-full',
										active ? 'bg-success' : 'bg-base-content/40'
									]}
									aria-hidden="true"
								></span>
								<span class="truncate">{candidate.label}</span>
								<span class="sr-only">
									{active ? t('devices.active') : t('devices.inactive')}
								</span>
							</span>
						{/snippet}
					</Select>
				</div>
			</FloatingPanel>

			<FloatingPanel class="p-1">
				<div class="join" role="group" aria-label={t('dashboard.viewMode')}>
					{#each VIEW_MODES as mode (mode.value)}
						<button
							type="button"
							class="btn join-item btn-sm"
							class:btn-primary={viewMode === mode.value}
							aria-pressed={viewMode === mode.value}
							onclick={() => selectViewMode(mode.value)}
						>
							{t(mode.labelKey)}
						</button>
					{/each}
				</div>
			</FloatingPanel>
		</div>

		<FloatingPanel class={['max-w-full p-1', viewMode === 'realtime' && 'hidden']}>
			<div class="range-picker">
				<DateRangePicker
					presets={RANGE_PRESETS}
					reAnchorMs={RANGE_RE_ANCHOR_MS}
					label={t('dashboard.range')}
					customLabel={t('dashboard.rangeCustom')}
					fromLabel={t('dashboard.rangeFrom')}
					toLabel={t('dashboard.rangeTo')}
					invalidRangeLabel={t('dashboard.rangeInvalid')}
					onchange={(next) => (range = next)}
				/>
			</div>
		</FloatingPanel>
	</div>

	{#if devicesFailed}
		<div class="pointer-events-none absolute inset-0 z-20 grid place-items-center p-6">
			<div role="alert" class="alert pointer-events-auto max-w-72 alert-error alert-soft">
				<Icon name="alert" class="size-4" />
				<span class="flex-1 text-sm">{t('devices.loadFailed')}</span>
				<AsyncButton class="btn btn-sm" onclick={loadDevices}>
					{t('common.retry')}
				</AsyncButton>
			</div>
		</div>
	{:else if showNoDevices}
		<MapOverlayCard title={t('dashboard.noDevicesTitle')}>
			{t('dashboard.noDevicesHintBefore')}
			<a href="/devices" class="pointer-events-auto link link-primary">{t('nav.devices')}</a>
			{t('dashboard.noDevicesHintAfter')}
		</MapOverlayCard>
	{:else if showWaitingForLocation}
		<MapOverlayCard title={t('dashboard.waitingTitle')}>
			{t('dashboard.waitingHint')}
		</MapOverlayCard>
	{/if}

	<div
		class="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-wrap items-center justify-center gap-2 px-3"
	>
		{#if showUpdateFailed}
			<FloatingPanel class="gap-2 border-error/40 px-3.5 py-1.5">
				<Icon name="alert" class="size-3.5 text-error" />
				<span role="status" class="text-xs font-medium text-error">
					{t('dashboard.updateFailed')}
				</span>
			</FloatingPanel>
		{/if}

		{#if viewMode === 'realtime' && latestLocation}
			<FloatingPanel class="gap-2 px-3.5 py-1.5">
				<span class="pulse-dot" aria-hidden="true">
					<span class="pulse-dot-ring"></span>
					<span class="pulse-dot-core"></span>
				</span>
				<span class="text-xs font-medium text-base-content/70">
					{format.relativeTime(latestLocation.timestamp, now)}
				</span>
				{#if latestLocation.battery_level != null}
					<span class="h-3 w-px shrink-0 bg-base-content/15"></span>
					<Icon name="battery" class="size-3.5 text-base-content/60" />
					<span class="text-xs font-medium text-base-content/70">
						{latestLocation.battery_level}%
					</span>
				{/if}
			</FloatingPanel>
		{:else if viewMode === 'trail' && !trailLoading}
			<FloatingPanel class="px-3.5 py-1.5">
				<span class="text-xs font-medium text-base-content/70">
					{trailLocations.length > 0
						? t('dashboard.trailDistance', { distance: formatKm(trailDistanceKm) })
						: t('dashboard.rangeEmpty')}
				</span>
			</FloatingPanel>
		{:else if viewMode === 'heatmap' && !trailLoading}
			<FloatingPanel class="px-3.5 py-1.5">
				<span class="text-xs font-medium text-base-content/70">
					{#if trailLocations.length === 0}
						{t('dashboard.rangeEmpty')}
					{:else if trailLocations.length === 1}
						{t('dashboard.heatmapPoint')}
					{:else}
						{t('dashboard.heatmapPoints', { count: trailLocations.length })}
					{/if}
				</span>
			</FloatingPanel>
		{/if}
	</div>
</div>

<style>
	.device-picker :global(.select) {
		width: auto;
		height: 2rem;
		min-height: 2rem;
		border: none;
		background-color: transparent;
		box-shadow: none;
		padding-inline: 0.25rem 1.75rem;
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.range-picker :global(.btn),
	.range-picker :global(.input) {
		height: 2rem;
		min-height: 2rem;
		font-size: 0.8125rem;
	}

	.range-picker :global(.btn) {
		padding-inline: 0.75rem;
	}

	.range-picker :global(.input) {
		width: 11.5rem;
	}

	.pulse-dot {
		position: relative;
		display: flex;
		width: 10px;
		height: 10px;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
	}

	.pulse-dot-core {
		position: relative;
		z-index: 1;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-success);
	}

	.pulse-dot-ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: var(--color-success);
		animation: status-pulse 2s ease-out infinite;
	}

	@keyframes status-pulse {
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
