import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
	console.warn(
		'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env.local to enable Supabase features.'
	);
}

export const supabase = createClient(
	hasSupabaseConfig ? supabaseUrl! : 'https://example.supabase.co',
	hasSupabaseConfig ? supabaseAnonKey! : 'public-anon-key'
);
