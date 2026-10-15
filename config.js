// Sustituye estos valores con los de tu proyecto en Supabase:
// (Los encuentras en Supabase -> Project Settings -> API)

const SUPABASE_URL = "https://cdhyeetlcrdktvualgaa.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkaHllZXRsY3Jka3R2dWFsZ2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MjgxMzQsImV4cCI6MjEwNjAwNDEzNH0.1qG7IXwRLSRrWSTFPdlnFs7wHiDPhjQaxH5CVJARR6I";

// Inicializar el cliente de Supabase
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);