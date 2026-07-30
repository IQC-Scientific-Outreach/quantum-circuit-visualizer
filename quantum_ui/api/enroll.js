// Vercel serverless function: validates a student's class code at enrollment.
// The class code lives only in the CLASS_CODE env var (no VITE_ prefix), so it
// never ships in the client bundle. Returns { ok: true, username } on success.
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel parses JSON bodies automatically, but guard for a raw string too.
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { username, code } = body || {};

  if (typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Please enter your name.' });
  }
  if (typeof code !== 'string' || !code) {
    return res.status(400).json({ error: 'Please enter the class code.' });
  }

  const expected = process.env.CLASS_CODE;
  if (!expected) {
    // Fail closed if the server is misconfigured rather than letting anyone in.
    return res.status(500).json({ error: 'Enrollment is not configured yet.' });
  }

  if (code.trim() !== expected) {
    return res.status(403).json({ error: 'Incorrect class code.' });
  }

  return res.status(200).json({ ok: true, username: username.trim() });
}
