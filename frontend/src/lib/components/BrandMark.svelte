<script lang="ts">
	interface Props {
		class?: string;
		label?: string;
	}

	let { class: className = 'size-[1em]', label }: Props = $props();
</script>

<svg
	class={className}
	viewBox="96 122 320 320"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	<circle cx="256" cy="220" r="72" fill="none" stroke="currentColor" stroke-width="36" />
	<path d="M256 292 L256 420" stroke="currentColor" stroke-width="28" stroke-linecap="round" />
</svg>
