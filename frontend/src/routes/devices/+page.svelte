<script lang="ts">
	import { AsyncButton, Skeleton } from '@viniaraujo68/plinth/components';
	import { confirm } from '@viniaraujo68/plinth/confirm';
	import { errorMessage } from '@viniaraujo68/plinth/http';
	import { toast } from '@viniaraujo68/plinth/toast';
	import { auth } from '$lib/auth.svelte.js';
	import Icon from '$lib/components/Icon.svelte';
	import ApiKeyBanner from '$lib/components/devices/ApiKeyBanner.svelte';
	import DeviceCard from '$lib/components/devices/DeviceCard.svelte';
	import PermissionForm from '$lib/components/devices/PermissionForm.svelte';
	import PermissionList from '$lib/components/devices/PermissionList.svelte';
	import {
		createDevice,
		deleteDevice,
		getDevices,
		getPermissions,
		grantPermission,
		revokePermission,
		rotateKey,
		updateDevice
	} from '$lib/api.js';
	import { t } from '$lib/messages.js';
	import type { Device, Permission, PermissionLevel } from '$lib/types.js';

	interface IssuedKey {
		deviceName: string;
		apiKey: string;
	}

	let devices = $state<Device[]>([]);
	let loading = $state(true);
	let expandedId = $state<string | null>(null);
	let creating = $state(false);
	let newName = $state('');
	let issuedKey = $state<IssuedKey | null>(null);
	let permissions = $state<Record<string, Permission[]>>({});
	let permissionsLoading = $state<Record<string, boolean>>({});
	let nameInput = $state<HTMLInputElement>();

	const countLabel = $derived(
		devices.length === 1 ? t('devices.countOne') : t('devices.count', { count: devices.length })
	);

	const isOwner = (device: Device) => device.owner_id === auth.user?.id;

	const loadDevices = async () => {
		loading = true;
		try {
			devices = await getDevices();
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			loading = false;
		}
	};

	const loadPermissions = async (deviceId: string) => {
		permissionsLoading[deviceId] = true;
		try {
			permissions[deviceId] = await getPermissions(deviceId);
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			permissionsLoading[deviceId] = false;
		}
	};

	const toggleExpanded = (device: Device) => {
		if (expandedId === device.id) {
			expandedId = null;
			return;
		}
		expandedId = device.id;
		if (isOwner(device) && !permissions[device.id]) loadPermissions(device.id);
	};

	const toggleCreate = () => {
		creating = !creating;
		if (!creating) newName = '';
	};

	const cancelCreate = () => {
		creating = false;
		newName = '';
	};

	const submitCreate = async () => {
		const name = newName.trim();
		if (!name) return;
		try {
			const device = await createDevice(name);
			issuedKey = { deviceName: device.name, apiKey: device.api_key };
			creating = false;
			newName = '';
			await loadDevices();
			expandedId = device.id;
			if (isOwner(device)) loadPermissions(device.id);
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};

	const toggleActive = async (device: Device) => {
		try {
			await updateDevice(device.id, device.name, !device.is_active);
			await loadDevices();
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};

	const removeDevice = async (device: Device) => {
		const confirmed = await confirm({
			title: t('devices.deleteConfirm', { name: device.name }),
			description: t('devices.deleteConfirmBody'),
			danger: true,
			challenge: device.name
		});
		if (!confirmed) return;
		try {
			await deleteDevice(device.id);
			if (expandedId === device.id) expandedId = null;
			await loadDevices();
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};

	const rotateDeviceKey = async (device: Device) => {
		const confirmed = await confirm({
			title: t('devices.rotateKeyConfirm'),
			description: t('devices.rotateKeyConfirmBody'),
			danger: true
		});
		if (!confirmed) return;
		try {
			const rotated = await rotateKey(device.id);
			issuedKey = { deviceName: device.name, apiKey: rotated.api_key };
		} catch (error) {
			toast.error(errorMessage(error));
		}
	};

	const grant = async (deviceId: string, email: string, permission: PermissionLevel) => {
		await grantPermission(deviceId, email, permission);
		await loadPermissions(deviceId);
	};

	const revoke = async (deviceId: string, permission: Permission) => {
		const confirmed = await confirm({
			title: t('permissions.revokeConfirm'),
			description: t('permissions.revokeConfirmBody', { email: permission.user_email }),
			danger: true
		});
		if (!confirmed) return;
		try {
			await revokePermission(deviceId, permission.user_id);
		} catch (error) {
			toast.error(errorMessage(error));
			return;
		}
		await loadPermissions(deviceId);
	};

	$effect(() => {
		if (creating) nameInput?.focus();
	});

	loadDevices();
</script>

<svelte:head>
	<title>{t('page.devices.title')} · {t('app.name')}</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 sm:p-6">
	<div class="flex items-start justify-between gap-3">
		<div class="flex flex-col">
			<h1 class="text-xl font-bold tracking-tight">{t('page.devices.title')}</h1>
			<p class="text-sm text-base-content/60">{countLabel}</p>
		</div>
		<button
			type="button"
			class="btn btn-primary btn-sm shrink-0"
			aria-expanded={creating}
			onclick={toggleCreate}
		>
			<Icon name="plus" class="size-4" />
			{t('devices.new')}
		</button>
	</div>

	{#if creating}
		<form
			class="card flex flex-col gap-3 border border-base-content/10 bg-base-100 p-4"
			onsubmit={(event) => event.preventDefault()}
		>
			<input
				type="text"
				required
				bind:this={nameInput}
				bind:value={newName}
				class="input w-full"
				placeholder={t('devices.namePlaceholder')}
				aria-label={t('devices.name')}
			/>
			<div class="flex gap-2">
				<AsyncButton class="btn btn-sm btn-primary" type="submit" onclick={submitCreate}>
					{t('devices.create')}
				</AsyncButton>
				<button type="button" class="btn btn-ghost btn-sm" onclick={cancelCreate}>
					{t('common.cancel')}
				</button>
			</div>
		</form>
	{/if}

	{#if issuedKey}
		<ApiKeyBanner
			deviceName={issuedKey.deviceName}
			apiKey={issuedKey.apiKey}
			onDismiss={() => (issuedKey = null)}
		/>
	{/if}

	{#if loading}
		<div class="flex flex-col gap-3" role="status" aria-label={t('common.loading')}>
			<Skeleton class="h-18 w-full" />
			<Skeleton class="h-18 w-full" />
			<Skeleton class="h-18 w-full" />
		</div>
	{:else if devices.length === 0}
		{#if !creating}
			<p class="text-sm text-base-content/60">{t('devices.empty')}</p>
		{/if}
	{:else}
		<div class="flex flex-col gap-3">
			{#each devices as device (device.id)}
				<DeviceCard
					{device}
					expanded={expandedId === device.id}
					onToggle={() => toggleExpanded(device)}
				>
					{#snippet body()}
						{#if isOwner(device)}
							<section class="flex flex-col gap-2.5 border-b border-base-content/10 p-4">
								<h2 class="section-label">{t('devices.apiKey')}</h2>
								<p class="text-xs text-base-content/60">{t('devices.apiKeyHint')}</p>
								<AsyncButton
									class="btn self-start btn-sm"
									onclick={() => rotateDeviceKey(device)}
								>
									<Icon name="refresh" class="size-3.5" />
									{t('devices.rotateKey')}
								</AsyncButton>
							</section>

							<section class="flex flex-col gap-2.5 border-b border-base-content/10 p-4">
								<h2 class="section-label">{t('devices.access')}</h2>
								<PermissionList
									permissions={permissions[device.id] ?? []}
									loading={permissionsLoading[device.id] ?? false}
									onRevoke={(permission) => revoke(device.id, permission)}
								/>
								<PermissionForm
									onGrant={(email, permission) => grant(device.id, email, permission)}
								/>
							</section>

							<section class="flex flex-wrap items-center justify-between gap-2 p-4">
								<AsyncButton class="btn btn-sm" onclick={() => toggleActive(device)}>
									{device.is_active ? t('devices.deactivate') : t('devices.activate')}
								</AsyncButton>
								<AsyncButton
									class="btn btn-sm btn-error btn-soft"
									onclick={() => removeDevice(device)}
								>
									<Icon name="trash" class="size-3.5" />
									{t('devices.delete')}
								</AsyncButton>
							</section>
						{:else}
							<p class="p-4 text-xs text-base-content/60">{t('devices.sharedHint')}</p>
						{/if}
					{/snippet}
				</DeviceCard>
			{/each}
		</div>
	{/if}
</div>
