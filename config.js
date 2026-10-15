// Valores de tu proyecto en Supabase (Project Settings -> API).
// La "anon key" es pública por diseño: la seguridad real la dan las políticas RLS de schema.sql.
// IMPORTANTE: aquí NO se crea el cliente; se crea una sola vez en app.js.

const SUPABASE_URL = "https://cdhyeetlcrdktvualgaa.supabase.co";
// ID de cliente de Google (Google Cloud -> Credenciales -> tu cliente OAuth).
// Cópialo desde Google Cloud para que quede exacto; debe ser el mismo que está en Supabase.
const GOOGLE_CLIENT_ID = "996594161328-27ra9o86t6r88rdfphu3hfvus0rlrv54.apps.googleusercontent.com";

const SUPABASE_ANON_KEY ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkaHllZXRsY3Jka3R2dWFsZ2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MjgxMzQsImV4cCI6MjEwNjAwNDEzNH0.1qG7IXwRLSRrWSTFPdlnFs7wHiDPhjQaxH5CVJARR6I";
