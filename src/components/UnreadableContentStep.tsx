import React, { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Check, X, ArrowRight, Upload, SkipForward, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import '../styles/Steps.css';

export const UnreadableContentStep: React.FC = () => {
  const {
    unreadableItems, resolveUnreadable, ignoreUnreadable,
    setCurrentStep, skipStep, parsedDocuments,
  } = useStore();
  const [resolutionText, setResolutionText] = useState<Record<string, string>>({});
  const [filterDoc, setFilterDoc] = useState<string>('all');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleResolve = (id: string) => { if (resolutionText[id]) resolveUnreadable(id, resolutionText[id]); };
  const handleFileReplace = (id: string, file: File) => resolveUnreadable(id, `Replaced with file: ${file.name}`);

  const filteredItems = filterDoc === 'all'
    ? unreadableItems
    : unreadableItems.filter(i => i.documentId === filterDoc);

  const pendingCount = unreadableItems.filter(i => i.status === 'pending').length;

  const handleSkip = () => { skipStep('unreadable'); setCurrentStep(2); };

  return (
    <div className="step">
      <div className="step-head">
        <div>
          <h2 className="step-title">Unreadable Content Check</h2>
          <p className="step-desc">Review content the AI couldn't interpret across all {parsedDocuments.length} document(s).</p>
        </div>
        <div className="step-count">
          {unreadableItems.length === 0 ? 'No issues detected' : `${pendingCount} of ${unreadableItems.length} items remaining`}
        </div>
      </div>

      {parsedDocuments.length > 1 && (
        <div className="doc-filter">
          <span className="filter-label">Filter by document:</span>
          <select value={filterDoc} onChange={e => setFilterDoc(e.target.value)} className="filter-select">
            <option value="all">All Documents ({unreadableItems.length})</option>
            {parsedDocuments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name} ({unreadableItems.filter(i => i.documentId === d.id).length})
              </option>
            ))}
          </select>
        </div>
      )}

      {filteredItems.length === 0 ? (
        <div className="empty-step">
          <CheckCircle />
          <h3>All Clear</h3>
          <p>{unreadableItems.length === 0 ? 'No unreadable content detected in the uploaded documents.' : 'No items match the current filter.'}</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Document</th>
                <th>Section</th>
                <th>Issue</th>
                <th>User Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <motion.tr key={item.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={item.status !== 'pending' ? 'done' : ''}>
                  <td><div className="cell-label"><FileText style={{ color: 'var(--color-primary)' }} /><span className="truncate">{item.documentName}</span></div></td>
                  <td>{item.section}</td>
                  <td>
                    <div className="cell-light">{item.issue}</div>
                    {item.context && <div className="context-preview">{item.context}</div>}
                  </td>
                  <td>
                    {item.status === 'pending' ? (
                      <div className="field-group">
                        <textarea placeholder="Provide explanation or text content..." className="text-input" rows={2} value={resolutionText[item.id] || ''} onChange={(e) => setResolutionText({ ...resolutionText, [item.id]: e.target.value })} />
                        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                          <button onClick={() => handleResolve(item.id)} disabled={!resolutionText[item.id]} className="btn-sm btn-sm-primary"><Check /> Resolve</button>
                          <button onClick={() => fileInputRefs.current[item.id]?.click()} className="btn-sm btn-sm-outline">
                            <Upload /> Upload
                            <input ref={el => { fileInputRefs.current[item.id] = el; }} type="file" hidden onChange={(e) => { if (e.target.files?.[0]) handleFileReplace(item.id, e.target.files[0]); }} />
                          </button>
                          <button onClick={() => ignoreUnreadable(item.id)} className="btn-sm btn-sm-outline"><X /> Ignore</button>
                        </div>
                      </div>
                    ) : item.status === 'resolved' ? (
                      <span className="status-ok"><Check /> {item.resolution}</span>
                    ) : (
                      <span className="status-muted"><X /> Ignored</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="step-foot sticky-foot">
        <button onClick={handleSkip} className="btn-skip"><SkipForward /> Skip for Now</button>
        <button onClick={() => setCurrentStep(2)} disabled={pendingCount > 0 && unreadableItems.length > 0} className="btn-primary">
          Next: Terminology Check <ArrowRight />
        </button>
      </div>
    </div>
  );
};

function CheckCircle() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
