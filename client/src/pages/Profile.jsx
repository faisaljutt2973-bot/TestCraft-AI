import React, { useEffect, useRef, useState } from 'react';
import {
  UserCircle,
  Camera,
  Save,
  CheckCircle,
  AlertTriangle,
  Mail,
  School,
  Phone,
  BookOpen,
  Lock,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Profile = () => {
  const { user, isAdmin, updateProfile } = useAuth();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    school: '',
    bio: '',
    subjectSpecialties: '',
    avatar: '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        school: user.school || '',
        bio: user.bio || '',
        subjectSpecialties: (user.subjectSpecialties || []).join(', '),
        avatar: user.avatar || '',
      });
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file for your profile photo.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Profile photo is too large. Please choose an image under 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, avatar: reader.result }));
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    if (passwords.newPassword && passwords.newPassword !== passwords.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        school: form.school,
        bio: form.bio,
        subjectSpecialties: form.subjectSpecialties,
        avatar: form.avatar,
      };
      if (passwords.newPassword) {
        payload.currentPassword = passwords.currentPassword;
        payload.newPassword = passwords.newPassword;
      }
      await updateProfile(payload);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err.message || 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'TC';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg flex flex-col sm:flex-row items-center gap-5">
        <div className="relative flex-shrink-0">
          {form.avatar ? (
            <img
              src={form.avatar}
              alt={form.name || 'Profile'}
              className="w-24 h-24 rounded-2xl object-cover border-4 border-white/30 shadow-lg"
            />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-white/15 border-4 border-white/20 flex items-center justify-center text-2xl font-black">
              {initials}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-2 -right-2 p-2 rounded-full bg-white text-brand-700 shadow-md hover:bg-slate-100"
            title="Upload profile photo"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        <div className="min-w-0 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <h2 className="text-xl font-black truncate">{user?.name || 'Educator'}</h2>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isAdmin ? 'bg-amber-300 text-amber-950' : 'bg-white/20 text-white'
              }`}
            >
              {(user?.role || 'teacher').toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">{user?.email}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{user?.school || 'No school set'}</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-800">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserCircle className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Personal Information</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+92 300 1234567"
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">School / Institution</label>
              <div className="relative">
                <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={form.school}
                  onChange={(e) => setForm({ ...form, school: e.target.value })}
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subjects / Specialties</label>
              <div className="relative">
                <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={form.subjectSpecialties}
                  onChange={(e) => setForm({ ...form, subjectSpecialties: e.target.value })}
                  placeholder="Biology, Chemistry, General Science"
                  className="w-full text-xs pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Separate subjects with commas.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">About Me</label>
              <textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Tell us a little about your teaching experience..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-slate-500">
              Profile photo is stored securely with your account. Max 3 MB.
            </div>
            <div className="flex items-center gap-2">
              {form.avatar && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, avatar: '' })}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Photo</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-xl hover:bg-brand-100 flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Upload Photo</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Change Password</h3>
          </div>
          <p className="text-[11px] text-slate-500">
            Leave these fields blank if you do not want to change your password.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
              <input
                type="password"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                minLength={6}
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                minLength={6}
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl shadow-sm flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
