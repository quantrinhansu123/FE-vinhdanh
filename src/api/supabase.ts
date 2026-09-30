import { createClient } from '@supabase/supabase-js';

// Vite chỉ expose biến có prefix trong envPrefix (mặc định VITE_).
// .env hiện tại dùng NEXT_PUBLIC_SUPABASE_URL nên cần đọc cả 2 để tránh rơi vào fallback example.supabase.co -> "Failed to fetch".
const supabaseUrl =
	import.meta.env.VITE_SUPABASE_URL?.trim() ||
	(import.meta.env as Record<string, string | undefined>).NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey =
	import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
	(import.meta.env as Record<string, string | undefined>).NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
const hasSupabaseConfig = isSupabaseConfigured;

if (!hasSupabaseConfig) {
	console.warn(
		'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env.local to enable Supabase features.'
	);
}

export const supabase = createClient(
	hasSupabaseConfig ? supabaseUrl! : 'https://example.supabase.co',
	hasSupabaseConfig ? supabaseAnonKey! : 'public-anon-key'
);
