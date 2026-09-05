import type { RouteId } from '$app/types';
import type { RoutingConfig } from '@viniaraujo68/plinth/routing';
import { t } from './messages.js';

export const routes: RoutingConfig<RouteId> = {
	meta: {
		'/': { title: () => t('nav.map'), icon: 'map', requiredRoles: ['user'] },
		'/devices': { title: () => t('nav.devices'), icon: 'devices', requiredRoles: ['user'] },
		'/settings': { title: () => t('nav.settings'), icon: 'settings', requiredRoles: ['user'] },
		'/login': { title: () => t('nav.login'), icon: 'user', requiredRoles: ['guest'] }
	},

	pages: import.meta.glob('/src/routes/**/+page.svelte')
};
