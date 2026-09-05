import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase.js';

export const auth = $state({
	session: null as Session | null,
	user: null as User | null,
	ready: false
});

const adopt = (session: Session | null) => {
	auth.session = session;
	auth.user = session?.user ?? null;
};

export const initAuth = (): (() => void) => {
	supabase.auth.getSession().then(({ data }) => {
		adopt(data.session);
		auth.ready = true;
	});

	const {
		data: { subscription }
	} = supabase.auth.onAuthStateChange((_event, session) => {
		adopt(session);
		auth.ready = true;
	});

	return () => subscription.unsubscribe();
};

export const signIn = async (email: string, password: string): Promise<void> => {
	const { error } = await supabase.auth.signInWithPassword({ email, password });
	if (error) throw error;
};

export const signUp = async (email: string, password: string): Promise<void> => {
	const { error } = await supabase.auth.signUp({ email, password });
	if (error) throw error;
};

export const signOut = async (): Promise<void> => {
	await supabase.auth.signOut();
	adopt(null);
};
