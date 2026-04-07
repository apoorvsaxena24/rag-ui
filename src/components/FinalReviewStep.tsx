import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import type { SkippedStep } from '../store/useStore';
import { exportFAQsToDocx } from '../services/textAnalyzer';
import { saveAs } from 'file-saver';
import {
  CheckCircle, Download, RotateCcw, ArrowRight, ArrowLeft,
  Edit2, Check, ChevronDown, ChevronUp, Cpu, Clock,
  FileSpreadsheet, FileJson, AlertTriangle, SkipForward,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Steps.css';

const STEP_LABELS: Record<SkippedStep, { label: string; stepNum: number }> = {
  unreadable: { label: 'Unreadable Content Check', stepNum: 1 },
  terminology: { label: 'Terminology Check', stepNum: 2 },
  conflicts: { label: 'Conflict Detection', stepNum: 3 },
  faqs: { label: 'FAQs Review', stepNum: 4 },
};

export const FinalReviewStep: React.FC = () => {
  const {
    faqs, parsedDocuments, setCurrentStep,
    acceptFAQ, editFAQ, finalFAQIndex, setFinalFAQIndex,
    versions, publishVersion, ragTrained, activeVersion,
    skippedSteps, unskipStep, resetAll,
  } = useStore();

  const activeFaqs = faqs.filter(f => f.status !== 'deleted');
  const acceptedFaqs = faqs.filter(f => f.status === 'accepted' || f.status === 'edited');
  const allAccepted = activeFaqs.length > 0 && activeFaqs.every(f => f.status === 'accepted' || f.status === 'edited');
  const hasSkipped = skippedSteps.size > 0;
  const canComplete = allAccepted && !hasSkipped;

  const [mode, setMode] = useState<'sequential' | 'all'>('sequential');
  const [editValues, setEditValues] = useState({ question: '', answer: '' });
  const [editing, setEditing] = useState(false);
  const [versionExpanded, setVersionExpanded] = useState(false);

  const currentFAQ = activeFaqs[finalFAQIndex];

  const handleAcceptAndNext = () => {
    if (currentFAQ && currentFAQ.status !== 'accepted' && currentFAQ.status !== 'edited') acceptFAQ(currentFAQ.id);
    if (finalFAQIndex < activeFaqs.length - 1) setFinalFAQIndex(finalFAQIndex + 1);
  };

  const handleAcceptAll = () => {
    activeFaqs.forEach(f => {
      if (f.status !== 'accepted' && f.status !== 'edited') acceptFAQ(f.id);
    });
  };

  const handleStartEdit = () => {
    if (!currentFAQ) return;
    setEditValues({ question: currentFAQ.question, answer: currentFAQ.answer });
    setEditing(true);
  };

  const handleSaveEdit = () => {
    if (!currentFAQ) return;
    editFAQ(currentFAQ.id, editValues.question, editValues.answer);
    setEditing(false);
  };

  const handleTrainRAG = () => { publishVersion(); };

  const handleGoToSkipped = (step: SkippedStep) => {
    unskipStep(step);
    setCurrentStep(STEP_LABELS[step].stepNum);
  };

  const handleDownloadDocx = async () => {
    const blob = await exportFAQsToDocx(acceptedFaqs);
    saveAs(blob, 'Enterprise_FAQs.docx');
  };

  const handleDownloadJSON = () => {
    const data = acceptedFaqs.map(f => ({ question: f.question, answer: f.answer, source: f.sourceDoc }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, 'Enterprise_FAQs.json');
  };

  const handleNewSession = () => { resetAll(); };

  return (
    <div className="review">
      <div className="review-hero">
        <div className="review-icon"><CheckCircle /></div>
        <h2 className="review-title">Final Knowledge Consultation</h2>
        <p className="review-desc">
          {canComplete
            ? `All ${activeFaqs.length} FAQs approved. Ready to train your RAG system.`
            : hasSkipped
              ? 'You have skipped steps that need to be completed before finishing.'
              : `Review and approve each FAQ. ${acceptedFaqs.length} of ${activeFaqs.length} approved so far.`}
        </p>
      </div>

      {hasSkipped && (
        <div className="skipped-banner">
          <AlertTriangle style={{ color: 'var(--color-amber)', flexShrink: 0 }} />
          <div className="skipped-content">
            <h3 className="skipped-title">Skipped Steps Require Attention</h3>
            <p className="skipped-desc">You must complete these steps before finalizing the knowledge base:</p>
            <div className="skipped-list">
              {Array.from(skippedSteps).map(step => (
                <button key={step} onClick={() => handleGoToSkipped(step)} className="skipped-item">
                  <SkipForward style={{ width: '1rem', height: '1rem' }} />
                  {STEP_LABELS[step].label}
                  <ArrowRight style={{ width: '.875rem', height: '.875rem' }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="stats">
        <div className="stat"><div className="stat-val">{parsedDocuments.length}</div><div className="stat-lbl">Documents Processed</div></div>
        <div className="stat"><div className="stat-val primary">{acceptedFaqs.length} / {activeFaqs.length}</div><div className="stat-lbl">FAQs Approved</div></div>
        <div className="stat"><div className="stat-val blue">{activeVersion || 'Draft'}</div><div className="stat-lbl">Knowledge Version</div></div>
      </div>

      {!allAccepted && !hasSkipped && (
        <div className="mode-toggle">
          <button className={`mode-btn ${mode === 'sequential' ? 'active' : ''}`} onClick={() => setMode('sequential')}>Review One-by-One</button>
          <button className={`mode-btn ${mode === 'all' ? 'active' : ''}`} onClick={() => setMode('all')}>Approve All</button>
        </div>
      )}

      {!allAccepted && !hasSkipped && mode === 'sequential' && currentFAQ && (
        <AnimatePresence mode="wait">
          <motion.div key={currentFAQ.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="sequential-card">
            <div className="seq-header">
              <span className="seq-counter">FAQ {finalFAQIndex + 1} of {activeFaqs.length}</span>
              <span className={`tag ${currentFAQ.status === 'accepted' || currentFAQ.status === 'edited' ? 'tag-approved' : 'tag-new'}`}>
                {currentFAQ.status === 'accepted' || currentFAQ.status === 'edited' ? 'ACCEPTED' : 'PENDING'}
              </span>
            </div>
            {editing ? (
              <div className="edit-form">
                <div><label className="edit-label">Question</label><input type="text" className="edit-input" value={editValues.question} onChange={(e) => setEditValues({ ...editValues, question: e.target.value })} /></div>
                <div><label className="edit-label">Answer</label><textarea className="edit-input" rows={4} value={editValues.answer} onChange={(e) => setEditValues({ ...editValues, answer: e.target.value })} /></div>
                <button onClick={handleSaveEdit} className="btn-sm btn-sm-primary"><Check /> Save</button>
              </div>
            ) : (
              <>
                <p className="seq-q">{currentFAQ.question}</p>
                <p className="seq-a">{currentFAQ.answer}</p>
              </>
            )}
            <div className="seq-actions">
              <button disabled={finalFAQIndex === 0} onClick={() => setFinalFAQIndex(finalFAQIndex - 1)} className="btn-outline-sm"><ArrowLeft style={{ width: '1rem', height: '1rem' }} /> Previous</button>
              <div style={{ display: 'flex', gap: '.5rem' }}>
                {!editing && <button onClick={handleStartEdit} className="btn-outline-sm"><Edit2 style={{ width: '1rem', height: '1rem' }} /> Edit</button>}
                <button onClick={handleAcceptAndNext} className="btn-primary">
                  {currentFAQ.status === 'accepted' || currentFAQ.status === 'edited' ? 'Next' : 'Accept & Proceed'} <ArrowRight />
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {!allAccepted && !hasSkipped && mode === 'all' && (
        <div className="approve-all-card">
          <p className="approve-all-text">{activeFaqs.length - acceptedFaqs.length} FAQs still pending. Approve all at once?</p>
          <button onClick={handleAcceptAll} className="btn-primary"><Check /> Accept All ({activeFaqs.length - acceptedFaqs.length} remaining)</button>
        </div>
      )}

      {canComplete && !ragTrained && (
        <div className="train-card">
          <Cpu style={{ width: '2rem', height: '2rem', color: 'var(--color-primary)' }} />
          <h3 className="train-title">All FAQs Approved</h3>
          <p className="train-desc">Your enterprise knowledge base with {activeFaqs.length} FAQs is ready.</p>
          <button onClick={handleTrainRAG} className="btn-primary train-btn"><Cpu style={{ width: '1rem', height: '1rem' }} /> Use this dataset to train the RAG system</button>
        </div>
      )}

      {ragTrained && (
        <>
          <div className="version-section">
            <div className="version-header" onClick={() => setVersionExpanded(!versionExpanded)}>
              <h3 className="version-title"><Clock style={{ width: '1.125rem', height: '1.125rem' }} /> Version History</h3>
              {versionExpanded ? <ChevronUp /> : <ChevronDown />}
            </div>
            {versionExpanded && (
              <div className="version-list">
                {[...versions].reverse().map(v => (
                  <div key={v.id} className={`version-item ${v.version === activeVersion ? 'active' : ''}`}>
                    <div className="version-info">
                      <span className="version-num">{v.version}</span>
                      <span className="version-date">{v.date}</span>
                    </div>
                    <p className="version-summary">{v.summary}</p>
                    <span className="version-qa">{v.faqCount} FAQs</span>
                    {v.version === activeVersion && <span className="tag tag-approved">Active</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="preview-wrap">
            <div className="preview-head"><h3>Consolidated FAQs Preview ({acceptedFaqs.length})</h3></div>
            <div className="preview-list">
              {acceptedFaqs.map((faq, idx) => (
                <div key={faq.id} className="preview-item">
                  <p className="preview-q">Q{idx + 1}: {faq.question}</p>
                  <p className="preview-a">A: {faq.answer}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="review-btns">
            <button onClick={handleNewSession} className="btn-outline"><RotateCcw /> Start New Session</button>
            <button onClick={handleDownloadDocx} className="btn-download"><FileSpreadsheet style={{ width: '1rem', height: '1rem' }} /> Download DOCX</button>
            <button onClick={handleDownloadJSON} className="btn-download"><FileJson style={{ width: '1rem', height: '1rem' }} /> Download JSON</button>
          </div>
        </>
      )}
    </div>
  );
};
