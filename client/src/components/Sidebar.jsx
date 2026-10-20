import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  GraduationCap,
  CalendarDays,
  FileQuestion,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  LifeBuoy,
  UserCircle,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen = false,
  onClose,
}) => {
  const { user, logout, isAdmin } = useAuth();

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileOpen, onClose]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'books', label: 'My Books & Library', icon: BookOpen },
    { id: 'syllabus', label: 'Syllabus & Boards', icon: GraduationCap },
    { id: 'generator', label: 'Test Generator', icon: Sparkles, badge: 'AI' },
    { id: 'planner', label: 'Exam Planner', icon: CalendarDays },
    { id: 'questions', label: 'Question Bank', icon: FileQuestion },
    { id: 'tests', label: 'Saved Tests', icon: FileText },
    { id: 'support', label: 'Support', icon: LifeBuoy },
    { id: 'profile', label: 'My Profile', icon: UserCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin Panel', icon: ShieldAlert, badge: 'ADMIN' });
  }

  const handleNavigate = (id) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out md:z-40 md:max-w-none md:transition-all ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}
        aria-label="Main navigation"
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between gap-2 px-4 border-b border-slate-100 flex-shrink-0">
          <div className={`flex items-center gap-2.5 min-w-0 ${isCollapsed ? 'md:mx-auto' : ''}`}>
            <img src="/logo.svg" alt="TestCraft AI" className="w-9 h-9 flex-shrink-0" />
            <div className={`min-w-0 ${isCollapsed ? 'md:hidden' : ''}`}>
              <span className="font-extrabold text-slate-900 tracking-tight text-lg">TestCraft</span>
              <span className="ml-1 text-xs font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">AI</span>
            </div>
          </div>

          {!isCollapsed && (
            <button
              onClick={() => setIsCollapsed(true)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all group relative ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-slate-500 group-hover:text-brand-600'
                  }`}
                />
                <span className={`truncate ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                {item.badge && (
                  <span
                    className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      isActive ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-700'
                    } ${isCollapsed ? 'md:hidden' : ''}`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Tooltip when collapsed (desktop only) */}
                {isCollapsed && (
                  <div className="hidden md:block absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Expand trigger when collapsed */}
        {isCollapsed && (
          <div className="hidden md:flex p-3 justify-center border-t border-slate-100">
            <button
              onClick={() => setIsCollapsed(false)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* User Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <div className={`flex items-center ${isCollapsed ? 'md:justify-center' : 'justify-between'} gap-2`}>
            <button
              onClick={() => handleNavigate('profile')}
              className={`flex items-center gap-2.5 min-w-0 text-left hover:bg-slate-100 rounded-lg p-1 -m-1 transition-colors ${
                isCollapsed ? 'md:hidden' : ''
              }`}
              title="Edit profile"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || 'Profile'}
                  className="w-8 h-8 rounded-full object-cover border border-brand-200 flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-100 border border-brand-200 text-brand-700 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                  {user?.name ? user.name.slice(0, 2) : 'TC'}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.name || 'Educator'}</p>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 capitalize">{user?.role || 'Teacher'}</span>
                  {isAdmin && (
                    <span className="inline-flex items-center px-1 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                      ADMIN
                    </span>
                  )}
                </div>
              </div>
            </button>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
              title="Log Out"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
