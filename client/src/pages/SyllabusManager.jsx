import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  BookOpen,
  MapPin,
  CheckCircle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export const SyllabusManager = () => {
  const { isAdmin } = useAuth();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newBoard, setNewBoard] = useState({
    name: '',
    country: 'Pakistan',
    region: '',
    classes: 'Class 9, Class 10, Class 11, Class 12',
    subjects: 'Biology, Physics, Chemistry, Mathematics, Computer Science, English',
  });

  const fetchBoards = async () => {
    try {
      setLoading(true);
      const res = await api.getBoards();
      if (res.success) {
        setBoards(res.boards);
      }
    } catch (err) {
      console.error('Failed to load boards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    try {
      const res = await api.createBoard({
        name: newBoard.name,
        country: newBoard.country,
        region: newBoard.region,
        classes: newBoard.classes.split(',').map((c) => c.trim()),
        subjects: newBoard.subjects.split(',').map((s) => s.trim()),
      });
      if (res.success) {
        setIsAddModalOpen(false);
        fetchBoards();
        setNewBoard({
          name: '',
          country: 'Pakistan',
          region: '',
          classes: 'Class 9, Class 10',
          subjects: 'Biology, Physics, Chemistry',
        });
      }
    } catch (err) {
      alert(`Failed to add board: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Supported Curricula & Education Boards</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configurable academic structures covering Pakistani provincial/federal boards and international examination councils.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Board</span>
          </button>
        )}
      </div>

      {/* Boards Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading educational boards...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {boards.map((b) => (
            <div
              key={b.id || b._id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {b.country} {b.region ? `• ${b.region}` : ''}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1.5">{b.name}</h3>
                </div>
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Supported Classes / Grades
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(b.classes || []).map((cls, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-800 border border-brand-100"
                    >
                      {cls}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Core Subjects
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(b.subjects || []).map((sub, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Custom Board Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Register Custom Education Board / Curriculum"
        subtitle="Add localized state, provincial, or international academic standards"
      >
        <form onSubmit={handleCreateBoard} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Board Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Sindh Textbook Board, Jamshoro (STBB)"
              value={newBoard.name}
              onChange={(e) => setNewBoard({ ...newBoard, name: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={newBoard.country}
                onChange={(e) => setNewBoard({ ...newBoard, country: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Region / Province</label>
              <input
                type="text"
                placeholder="e.g. Sindh, Federal, Punjab"
                value={newBoard.region}
                onChange={(e) => setNewBoard({ ...newBoard, region: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Classes (Comma-separated) *</label>
            <input
              type="text"
              required
              placeholder="e.g. Class 9, Class 10, Class 11"
              value={newBoard.classes}
              onChange={(e) => setNewBoard({ ...newBoard, classes: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Subjects (Comma-separated) *</label>
            <input
              type="text"
              required
              placeholder="e.g. Biology, Physics, Chemistry, Mathematics"
              value={newBoard.subjects}
              onChange={(e) => setNewBoard({ ...newBoard, subjects: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl"
            >
              Register Board
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
