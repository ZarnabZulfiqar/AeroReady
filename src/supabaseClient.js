import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://hjbsjxtzaxmqjuqdsfbc.supabase.co";
const supabaseKey = "sb_publishable_yBT5itKMYPcU362eAtCT1A_b90AWQLn";

export const supabase = createClient(supabaseUrl, supabaseKey);