import { createClient } from "@supabase/supabase-js";
export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta configurar la base de datos en .env.local.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: {
    fetch: (input, init) => fetch(input, { ...init, signal: init?.signal || AbortSignal.timeout(20000), cache: "no-store" }),
  } });
}
