<script lang="ts">
	import { getRoutingContext } from '@viniaraujo68/plinth/routing';
	import { t } from '$lib/messages.js';
	import BrandMark from './BrandMark.svelte';

	const routing = getRoutingContext();

	const currentLabel = $derived(routing.matched.at(-1)?.label ?? '');
</script>

<header class="shell-top-bar flex items-center gap-2 border-b border-base-content/10 bg-base-100 px-3 py-2">
	<a href="/" class="flex shrink-0 items-center gap-2">
		<span
			class="grid size-7 shrink-0 place-items-center rounded-[var(--radius-field)] bg-primary text-primary-content"
		>
			<BrandMark class="size-4" />
		</span>
		<span class="text-sm font-bold tracking-tight">{t('app.name')}</span>
	</a>

	{#if currentLabel}
		<span class="h-4 w-px shrink-0 bg-base-content/15"></span>
		<span class="truncate text-sm text-base-content/60">{currentLabel}</span>
	{/if}
</header>

<style>
	@container plinth-shell (min-width: 48rem) {
		.shell-top-bar {
			display: none;
		}
	}
</style>
