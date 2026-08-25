import { createClient } from '@supabase/supabase-js';

const url = 'https://tmxswirrlzwhzdfloaae.supabase.co';
const key = 'sb_publishable_ojJZ0UbRRUhUTGZlQPR2Lw_7RpC5wVM';

const supabase = createClient(url, key);

async function test() {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    console.log("Users:", data, "Error:", error);
  } catch (err) {
    console.error("Caught error:", err);
  }
}

test();
