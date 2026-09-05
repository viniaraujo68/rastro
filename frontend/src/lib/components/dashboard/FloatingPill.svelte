<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		panel?: boolean;
		class?: ClassValue;
		children: Snippet;
	}

	const { panel = false, class: className, children }: Props = $props();
</script>

<div
	class={[
		'pointer-events-auto border border-base-content/10 bg-base-100/90 shadow-lg backdrop-blur',
		panel ? 'rounded-[var(--radius-box)]' : 'flex items-center rounded-full',
		className
	]}
>
	{@render children()}
</div>
