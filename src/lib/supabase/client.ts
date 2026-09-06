import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://yubaienethtfubcozehm.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1YmFpZW5ldGh0ZnViY296ZWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTA0OTcsImV4cCI6MjEwMjk2NjQ5N30.GxhzxknhXne0qyE9HGizF1MFa-uPZtRHB04JG5cnvjg";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function isSupabaseConfigured(): boolean {
  return (
    !!supabaseUrl &&
    supabaseUrl !== "https://tu-proyecto.supabase.co" &&
    supabaseUrl !== "https://placeholder-project.supabase.co" &&
    !!supabaseAnonKey &&
    supabaseAnonKey !== "tu-anon-key-aqui" &&
    supabaseAnonKey !== "placeholder-anon-key"
  );
}

