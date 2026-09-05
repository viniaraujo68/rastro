<script lang="ts">
	import { signIn, signUp } from '$lib/auth.svelte.js';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { t } from '$lib/messages.js';

	let creatingAccount = $state(false);
	let email = $state('');
	let password = $state('');
	let errorText = $state('');
	let infoText = $state('');
	let submitting = $state(false);

	const selectTab = (signUpTab: boolean) => {
		creatingAccount = signUpTab;
		errorText = '';
		infoText = '';
	};

	const submit = async (event: SubmitEvent) => {
		event.preventDefault();
		errorText = '';
		infoText = '';
		submitting = true;
		try {
			if (creatingAccount) {
				await signUp(email, password);
				infoText = t('login.accountCreated');
			} else {
				await signIn(email, password);
			}
		} catch (error) {
			errorText = error instanceof Error ? error.message : String(error);
		} finally {
			submitting = false;
		}
	};
</script>

<svelte:head>
	<title>{t('login.signIn')} · {t('app.name')}</title>
</svelte:head>

<div class="flex min-h-dvh flex-col items-center justify-center gap-6 p-5">
	<div class="flex flex-col items-center gap-2.5">
		<span
			class="grid size-13 place-items-center rounded-[var(--radius-box)] bg-primary text-primary-content shadow-lg shadow-primary/30"
		>
			<BrandMark class="size-7" label={t('app.name')} />
		</span>
		<h1 class="text-2xl font-bold tracking-tight">{t('app.name')}</h1>
		<p class="text-sm text-base-content/60">{t('app.tagline')}</p>
	</div>

	<div class="card w-full max-w-sm border border-base-content/10 bg-base-100 shadow-xl">
		<div class="card-body gap-5">
			<div role="tablist" class="tabs tabs-box">
				<button
					type="button"
					role="tab"
					class={['tab flex-1 font-medium', creatingAccount ? 'text-base-content/60' : 'tab-active']}
					aria-selected={!creatingAccount}
					onclick={() => selectTab(false)}
				>
					{t('login.signIn')}
				</button>
				<button
					type="button"
					role="tab"
					class={['tab flex-1 font-medium', creatingAccount ? 'tab-active' : 'text-base-content/60']}
					aria-selected={creatingAccount}
					onclick={() => selectTab(true)}
				>
					{t('login.signUp')}
				</button>
			</div>

			<form class="flex flex-col gap-3" onsubmit={submit}>
				<label class="input w-full">
					<Icon name="mail" class="size-4 opacity-50" />
					<input
						type="email"
						required
						autocomplete="email"
						bind:value={email}
						placeholder={t('login.emailPlaceholder')}
						aria-label={t('login.email')}
					/>
				</label>

				<label class="input w-full">
					<Icon name="lock" class="size-4 opacity-50" />
					<input
						type="password"
						required
						autocomplete={creatingAccount ? 'new-password' : 'current-password'}
						bind:value={password}
						placeholder={t('login.passwordPlaceholder')}
						aria-label={t('login.password')}
					/>
				</label>

				{#if errorText}
					<div role="alert" class="alert alert-error alert-soft py-2 text-sm">{errorText}</div>
				{/if}
				{#if infoText}
					<div role="status" class="alert alert-success alert-soft py-2 text-sm">{infoText}</div>
				{/if}

				<button type="submit" class="btn btn-primary mt-1" disabled={submitting}>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
						{t('login.submitting')}
					{:else}
						{creatingAccount ? t('login.signUp') : t('login.signIn')}
					{/if}
				</button>
			</form>
		</div>
	</div>
</div>
