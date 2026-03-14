// ════════════════════════════════════════════════
//  SUPABASE CONFIG
// ════════════════════════════════════════════════
const SUPA_URL = 'https://kwbmiyjwmsuqllbqwudo.supabase.co';
const SUPA_KEY = 'sb_publishable_J0mPoTMrkZEj-9Nq2x-VWw_SkhRxr28';
const { createClient } = supabase;
const supa = createClient(SUPA_URL, SUPA_KEY);

const API_URL = 'https://backprop-api.onrender.com';
const TRIAL_DAYS = 7;
const ADMIN_IDS = ['b327a790-03b7-49ed-9795-8459168090f7'];
