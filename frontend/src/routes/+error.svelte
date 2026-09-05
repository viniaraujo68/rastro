<script lang="ts">
	import { page } from '$app/state';
	import { ErrorPage } from '@viniaraujo68/plinth/components';
	import { t } from '$lib/messages.js';
</script>

<div class="min-h-dvh">
	<ErrorPage
		status={page.status}
		message={page.error?.message ?? t('error.unexpected')}
		pathname={page.url.pathname}
		homeHref="/"
	/>
</div>
