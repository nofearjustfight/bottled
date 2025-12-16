import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ahjcyqdprqczhlvlwlgi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoamN5cWRwcnFjemhsdmx3bGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTg5OTMsImV4cCI6MjA4MTM5NDk5M30.Qxt1QtXJQr2uN9xGsYYU1EfhC9GkeukbNBNo14FCLy4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
