import React, { useState, useEffect } from 'react';
import { Sparkles, School, Save, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const Settings = () => {
  const { isAdmin } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    aiProvider: 'gemini',
    geminiApiKey: '',
    openaiApiKey: '',
    googleBooksApiKey: '',
    schoolName: 'Beaconhouse School System',
    schoolLogo: '',
    examHeaderTemplate: 'MIDTERM EXAMINATION - 2026',
    maxExamDuration: 180,
    passingPercentage: 40,
    allowNegativeMarking: false,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const res = await api.getSettings();
        if (res.success && res.settings) {
          setSettings(res.settings);
          setForm({
            aiProvider: res.settings.aiProvider || 'gemini',
            geminiApiKey: res.settings.geminiApiKey || '',
            openaiApiKey: res.settings.openaiApiKey || '',
            googleBooksApiKey: res.settings.googleBooksApiKey || '',
            schoolName: res.settings.schoolName || 'Beaconhouse School System',
            schoolLogo: res.settings.schoolLogo || '',
            examHeaderTemplate: res.settings.examHeaderTemplate || 'MIDTERM EXAMINATION - 2026',
            maxExamDuration: res.settings.maxExamDuration || 180,
            passingPercentage: res.settings.passingPercentage || 40,
            allowNegativeMarking: !!res.settings.allowNegativeMarking,
          });
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = isAdmin
        ? form
        : {
            schoolName: form.schoolName,
            schoolLogo: form.schoolLogo,
            examHeaderTemplate: form.examHeaderTemplate,
            maxExamDuration: form.maxExamDuration,
            passingPercentage: form.passingPercentage,
            allowNegativeMarking: form.allowNegativeMarking,
          };
      const res = await api.updateSettings(payload);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading system settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">System & Assessment Settings</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure curriculum AI models, institutional branding, and examination parameters.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
          >
            {success ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>Saved Successfully!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </>
            )}
          </button>
        </div>

        {/* Section 1: AI Provider Configuration (administrators only) */}
        {isAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Artificial Intelligence Provider</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Active AI Provider</label>
            <select
              value={form.aiProvider}
              onChange={(e) => setForm({ ...form, aiProvider: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
            >
              <option value="gemini">Google Gemini 1.5 Flash (Recommended)</option>
              <option value="openai">OpenAI GPT-4o / GPT-4o-mini</option>
              <option value="heuristic">Local Grounded Heuristic Engine (No API key needed)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google Gemini API Key {settings?.hasGeminiKey && <span className="text-emerald-600 font-bold ml-1">(Configured)</span>}
            </label>
            <input
              type="password"
              placeholder="Enter GEMINI_API_KEY..."
              value={form.geminiApiKey}
              onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-mono focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Used on the server side for structured question generation. Keys are securely stored and never exposed to the frontend.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Google Books API Key (Optional) {settings?.hasGoogleBooksKey && <span className="text-emerald-600 font-bold ml-1">(Configured)</span>}
            </label>
            <input
              type="password"
              placeholder="Enter Google Books API key (optional, public search works without key)..."
              value={form.googleBooksApiKey}
              onChange={(e) => setForm({ ...form, googleBooksApiKey: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-mono focus:outline-none"
            />
          </div>
        </div>
        )}

        {/* Section 2: School & Assessment Profile */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <School className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Institutional Profile & Paper Headers</h3>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">School / College Name</label>
            <input
              type="text"
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Default Examination Heading</label>
            <input
              type="text"
              value={form.examHeaderTemplate}
              onChange={(e) => setForm({ ...form, examHeaderTemplate: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Passing Percentage (%)</label>
              <input
                type="number"
                min="20"
                max="80"
                value={form.passingPercentage}
                onChange={(e) => setForm({ ...form, passingPercentage: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Exam Duration (Mins)</label>
              <input
                type="number"
                min="30"
                max="300"
                value={form.maxExamDuration}
                onChange={(e) => setForm({ ...form, maxExamDuration: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
              />
            </div>
          </div>
        </div>

      </form>
    </div>
  );
};
