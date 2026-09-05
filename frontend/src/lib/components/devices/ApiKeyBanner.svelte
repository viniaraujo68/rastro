<script lang="ts">
	import { untrack } from 'svelte';
	import { Copyable } from '@viniaraujo68/plinth/components';
	import Icon from '$lib/components/Icon.svelte';
	import { t } from '$lib/messages.js';

	interface Props {
		deviceName: string;
		apiKey: string;
		onDismiss: () => void;
	}

	let { deviceName, apiKey, onDismiss }: Props = $props();

	let revealed = $state(false);
	let revealedKey = '';

	const masked = $derived('•'.repeat(Math.min(apiKey.length, 32)));

	$effect(() => {
		const key = apiKey;
		untrack(() => {
			if (key === revealedKey) return;
			revealedKey = key;
			revealed = false;
		});
	});
</script>

<div
	role="status"
	class="alert alert-warning alert-soft flex flex-col items-stretch gap-3 text-start"
>
	<div class="flex items-start justify-between gap-2">
		<strong class="text-sm font-semibold">
			{t('devices.keyBannerTitle', { name: deviceName })}
		</strong>
		<button
			type="button"
			class="btn btn-circle btn-ghost btn-xs"
			aria-label={t('common.close')}
			onclick={onDismiss}
		>
			<Icon name="x" class="size-3.5" />
		</button>
	</div>

	<div class="flex flex-wrap items-center gap-2 rounded-[var(--radius-field)] bg-base-100 p-2">
		<Copyable
			class="min-w-0 flex-1 font-mono text-xs"
			copyableText={apiKey}
			copyLabel={t('common.copy')}
			copiedLabel={t('common.copied')}
		>
			{revealed ? apiKey : masked}
		</Copyable>
		<button
			type="button"
			class="btn btn-ghost btn-xs"
			aria-pressed={revealed}
			onclick={() => (revealed = !revealed)}
		>
			{revealed ? t('devices.keyHide') : t('devices.keyReveal')}
		</button>
	</div>

	<p class="text-xs">
		{t('devices.keyHintPrefix')}
		<code class="rounded bg-base-100 px-1 py-0.5 font-mono">X-Device-Key</code>
		{t('devices.keyHintSuffix')}
	</p>
</div>
