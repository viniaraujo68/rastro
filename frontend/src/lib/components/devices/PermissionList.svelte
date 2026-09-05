<script lang="ts">
	import { AsyncButton, Skeleton } from '@viniaraujo68/plinth/components';
	import { t } from '$lib/messages.js';
	import type { Permission } from '$lib/types.js';

	interface Props {
		permissions: Permission[];
		loading: boolean;
		onRevoke: (permission: Permission) => Promise<void>;
	}

	let { permissions, loading, onRevoke }: Props = $props();
</script>

{#if loading}
	<div class="flex flex-col gap-1.5" role="status" aria-label={t('permissions.loading')}>
		<Skeleton class="h-10 w-full" />
		<Skeleton class="h-10 w-full" />
	</div>
{:else if permissions.length === 0}
	<p class="text-xs text-base-content/60">{t('permissions.empty')}</p>
{:else}
	<ul class="flex flex-col gap-1.5">
		{#each permissions as permission (permission.id)}
			<li
				class="flex items-center justify-between gap-2 rounded-[var(--radius-field)] bg-base-200 px-2.5 py-2"
			>
				<div class="flex min-w-0 items-center gap-2">
					<span class="truncate text-sm">{permission.user_email}</span>
					<span class="badge badge-soft badge-primary badge-xs shrink-0">
						{permission.permission === 'admin' ? t('permissions.admin') : t('permissions.view')}
					</span>
				</div>
				<AsyncButton
					class="btn btn-xs btn-error btn-soft"
					aria-label={t('permissions.revokeLabel', { email: permission.user_email })}
					onclick={() => onRevoke(permission)}
				>
					{t('permissions.revoke')}
				</AsyncButton>
			</li>
		{/each}
	</ul>
{/if}
