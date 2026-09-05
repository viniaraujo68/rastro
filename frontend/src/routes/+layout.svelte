<script lang="ts">
	import './layout.css';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Skeleton } from '@viniaraujo68/plinth/components';
	import { Confirmer } from '@viniaraujo68/plinth/confirm';
	import { RoutingContext, setRoutingContext } from '@viniaraujo68/plinth/routing';
	import { AppShell } from '@viniaraujo68/plinth/shell';
	import {
		readThemePreference,
		setThemeContext,
		ThemeContext,
		ThemeController,
		ThemeToggle,
		type ThemePreference
	} from '@viniaraujo68/plinth/theme';
	import { Toaster } from '@viniaraujo68/plinth/toast';
	import { setUserContext } from '@viniaraujo68/plinth/user';
	import { auth, initAuth } from '$lib/auth.svelte.js';
	import BrandMark from '$lib/components/BrandMark.svelte';
	import Icon, { type IconName } from '$lib/components/Icon.svelte';
	import { t } from '$lib/messages.js';
	import { routes } from '$lib/routes.js';
	import { user } from '$lib/user.js';

	const { children }: { children: Snippet } = $props();

	setRoutingContext(new RoutingContext(routes, page));
	setUserContext(user);
	setThemeContext(new ThemeContext(readThemePreference()));

	onMount(initAuth);

	const isLoginRoute = $derived(page.route.id === '/login');
	const signedIn = $derived(auth.ready && auth.session !== null);

	$effect(() => {
		if (!auth.ready) return;
		if (!auth.session && !isLoginRoute) goto('/login');
		if (auth.session && isLoginRoute) goto('/');
	});

	const themePreferenceLabel = (preference: ThemePreference) => t(`theme.${preference}`);

	const themeLabel = (current: ThemePreference, next: ThemePreference) =>
		t('theme.switchTo', {
			current: themePreferenceLabel(current),
			next: themePreferenceLabel(next)
		});
</script>

<ThemeController />

{#if isLoginRoute && !signedIn}
	<div class="min-h-dvh bg-base-200">
		{@render children()}
	</div>
{:else if signedIn && !isLoginRoute}
	<div class="h-dvh">
		<AppShell
			navLabel={t('nav.main')}
			collapseLabel={t('nav.collapse')}
			moreLabel={t('nav.more')}
			closeLabel={t('common.close')}
			logoutLabel={t('auth.signOut')}
		>
			{#snippet brand({ collapsed })}
				<a href="/" class="flex items-center gap-2.5">
					<span
						class="grid size-9 shrink-0 place-items-center rounded-[var(--radius-field)] bg-primary text-primary-content"
					>
						<BrandMark class="size-5" label={collapsed ? t('app.name') : undefined} />
					</span>
					{#if !collapsed}
						<span class="text-lg font-bold tracking-tight">{t('app.name')}</span>
					{/if}
				</a>
			{/snippet}

			{#snippet icon(route)}
				<Icon name={(route.meta.icon ?? 'map') as IconName} class="size-5" />
			{/snippet}

			{#snippet footer()}
				<ThemeToggle iconOnly preferenceLabel={themePreferenceLabel} label={themeLabel} />
			{/snippet}

			{@render children()}
		</AppShell>
	</div>
{:else}
	<div class="grid min-h-dvh place-items-center bg-base-200 p-6">
		<div class="flex flex-col items-center gap-4" role="status" aria-label={t('common.loading')}>
			<span class="grid size-12 place-items-center rounded-[var(--radius-box)] bg-primary text-primary-content">
				<BrandMark class="size-7" />
			</span>
			<Skeleton class="h-3 w-40" />
			<Skeleton class="h-3 w-28" />
		</div>
	</div>
{/if}

<Toaster
	class="z-[80]"
	position="top-end"
	label={t('toast.region')}
	dismissLabel={t('common.close')}
/>

<Confirmer
	confirmLabel={t('common.confirm')}
	cancelLabel={t('common.cancel')}
	closeLabel={t('common.close')}
	challengeLabel={(value) => t('common.typeToConfirm', { value })}
/>
