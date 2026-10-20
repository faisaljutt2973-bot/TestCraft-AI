import React from 'react';
import { Sparkles, School, BookPlus, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar = ({ activeTab, onQuickNewTest, onQuickAddBook, onOpenSidebar }) => {
  const { user } = useAuth();

  const titles = {
    dashboard: 'Academic Dashboard',
    books: 'Textbook Library & Curriculum Ingestion',
    'book-detail': 'Book Details',
    syllabus: 'Curriculum & Education Boards',
    generator: 'AI Test & Exam Paper Generator',
    planner: 'Midterm & Full-Book Exam Planner',
    questions: 'Institutional Question Bank',
    tests: 'Saved Examination Papers',
    editor: 'Saved Examination Papers',
    settings: 'System & Assessment Settings',
    profile: 'My Profile & Account',
    support: 'Help & Support',
    admin: 'Administrator Control Center',
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <button
          onClick={onOpenSidebar}
          className="md:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex-shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight truncate min-w-0">
          {titles[activeTab] || 'TestCraft AI'}
        </h1>

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600 flex-shrink-0 min-w-0">
          <School className="w-3.5 h-3.5 text-brand-600" />
          <span className="max-w-[220px] truncate">{user?.school || 'Beaconhouse School System'}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
        <button
          onClick={onQuickAddBook}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-sm transition-colors"
        >
          <BookPlus className="w-3.5 h-3.5 text-slate-500" />
          <span>Add Book</span>
        </button>

        <button
          onClick={onQuickNewTest}
          className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm shadow-brand-600/20 transition-all hover:scale-[1.02]"
          aria-label="Generate new test"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Generate Test</span>
        </button>
      </div>
    </header>
  );
};
