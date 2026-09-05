<script lang="ts">
	import { page } from '$app/state';
	import { ErrorPage } from '@viniaraujo68/plinth/components';
	import { t } from '$lib/messages.js';

	const notFoundBody = (pathname: string | undefined) =>
		pathname ? t('error.notFoundBody', { pathname }) : t('error.notFoundBodyGeneric');
</script>

<div class="min-h-dvh">
	<ErrorPage
		status={page.status}
		message={page.error?.message}
		pathname={page.url.pathname}
		homeHref="/"
		statusLabel={(status) => t('error.status', { status })}
		notFoundTitle={t('error.notFoundTitle')}
		{notFoundBody}
		errorTitle={t('error.title')}
		errorBody={t('error.unexpected')}
		homeLabel={t('error.home')}
		reloadLabel={t('error.reload')}
	/>
</div>
