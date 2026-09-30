import { createClient } from '@supabase/supabase-js';

// Search any key in environment variables or localStorage matching SUPABASE_URL
const getSupabaseUrl = (): string => {
  const local = localStorage.getItem('micuadre_supabase_url');
  if (local) return local;

  const env = import.meta.env as Record<string, string | undefined>;

  // Check specific common naming variations
  if (env.VITE_SUPABASE_URL) return env.VITE_SUPABASE_URL;
  if (env.NEXT_PUBLIC_SUPABASE_URL) return env.NEXT_PUBLIC_SUPABASE_URL;
  if (env.NEXT_SUPABASE_URL) return env.NEXT_SUPABASE_URL;

  // Search any environment key containing SUPABASE_URL
  const matchedKey = Object.keys(env).find(k => k.includes('SUPABASE_URL'));
  if (matchedKey && env[matchedKey]) {
    return env[matchedKey]!;
  }

  return '';
};

const isValidKey = (key: string | null | undefined): boolean => {
  if (typeof key !== 'string') return false;
  const k = key.trim();
  if (!k || k === 'placeholder-anon-key' || k.includes('tu-llave-anon')) return false;
  return k.startsWith('eyJ') || k.startsWith('sb_publishable_') || k.startsWith('sb_secret_') || k.length > 20;
};

// Search any key in environment variables or localStorage matching SUPABASE_KEY
const getSupabaseAnonKey = (): string => {
  const local = localStorage.getItem('micuadre_supabase_anon_key');
  if (local && isValidKey(local)) return local;
  if (local && !isValidKey(local)) {
    localStorage.removeItem('micuadre_supabase_anon_key');
  }

  const env = import.meta.env as Record<string, string | undefined>;

  if (isValidKey(env.VITE_SUPABASE_ANON_KEY)) return env.VITE_SUPABASE_ANON_KEY!;
  if (isValidKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) return env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (isValidKey(env.NEXT_SUPABASE_ANON_KEY)) return env.NEXT_SUPABASE_ANON_KEY!;

  const matchedKey = Object.keys(env).find(k => isValidKey(env[k]));
  if (matchedKey && env[matchedKey]) {
    return env[matchedKey]!;
  }

  return '';
};

export const getSupabaseClient = () => {
  const url = getSupabaseUrl() || 'https://placeholder-project.supabase.co';
  const key = getSupabaseAnonKey() || 'placeholder-anon-key';
  return createClient(url, key);
};

export const supabase = getSupabaseClient();

export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  const isPlaceholderUrl =
    !url ||
    url.includes('placeholder-project') ||
    url.includes('tu-proyecto.supabase.co');

  const isPlaceholderKey =
    !key ||
    key === 'placeholder-anon-key' ||
    key.includes('tu-llave-anon');

  return !isPlaceholderUrl && !isPlaceholderKey;
};

export const testSupabaseConnection = async (): Promise<{ success: boolean; message: string; details?: string }> => {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      message: 'Credenciales incompletas',
      details: 'Ingresa tu Project URL y API Key (anon/public) en la pantalla de Configuración o en el archivo .env.local.'
    };
  }

  try {
    const { data, error } = await supabase.from('products').select('id').limit(1);

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          success: false,
          message: 'Tablas no creadas en Supabase',
          details: 'Tu proyecto de Supabase está vacío. Debes ir al "SQL Editor" en tu Dashboard de Supabase y ejecutar el script SQL que se encuentra en la carpeta supabase/schema.sql.'
        };
      }
      if (error.code === 'PGRST301' || error.message.includes('JWT') || error.message.includes('invalid') || error.message.includes('API key')) {
        return {
          success: false,
          message: 'API Key o URL Inválida',
          details: 'La clave API anon/public ingresada no es válida para este proyecto de Supabase. Verifica la clave en Project Settings -> API.'
        };
      }
      return {
        success: false,
        message: 'Error de Permiso / RLS en Supabase',
        details: `Supabase respondió con error: ${error.message}. Asegúrate de habilitar las políticas de acceso RLS en tu SQL Editor.`
      };
    }

    return {
      success: true,
      message: '¡Conexión Exitosa a Supabase!',
      details: `Se estableció comunicación con la base de datos de Supabase. ${data && data.length > 0 ? 'Se encontraron productos en vivo.' : 'La tabla de productos está lista (vacía).'}`
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Error de Red',
      details: `No se pudo conectar a la URL de Supabase: ${err?.message || 'Verifica la URL ingresada'}`
    };
  }
};

