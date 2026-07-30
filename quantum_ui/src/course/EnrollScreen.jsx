import { useState } from 'react';
import { Link } from 'react-router-dom';
import { setStudent } from './identity';

// Centered enrollment card (visual language borrowed from FinalScreen). Posts
// { username, code } to /api/enroll; on success stores the username locally and
// notifies CourseApp via onEnrolled so it re-renders past the gate.
export default function EnrollScreen({ onEnrolled }) {
  const [username, setUsername] = useState('');
  const [code, setCode]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState(null);

  const canSubmit = username.trim() && code.trim() && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Enrollment failed. Check your class code.');
        return;
      }
      setStudent({ username: data.username || username.trim() });
      onEnrolled?.();
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 w-full bg-slate-950 text-slate-300 flex flex-col items-center justify-center font-sans gap-6 p-8">
      <div className="text-5xl">🔐</div>
      <h1 className="text-2xl font-bold text-white">Course Access</h1>
      <p className="text-sm text-slate-400 max-w-sm text-center">
        Enter your name and the class code from your instructor to begin.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-700/50 rounded-xl p-6 flex flex-col gap-4 w-full max-w-sm shadow-xl"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Name</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            placeholder="e.g. alex"
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Class code</span>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="••••••"
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </label>

        {error && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? 'Checking…' : 'Enter'}
        </button>
      </form>

      <Link to="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
        ← Back to Visualizer
      </Link>
    </div>
  );
}
