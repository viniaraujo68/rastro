<script lang="ts">
	import { AsyncButton, Select } from '@viniaraujo68/plinth/components';
	import { errorMessage } from '@viniaraujo68/plinth/http';
	import { t } from '$lib/messages.js';
	import type { PermissionLevel } from '$lib/types.js';

	interface Props {
		onGrant: (email: string, permission: PermissionLevel) => Promise<void>;
	}

	let { onGrant }: Props = $props();

	let email = $state('');
	let level = $state<string | null>('view');
	let errorText = $state('');

	const levelOptions = [
		{ value: 'view', label: t('permissions.view') },
		{ value: 'admin', label: t('permissions.admin') }
	];

	const submit = async () => {
		errorText = '';
		if (!email.trim()) return;
		try {
			await onGrant(email.trim(), level === 'admin' ? 'admin' : 'view');
			email = '';
			level = 'view';
		} catch (error) {
			errorText = errorMessage(error);
		}
	};
</script>

<form class="flex flex-col gap-2" onsubmit={(event) => event.preventDefault()}>
	<div class="flex flex-wrap items-center gap-2">
		<input
			type="email"
			required
			bind:value={email}
			class="input h-11 min-w-40 flex-1"
			placeholder={t('permissions.emailPlaceholder')}
			aria-label={t('permissions.email')}
		/>
		<Select
			bind:value={level}
			options={levelOptions}
			class="w-36"
			aria-label={t('permissions.level')}
		/>
		<AsyncButton class="btn h-11 btn-primary" type="submit" onclick={submit}>
			{t('permissions.invite')}
		</AsyncButton>
	</div>

	{#if errorText}
		<div role="alert" class="alert alert-error alert-soft px-2.5 py-1.5 text-xs">{errorText}</div>
	{/if}
</form>
