<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { format } from '$lib/format.js';
	import { t } from '$lib/messages.js';
	import type { Device } from '$lib/types.js';

	interface Props {
		device: Device;
		expanded: boolean;
		onToggle: () => void;
		body?: Snippet;
	}

	let { device, expanded, onToggle, body }: Props = $props();

	const bodyId = $props.id();

	const lastSeenLabel = $derived(
		device.last_seen ? format.relativeTime(device.last_seen) : t('devices.noData')
	);

	const chevronClass = $derived(
		`size-4 shrink-0 text-base-content/50 transition-transform duration-200${expanded ? ' rotate-180' : ''}`
	);
</script>

<div
	class={[
		'card overflow-hidden border bg-base-100 transition-colors',
		expanded ? 'border-base-content/20' : 'border-base-content/10'
	]}
>
	<button
		type="button"
		class="flex w-full items-center gap-3 p-4 text-start"
		aria-expanded={expanded}
		aria-controls={bodyId}
		onclick={onToggle}
	>
		<span
			class={[
				'grid size-10 shrink-0 place-items-center rounded-[var(--radius-field)]',
				device.is_active ? 'bg-primary/15 text-primary' : 'bg-base-300 text-base-content/50'
			]}
		>
			<Icon name="devices" class="size-4.5" />
		</span>

		<span class="flex min-w-0 flex-1 flex-col gap-1">
			<span class="flex flex-wrap items-center gap-2">
				<span class="text-sm font-semibold">{device.name}</span>
				<span class={['badge badge-soft badge-xs', device.is_active ? 'badge-success' : '']}>
					{device.is_active ? t('devices.active') : t('devices.inactive')}
				</span>
			</span>
			<span class="text-xs text-base-content/60">{lastSeenLabel}</span>
		</span>

		<Icon name="chevronDown" class={chevronClass} />
	</button>

	{#if expanded}
		<div id={bodyId} class="flex flex-col border-t border-base-content/10">
			{@render body?.()}
		</div>
	{/if}
</div>
