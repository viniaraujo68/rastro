import { goto } from '$app/navigation';
import type { UserContext } from '@viniaraujo68/plinth/user';
import { auth, signOut } from './auth.svelte.js';

const ROLE_USER = 'user';
const ROLE_GUEST = 'guest';

const holds = (role: string): boolean => {
	if (!auth.ready) return false;
	return auth.session ? role === ROLE_USER : role === ROLE_GUEST;
};

export const user: UserContext = {
	get status() {
		if (!auth.ready) return 'loading';
		return auth.session ? 'authenticated' : 'anonymous';
	},
	get data() {
		const email = auth.user?.email ?? '';
		return auth.session ? { name: email, email } : null;
	},
	hasRole: holds,
	hasAnyRole: (roles) => roles.length === 0 || roles.some(holds),
	hasAllRoles: (roles) => roles.every(holds),
	logout: async () => {
		await signOut();
		await goto('/login');
	}
};
