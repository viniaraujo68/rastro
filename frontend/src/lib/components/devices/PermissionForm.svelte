<script lang="ts">
	import { AsyncAction } from '@viniaraujo68/plinth';
	import { LoadingButton, Select } from '@viniaraujo68/plinth/components';
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

	const grant = new AsyncAction(async () => {
		errorText = '';
		try {
			await onGrant(email.trim(), level === 'admin' ? 'admin' : 'view');
			email = '';
			level = 'view';
		} catch (error) {
			errorText = errorMessage(error);
		}
	});

	const submit = (event: SubmitEvent) => {
		event.preventDefault();
		void grant.run();
	};
</script>

<form class="flex flex-col gap-2" onsubmit={submit}>
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
		<LoadingButton class="btn h-11 btn-primary" type="submit" loading={grant.isPending}>
			{t('permissions.invite')}
		</LoadingButton>
	</div>

	{#if errorText}
		<div role="alert" class="alert alert-error alert-soft px-2.5 py-1.5 text-xs">{errorText}</div>
	{/if}
</form>
