<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	interface Props {
		class?: ClassValue;
		children: Snippet;
	}

	const { class: className, children }: Props = $props();
</script>

<div
	class={[
		'pointer-events-auto flex items-center rounded-[var(--radius-box)] border border-base-content/10 bg-base-100/90 shadow-lg backdrop-blur',
		className
	]}
>
	{@render children()}
</div>
