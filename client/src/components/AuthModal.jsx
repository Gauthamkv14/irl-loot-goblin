import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [infoMsg, setInfoMsg] = useState(null);
  const [isResetPassword, setIsResetPassword] = useState(false);

  if (!isOpen) return null;

  if (!isSupabaseConfigured) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-950/60 border border-amber-700/50 flex items-center justify-center text-2xl">
            🔒
          </div>
          <h3 className="text-xl font-bold text-amber-400 mb-2">
            Supabase Not Configured
          </h3>
          <p className="text-sm text-stone-300 mb-6 leading-relaxed">
            Authentication is currently disabled because Supabase credentials (<code className="text-xs bg-stone-950 px-1 py-0.5 rounded text-amber-200">VITE_SUPABASE_URL</code> and <code className="text-xs bg-stone-950 px-1 py-0.5 rounded text-amber-200">VITE_SUPABASE_PUBLISHABLE_KEY</code>) have not been configured.
          </p>
          <p className="text-xs text-stone-400 mb-6">
            You can continue using the public guest appraisal freely without an account!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (isResetPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setInfoMsg('Password reset instructions sent to your email.');
        setLoading(false);
        return;
      }

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username.trim() || undefined
            }
          }
        });
        if (error) throw error;

        // If email confirmation is enabled, session may be null
        if (data?.user && !data.session) {
          setInfoMsg('Account created! Please check your email inbox to verify your account before logging in.');
          setLoading(false);
          return;
        }

        onAuthSuccess(data.user);
        onClose();
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        onAuthSuccess(data.user);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-stone-900 border border-emerald-900/60 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-200 text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-800 cursor-pointer"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-950 border border-emerald-700/60 text-2xl mb-2">
            👺
          </div>
          <h2 className="text-2xl font-black text-stone-100 tracking-tight">
            {isResetPassword ? 'Reset Password' : isSignUp ? 'Join the Goblin Guild' : 'Enter the Lair'}
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            {isResetPassword
              ? 'Enter your email to receive recovery instructions.'
              : isSignUp
              ? 'Create your adventurer profile to hoard persistent loot.'
              : 'Sign in to access your accumulated outdoor treasures.'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs leading-relaxed">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs leading-relaxed">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && !isResetPassword && (
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                Goblin Moniker (Username)
              </label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Twig_Hoarder_99"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-stone-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="adventurer@realm.com"
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-stone-100 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          {!isResetPassword && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-300">
                  Secret Passphrase
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetPassword(true);
                      setErrorMsg(null);
                      setInfoMsg(null);
                    }}
                    className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    Forgot passphrase?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-stone-100 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-stone-950 transition-colors cursor-pointer shadow-lg shadow-emerald-950/60 disabled:opacity-50"
          >
            {loading
              ? 'Consulting Guild Registry...'
              : isResetPassword
              ? 'Send Reset Link'
              : isSignUp
              ? 'Create Adventurer Account'
              : 'Enter Lair'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-stone-800 text-center text-xs text-stone-400">
          {isResetPassword ? (
            <button
              type="button"
              onClick={() => {
                setIsResetPassword(false);
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className="text-emerald-400 hover:underline font-semibold cursor-pointer"
            >
              ← Back to Sign In
            </button>
          ) : isSignUp ? (
            <p>
              Already an enrolled goblin?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Need a goblin treasury?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                Create Account
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
