export default function handler(req, res) {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  });
}
