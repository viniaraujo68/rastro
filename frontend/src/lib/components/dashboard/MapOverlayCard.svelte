<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		children: Snippet;
	}

	const { title, children }: Props = $props();
</script>

<div
	class="pointer-events-none absolute inset-0 z-20 grid place-items-center p-6"
	role="status"
	aria-live="polite"
>
	<div
		class="max-w-64 rounded-[var(--radius-box)] border border-base-content/10 bg-base-100/90 px-6 py-5 text-center shadow-lg backdrop-blur"
	>
		<p class="text-sm font-semibold">{title}</p>
		<p class="mt-1.5 text-xs leading-relaxed text-base-content/70">
			{@render children()}
		</p>
	</div>
</div>
