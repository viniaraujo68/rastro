import { redirect } from '@sveltejs/kit';

export const load = (): never => redirect(307, '/');
