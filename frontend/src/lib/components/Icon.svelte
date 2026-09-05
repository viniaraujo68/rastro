<script lang="ts" module>
	const ICON_PATHS = {
		map: ['M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z', 'M9 4v13', 'M15 7v13'],
		devices: [
			'M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z',
			'M12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'
		],
		settings: [
			'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
			'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
		],
		logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
		plus: ['M12 5v14', 'M5 12h14'],
		chevronDown: ['M6 9l6 6 6-6'],
		copy: [
			'M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2',
			'M16 4h2a2 2 0 0 1 2 2v4',
			'M12 2h4v4h-4z'
		],
		check: ['M20 6L9 17l-5-5'],
		trash: ['M3 6h18', 'M19 6l-1 14H6L5 6', 'M8 6V4h8v2'],
		key: [
			'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4'
		],
		refresh: [
			'M23 4v6h-6',
			'M1 20v-6h6',
			'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
			'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'
		],
		x: ['M18 6L6 18', 'M6 6l12 12'],
		user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
		lock: [
			'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z',
			'M7 11V7a5 5 0 0 1 10 0v4'
		],
		mail: [
			'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
			'M22 6l-10 7L2 6'
		],
		battery: ['M17 7H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z', 'M21 11v2'],
		link: [
			'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
			'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
		],
		share: ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6l-4-4-4 4', 'M12 2v13'],
		alert: [
			'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
			'M12 9v4',
			'M12 17h.01'
		]
	} as const;

	export type IconName = keyof typeof ICON_PATHS;
</script>

<script lang="ts">
	interface Props {
		name: IconName;
		class?: string;
		label?: string;
	}

	let { name, class: className = 'size-[1.125em]', label }: Props = $props();
</script>

<svg
	class={className}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.8"
	stroke-linecap="round"
	stroke-linejoin="round"
	role={label ? 'img' : undefined}
	aria-label={label}
	aria-hidden={label ? undefined : 'true'}
>
	{#each ICON_PATHS[name] as d (d)}
		<path {d} />
	{/each}
</svg>
