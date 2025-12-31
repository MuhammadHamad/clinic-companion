import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kweueifqpjxlwnisfalc.supabase.co';
const supabaseAnonKey = 'sb_publishable_MKido7u82a76Q5_XmkL44w_dTXLPThf';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
