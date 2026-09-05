<script lang="ts">
	import { Copyable } from '@viniaraujo68/plinth/components';
	import { ThemeToggle, type ThemePreference } from '@viniaraujo68/plinth/theme';
	import { auth } from '$lib/auth.svelte.js';
	import Icon from '$lib/components/Icon.svelte';
	import { t } from '$lib/messages.js';
	import { POLLING_OPTIONS, readPollingMs, writePollingMs } from '$lib/prefs.js';
	import { user } from '$lib/user.js';

	let pollingMs = $state(readPollingMs());

	const selectPolling = (milliseconds: number) => {
		pollingMs = milliseconds;
		writePollingMs(milliseconds);
	};

	const secondsLabel = (milliseconds: number) => `${milliseconds / 1000}s`;

	const themePreferenceLabel = (preference: ThemePreference) => t(`theme.${preference}`);

	const themeLabel = (current: ThemePreference, next: ThemePreference) =>
		t('theme.switchTo', {
			current: themePreferenceLabel(current),
			next: themePreferenceLabel(next)
		});
</script>

<svelte:head>
	<title>{t('nav.settings')} · {t('app.name')}</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-lg flex-col gap-6 p-4 sm:p-6">
	<section class="flex flex-col gap-2">
		<h2 class="section-label">{t('settings.account')}</h2>
		<div class="card border border-base-content/10 bg-base-100">
			<div class="card-body gap-0 p-0">
				<div class="flex items-center gap-3 p-4">
					<span class="grid size-8 shrink-0 place-items-center rounded-[var(--radius-field)] bg-base-300">
						<Icon name="mail" class="size-4" />
					</span>
					<div class="flex min-w-0 flex-col">
						<span class="text-xs text-base-content/60">{t('settings.email')}</span>
						<span class="truncate text-sm">{auth.user?.email ?? ''}</span>
					</div>
				</div>

				<div class="mx-4 h-px bg-base-content/10"></div>

				<div class="flex items-center gap-3 p-4">
					<span class="grid size-8 shrink-0 place-items-center rounded-[var(--radius-field)] bg-base-300">
						<Icon name="user" class="size-4" />
					</span>
					<div class="flex min-w-0 flex-col">
						<span class="text-xs text-base-content/60">{t('settings.userId')}</span>
						<Copyable class="font-mono text-xs">{auth.user?.id ?? ''}</Copyable>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="section-label">{t('settings.preferences')}</h2>
		<div class="card border border-base-content/10 bg-base-100">
			<div class="card-body gap-4 p-4">
				<div class="flex items-start gap-3">
					<span class="grid size-8 shrink-0 place-items-center rounded-[var(--radius-field)] bg-base-300">
						<Icon name="refresh" class="size-4" />
					</span>
					<div class="flex min-w-0 flex-col gap-2">
						<div class="flex flex-col">
							<span class="text-sm font-medium">{t('settings.pollingInterval')}</span>
							<span class="text-xs text-base-content/60">{t('settings.pollingIntervalHint')}</span>
						</div>
						<div class="join" role="group" aria-label={t('settings.pollingInterval')}>
							{#each POLLING_OPTIONS as option (option)}
								<button
									type="button"
									class="btn join-item btn-sm"
									class:btn-primary={pollingMs === option}
									class:btn-soft={pollingMs === option}
									aria-pressed={pollingMs === option}
									onclick={() => selectPolling(option)}
								>
									{secondsLabel(option)}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<div class="h-px bg-base-content/10"></div>

				<div class="flex items-center justify-between gap-3">
					<div class="flex items-center gap-3">
						<span class="grid size-8 shrink-0 place-items-center rounded-[var(--radius-field)] bg-base-300">
							<Icon name="settings" class="size-4" />
						</span>
						<span class="text-sm font-medium">{t('settings.theme')}</span>
					</div>
					<ThemeToggle
						class="btn btn-sm"
						preferenceLabel={themePreferenceLabel}
						label={themeLabel}
					/>
				</div>
			</div>
		</div>
	</section>

	<section class="flex flex-col gap-2">
		<h2 class="section-label">{t('auth.session')}</h2>
		<div class="card border border-base-content/10 bg-base-100">
			<div class="card-body p-4">
				<button type="button" class="btn btn-error btn-soft" onclick={() => user.logout?.()}>
					<Icon name="logout" class="size-4" />
					{t('auth.signOut')}
				</button>
			</div>
		</div>
	</section>
</div>
