import { createClient } from '@supabase/supabase-js';

// Mengambil URL dan Key dari environment variables (.env)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Membuat dan mengekspor instance Supabase Client agar bisa dipakai di seluruh aplikasi
export const supabase = createClient(supabaseUrl, supabaseAnonKey);