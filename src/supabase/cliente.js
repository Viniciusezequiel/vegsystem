import { createClient } from '@supabase/supabase-js'

// Certifique-se de que as variáveis começam com VITE_ para Vite
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
