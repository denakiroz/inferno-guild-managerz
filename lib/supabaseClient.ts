
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Create the client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
