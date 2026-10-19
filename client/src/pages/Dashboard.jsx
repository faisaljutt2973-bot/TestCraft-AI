import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Sparkles,
  FileText,
  FileQuestion,
  Plus,
  ArrowRight,
  Printer,
  Edit3,
  Calendar,
  Clock,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { api } from '../services/api';

export const Dashboard = ({ setActiveTab, onSelectTest, onOpenAddBook }) => {
  const [stats, setStats] = useState(null);
  const [recentTests, setRecentTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await api.getStats();
        if (res.success) {
          setStats(res.stats);
          setRecentTests(res.recentTests || []);
        }
      } catch (err) {
        console.error('Failed to load dashboard statistics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const kpis = [
    {
      title: 'Total Textbooks',
      value: stats?.totalBooks ?? '...',
      label: `${stats?.totalChapters ?? 0} Chapters Indexed`,
      icon: BookOpen,
      color: 'from-blue-600 to-indigo-600',
      bg: 'bg-blue-50 text-blue-700',
    },
    {
      title: 'Exams Generated',
      value: stats?.totalTests ?? '...',
      label: 'Syllabus Grounded',
      icon: FileText,
      color: 'from-emerald-600 to-teal-600',
      bg: 'bg-emerald-50 text-emerald-700',
    },
    {
      title: 'Question Bank',
      value: stats?.totalQuestions ?? '...',
      label: 'Multi-Format Items',
      icon: FileQuestion,
      color: 'from-violet-600 to-purple-600',
      bg: 'bg-violet-50 text-violet-700',
    },
    {
      title: 'Active Curricula',
      value: stats?.totalBoards ?? '...',
      label: 'Pakistani & CAIE Boards',
      icon: TrendingUp,
      color: 'from-amber-600 to-orange-600',
      bg: 'bg-amber-50 text-amber-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-900 via-brand-800 to-indigo-900 p-7 text-white shadow-xl shadow-brand-950/10">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-brand-200 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Assisted Assessment Engineering</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Welcome to TestCraft AI
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Create curriculum-aligned question papers, monthly tests, midterms, and final exams grounded directly in your textbooks and chapters.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('generator')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-brand-900 bg-white hover:bg-slate-100 rounded-xl shadow transition-all hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>Generate New Exam</span>
            </button>
            <button
              onClick={onOpenAddBook}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-white/15 hover:bg-white/20 rounded-xl backdrop-blur-sm transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>Add Textbook</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-12 -bottom-12 w-80 h-80 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {kpi.title}
                </span>
                <div className={`p-2 rounded-xl ${kpi.bg}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900">{kpi.value}</span>
                <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Action Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setActiveTab('generator')}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mt-3 group-hover:text-brand-600 transition-colors">
            Guided Test Generator
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Configure chapters, marks, difficulty, question types, and generate a validated exam in 6 guided steps.
          </p>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-600">
            <span>Launch Generator</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('planner')}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mt-3 group-hover:text-purple-600 transition-colors">
            Midterm & Final Planner
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Define multi-chapter cutoffs, chapter weighting distributions, and auto-balance full-term assessments.
          </p>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-purple-600">
            <span>Open Planner</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('questions')}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileQuestion className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mt-3 group-hover:text-emerald-600 transition-colors">
            Question Bank Repository
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Explore curated items across MCQs, short, long, and numerical categories with complete marking rubrics.
          </p>
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-600">
            <span>Manage Bank</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Recent Examinations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recently Generated Question Papers</h3>
            <p className="text-xs text-slate-500">Access and edit your saved assessments</p>
          </div>
          <button
            onClick={() => setActiveTab('tests')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          {recentTests.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No examination papers generated yet. Click "Generate New Exam" to begin.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Paper Title</th>
                  <th className="px-6 py-3">Class & Subject</th>
                  <th className="px-6 py-3">Exam Type</th>
                  <th className="px-6 py-3">Marks</th>
                  <th className="px-6 py-3">Duration</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentTests.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-slate-900">{t.title}</td>
                    <td className="px-6 py-3.5">
                      <span className="font-semibold">{t.className}</span> - {t.subject}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {t.examType}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-bold text-slate-900">{t.totalMarks} M</td>
                    <td className="px-6 py-3.5">{t.durationMinutes} mins</td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectTest(t.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit / Preview</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
