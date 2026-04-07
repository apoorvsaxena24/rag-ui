import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { exportFAQsToDocx } from '../services/textAnalyzer';
import { saveAs } from 'file-saver';
import { Check, Edit2, Trash2, ArrowRight, SkipForward, Plus, Download, FileText, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Steps.css';

export const FAQStep: React.FC = () => {
  const {
    faqs, acceptFAQ, editFAQ, deleteFAQ, addFAQ,
    setCurrentStep, skipStep, parsedDocuments,
  } = useStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ question: '', answer: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterSource, setFilterSource] = useState<string>('all');

  const activeFaqs = faqs.filter(f => f.status !== 'deleted');
  const filteredFaqs = activeFaqs.filter(f => {
    const matchesText = !filterText || f.question.toLowerCase().includes(filterText.toLowerCase()) || f.answer.toLowerCase().includes(filterText.toLowerCase());
    const matchesSource = filterSource === 'all' || f.sourceDoc === filterSource;
    return matchesText && matchesSource;
  });

  const acceptedCount = activeFaqs.filter(f => f.status === 'accepted' || f.status === 'edited').length;
  const pendingCount = activeFaqs.filter(f => f.status === 'pending').length;

  const handleEditStart = (faq: any) => {
    setEditingId(faq.id);
    setEditValues({ question: faq.question, answer: faq.answer });
  };

  const handleEditSave = (id: string) => {
    editFAQ(id, editValues.question, editValues.answer);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (newQ.trim() && newA.trim()) {
      addFAQ(newQ.trim(), newA.trim());
      setNewQ('');
      setNewA('');
      setShowAddForm(false);
    }
  };

  const handleDownloadDocx = async () => {
    const toExport = activeFaqs.filter(f => f.status === 'accepted' || f.status === 'edited');
    if (toExport.length === 0) return;
    const blob = await exportFAQsToDocx(toExport);
    saveAs(blob, 'Enterprise_FAQs.docx');
  };

  const handleSkip = () => { skipStep('faqs'); setCurrentStep(5); };

  const docNames = [...new Set(activeFaqs.map(f => f.sourceDoc))];

  return (
    <div className="step">
      <div className="step-head">
        <div>
          <h2 className="step-title">FAQs</h2>
          <p className="step-desc">
            {activeFaqs.length} FAQs generated from {parsedDocuments.length} document(s).
            Accept, edit, or add more as needed.
          </p>
        </div>
        <div className="step-count-row">
          <span className="step-count">{acceptedCount} accepted &bull; {pendingCount} pending</span>
        </div>
      </div>

      <div className="faq-toolbar">
        <div className="faq-search">
          <Search style={{ width: '1rem', height: '1rem' }} />
          <input type="text" placeholder="Filter FAQs..." value={filterText} onChange={e => setFilterText(e.target.value)} className="faq-search-input" />
          {filterText && <button onClick={() => setFilterText('')} className="search-clear-sm"><X /></button>}
        </div>
        {docNames.length > 1 && (
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="filter-select">
            <option value="all">All Sources</option>
            {docNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <button onClick={() => setShowAddForm(true)} className="btn-sm btn-sm-primary"><Plus /> Add FAQ</button>
        <button onClick={handleDownloadDocx} disabled={acceptedCount === 0} className="btn-sm btn-sm-outline"><Download /> Download DOCX</button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="add-faq-form">
            <h4 className="add-faq-title">Add New FAQ</h4>
            <div className="edit-form">
              <div><label className="edit-label">Question</label><input type="text" className="edit-input" placeholder="Type your question..." value={newQ} onChange={e => setNewQ(e.target.value)} /></div>
              <div><label className="edit-label">Answer</label><textarea className="edit-input" rows={3} placeholder="Type the answer..." value={newA} onChange={e => setNewA(e.target.value)} /></div>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <button onClick={handleAdd} disabled={!newQ.trim() || !newA.trim()} className="btn-sm btn-sm-primary"><Check /> Add</button>
                <button onClick={() => setShowAddForm(false)} className="btn-sm btn-sm-outline"><X /> Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="qa-list">
        {filteredFaqs.map((faq, idx) => (
          <motion.div key={faq.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`qa-card ${faq.status === 'accepted' || faq.status === 'edited' ? 'approved' : ''}`}>
            <div className="qa-top">
              <div className="qa-badges">
                <span className="faq-num">#{idx + 1}</span>
                <span className={`tag ${faq.category === 'extracted' ? 'tag-new' : 'tag-updated'}`}>{faq.category === 'extracted' ? 'EXTRACTED' : 'GENERATED'}</span>
                {(faq.status === 'accepted' || faq.status === 'edited') && <span className="tag tag-approved"><Check /> ACCEPTED</span>}
                <span className="faq-source"><FileText style={{ width: '.75rem', height: '.75rem' }} /> {faq.sourceDoc}</span>
              </div>
              <div className="qa-btns">
                {editingId === faq.id ? (
                  <button onClick={() => handleEditSave(faq.id)} className="qa-btn ok"><Check /></button>
                ) : (
                  <>
                    {faq.status !== 'accepted' && faq.status !== 'edited' && (
                      <button onClick={() => acceptFAQ(faq.id)} className="qa-btn ok" title="Accept"><Check /></button>
                    )}
                    <button onClick={() => handleEditStart(faq)} className="qa-btn edit" title="Edit"><Edit2 /></button>
                    <button onClick={() => deleteFAQ(faq.id)} className="qa-btn del" title="Delete"><Trash2 /></button>
                  </>
                )}
              </div>
            </div>

            {editingId === faq.id ? (
              <div className="edit-form">
                <div><label className="edit-label">Question</label><input type="text" className="edit-input" value={editValues.question} onChange={(e) => setEditValues({ ...editValues, question: e.target.value })} /></div>
                <div><label className="edit-label">Answer</label><textarea className="edit-input" rows={3} value={editValues.answer} onChange={(e) => setEditValues({ ...editValues, answer: e.target.value })} /></div>
              </div>
            ) : (
              <div>
                <p className="qa-q">{faq.question}</p>
                <p className="qa-a">{faq.answer}</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {filteredFaqs.length === 0 && (
        <div className="empty-step">
          <Search style={{ width: '2rem', height: '2rem', color: 'var(--color-text-light)' }} />
          <h3>No FAQs match your filter</h3>
        </div>
      )}

      <div className="step-foot sticky-foot">
        <button onClick={handleSkip} className="btn-skip"><SkipForward /> Skip for Now</button>
        <button onClick={() => setCurrentStep(5)} className="btn-primary">Final Review <ArrowRight /></button>
      </div>
    </div>
  );
};
