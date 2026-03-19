import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface Carpeta {
  carpeta_id: string
  user_id: string
  id_padre: string | null
  nombre: string
  created_at: string
}

export interface Recurso {
  recurso_id: string
  created_at: string
  user_id: string
  carpeta_id: string
  nombre: string
  contenido: string
}
