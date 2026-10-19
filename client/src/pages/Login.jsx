import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, ArrowLeft, CheckCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export const Login = ({ onSwitchToRegister, resetToken = '', onResetComplete }) => {
  const { login } = useAuth();
  const [view, setView] = useState('login'); // 'login' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotResult, setForgotResult] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetDone, setResetDone] = useState(false);

  const isResetMode = Boolean(resetToken);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setForgotResult(null);
      const res = await api.forgotPassword(forgotEmail);
      setForgotResult(res);
    } catch (err) {
      setError(err.message || 'Could not send the reset link.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (resetPasswordValue !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await api.resetPassword(resetToken, resetPasswordValue);
      setResetDone(true);
    } catch (err) {
      setError(err.message || 'Could not reset your password.');
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    setView('login');
    setError(null);
    setForgotResult(null);
    setResetDone(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <img src="/logo.svg" alt="TestCraft AI" className="w-16 h-16 mx-auto" />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">TestCraft AI</h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            AI-Powered Test & Examination Generator Platform for Educators
          </p>
        </div>

        {/* Card */}
        <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-5">
          {isResetMode ? (
            <>
              <div className="text-center space-y-1">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center mx-auto">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Set a new password</h2>
                <p className="text-xs text-slate-500">Choose a new password for your TestCraft AI account.</p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {error}
                </div>
              )}

              {resetDone ? (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Your password has been reset. You can now sign in with your new password.</span>
                  </div>
                  <button
                    onClick={onResetComplete}
                    className="w-full py-2.5 px-4 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Back to Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="At least 6 characters"
                        value={resetPasswordValue}
                        onChange={(e) => setResetPasswordValue(e.target.value)}
                        className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Re-enter your new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>{loading ? 'Resetting...' : 'Reset Password'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </>
          ) : view === 'forgot' ? (
            <>
              <div className="space-y-1">
                <button
                  onClick={goToLogin}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to sign in</span>
                </button>
                <h2 className="text-base font-bold text-slate-900 pt-1">Forgot your password?</h2>
                <p className="text-xs text-slate-500">
                  Enter the email address linked to your account and we will send you a reset link.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {error}
                </div>
              )}

              {forgotResult ? (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{forgotResult.message}</span>
                  </div>
                  {forgotResult.resetUrl && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2">
                      <p className="font-semibold">Development mode: email delivery is not configured.</p>
                      <button
                        onClick={() => {
                          window.location.href = forgotResult.resetUrl;
                        }}
                        className="w-full py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg"
                      >
                        Open Reset Link
                      </button>
                      <p className="text-[10px] text-slate-500 break-all">{forgotResult.resetUrl}</p>
                    </div>
                  )}
                  <button
                    onClick={goToLogin}
                    className="w-full py-2.5 px-4 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        placeholder="you@school.edu"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>{loading ? 'Sending...' : 'Send Reset Link'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <div>
                <h2 className="text-base font-bold text-slate-900">Sign in to your account</h2>
                <p className="text-xs text-slate-500">Access your textbook library and question papers</p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      placeholder="teacher@school.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot');
                        setError(null);
                        setForgotEmail(email);
                      }}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-800"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-sm shadow-brand-600/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          Need a teacher account?{' '}
          <button
            onClick={onSwitchToRegister}
            className="font-bold text-brand-600 hover:text-brand-800 transition-colors"
          >
            Create an Account
          </button>
        </p>
      </div>
    </div>
  );
};
