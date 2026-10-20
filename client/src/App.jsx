import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { BookLibrary } from './pages/BookLibrary';
import { BookDetail } from './pages/BookDetail';
import { SyllabusManager } from './pages/SyllabusManager';
import { TestGenerator } from './pages/TestGenerator';
import { TestEditor } from './pages/TestEditor';
import { ExamPlanner } from './pages/ExamPlanner';
import { QuestionBank } from './pages/QuestionBank';
import { SavedTests } from './pages/SavedTests';
import { Settings } from './pages/Settings';
import { AdminPanel } from './pages/AdminPanel';
import { Profile } from './pages/Profile';
import { Support } from './pages/Support';

const MainApp = () => {
  const { isAuthenticated, loading } = useAuth();
  const initialResetToken = new URLSearchParams(window.location.search).get('resetToken') || '';
  const [authView, setAuthView] = useState(initialResetToken ? 'reset' : 'login'); // 'login' | 'register' | 'reset'
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [preselectedConfig, setPreselectedConfig] = useState({});

  // Deep view states
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);

  // Planner handoff state
  const [preselectedBook, setPreselectedBook] = useState(null);
  const [preselectedChapters, setPreselectedChapters] = useState([]);

  const viewTitles = {
    dashboard: 'Dashboard',
    books: 'My Books & Library',
    'book-detail': 'Book Details',
    syllabus: 'Syllabus & Boards',
    generator: 'Test Generator',
    planner: 'Exam Planner',
    questions: 'Question Bank',
    tests: 'Saved Tests',
    editor: 'Test Editor',
    settings: 'Settings',
    admin: 'Admin Panel',
    support: 'Help & Support',
    profile: 'My Profile',
  };

  useEffect(() => {
    if (loading) return;
    document.title = isAuthenticated
      ? `${viewTitles[activeTab] || 'Dashboard'} | TestCraft AI`
      : 'TestCraft AI - AI-Powered Test & Exam Generator Platform';
  }, [activeTab, isAuthenticated, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600 tracking-wide">Starting TestCraft AI...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'register') {
      return <Register onSwitchToLogin={() => setAuthView('login')} />;
    }
    if (authView === 'reset' && resetToken) {
      return (
        <Login
          resetToken={resetToken}
          onSwitchToRegister={() => setAuthView('register')}
          onResetComplete={() => {
            window.history.replaceState({}, '', window.location.pathname);
            setResetToken('');
            setAuthView('login');
          }}
        />
      );
    }
    return <Login onSwitchToRegister={() => setAuthView('register')} />;
  }

  // Navigation handlers
  const handleSelectBook = (id) => {
    setSelectedBookId(id);
    setActiveTab('book-detail');
  };

  const handleSelectTest = (id) => {
    setSelectedTestId(id);
    setActiveTab('editor');
  };

  const handleStartExamWithBook = (book, chapters) => {
    setPreselectedBook(book);
    setPreselectedChapters(chapters);
    setPreselectedConfig({});
    setActiveTab('generator');
  };

  const handleMakeTestFromBook = (book) => {
    setPreselectedBook(book);
    setPreselectedChapters((book?.chapters || []).map((c) => c.chapterNumber));
    setPreselectedConfig({});
    setActiveTab('generator');
  };

  const handleStartPlannerExam = ({ book, chapters, examType, totalMarks, durationMinutes, questionCounts }) => {
    setPreselectedBook(book);
    setPreselectedChapters(chapters);
    setPreselectedConfig({ examType, totalMarks, durationMinutes, questionCounts });
    setActiveTab('generator');
  };

  const handleTestGenerated = (newTestId) => {
    setSelectedTestId(newTestId);
    setActiveTab('editor');
  };

  const handleQuickNewTest = () => {
    setPreselectedBook(null);
    setPreselectedChapters([]);
    setPreselectedConfig({});
    setActiveTab('generator');
  };

  const handleQuickAddBook = () => {
    setActiveTab('books');
    setIsAddBookModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar (Hidden during browser print) */}
      <div className="no-print">
        <Sidebar
          activeTab={activeTab === 'book-detail' ? 'books' : activeTab === 'editor' ? 'tests' : activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsMobileSidebarOpen(false);
            setSelectedBookId(null);
            setPreselectedBook(null);
            setPreselectedChapters([]);
            setPreselectedConfig({});
          }}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          isMobileOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      </div>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen min-w-0 w-full transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        <div className="no-print">
          <Navbar
            activeTab={activeTab}
            onQuickNewTest={handleQuickNewTest}
            onQuickAddBook={handleQuickAddBook}
            onOpenSidebar={() => setIsMobileSidebarOpen(true)}
          />
        </div>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto min-w-0">
          {activeTab === 'dashboard' && (
            <Dashboard
              setActiveTab={setActiveTab}
              onSelectTest={handleSelectTest}
              onOpenAddBook={handleQuickAddBook}
            />
          )}

          {activeTab === 'books' && (
            <BookLibrary
              onSelectBook={handleSelectBook}
              isAddModalOpen={isAddBookModalOpen}
              setIsAddModalOpen={setIsAddBookModalOpen}
            />
          )}

          {activeTab === 'book-detail' && selectedBookId && (
            <BookDetail
              bookId={selectedBookId}
              onBack={() => setActiveTab('books')}
              onStartExamWithBook={handleStartExamWithBook}
            />
          )}

          {activeTab === 'syllabus' && <SyllabusManager />}

          {activeTab === 'generator' && (
            <TestGenerator
              preselectedBook={preselectedBook}
              preselectedChapters={preselectedChapters}
              preselectedConfig={preselectedConfig}
              onTestGenerated={handleTestGenerated}
            />
          )}

          {activeTab === 'planner' && (
            <ExamPlanner
              onStartPlannerExam={handleStartPlannerExam}
              onOpenAddBook={handleQuickAddBook}
            />
          )}

          {activeTab === 'questions' && <QuestionBank />}

          {activeTab === 'tests' && (
            <SavedTests onSelectTest={handleSelectTest} onStartNewTest={handleQuickNewTest} />
          )}

          {activeTab === 'editor' && selectedTestId && (
            <TestEditor testId={selectedTestId} onBack={() => setActiveTab('tests')} />
          )}

          {activeTab === 'settings' && <Settings />}

          {activeTab === 'profile' && <Profile />}

          {activeTab === 'support' && <Support />}

          {activeTab === 'admin' && <AdminPanel onMakeTest={handleMakeTestFromBook} />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
