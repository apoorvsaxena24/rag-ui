import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Layers, ArrowRight, AlertCircle, ArrowLeftRight, SkipForward } from 'lucide-react';
import { motion } from 'framer-motion';
import '../styles/Steps.css';

export const ConflictStep: React.FC = () => {
  const { conflicts, resolveConflict, setCurrentStep, skipStep, parsedDocuments } = useStore();
  const [customResolution, setCustomResolution] = useState<Record<string, string>>({});

  const handleResolve = (id: string, resolution: 'keepA' | 'keepB' | 'custom') => {
    resolveConflict(id, resolution, resolution === 'custom' ? customResolution[id] : undefined);
  };

  const pendingItems = conflicts.filter(item => item.resolution === null);
  const internalConflicts = conflicts.filter(c => c.type === 'internal');
  const crossDocConflicts = conflicts.filter(c => c.type === 'cross-document');

  const handleSkip = () => { skipStep('conflicts'); setCurrentStep(4); };

  return (
    <div className="step">
      <div className="step-head">
        <div>
          <h2 className="step-title">Conflict Detection</h2>
          <p className="step-desc">
            Resolve contradictions within and across {parsedDocuments.length} document(s).
            Includes direct word conflicts and contextual contradictions.
          </p>
        </div>
        <div className="step-count">
          {conflicts.length === 0 ? 'No conflicts detected' : `${pendingItems.length} of ${conflicts.length} conflicts remaining`}
        </div>
      </div>

      {conflicts.length === 0 ? (
        <div className="empty-step">
          <CheckCircle />
          <h3>No Conflicts Found</h3>
          <p>No contradictions were detected within or across the uploaded documents.</p>
        </div>
      ) : (
        <>
          {internalConflicts.length > 0 && (
            <div className="conflict-section">
              <h3 className="qa-section-title"><Layers style={{ width: '1rem', height: '1rem' }} /> Internal Conflicts ({internalConflicts.length})</h3>
              <div className="conflict-list">
                {internalConflicts.map(item => <ConflictCard key={item.id} item={item} customResolution={customResolution} setCustomResolution={setCustomResolution} onResolve={handleResolve} />)}
              </div>
            </div>
          )}

          {crossDocConflicts.length > 0 && (
            <div className="conflict-section">
              <h3 className="qa-section-title"><ArrowLeftRight style={{ width: '1rem', height: '1rem' }} /> Cross-Document Conflicts ({crossDocConflicts.length})</h3>
              <div className="conflict-list">
                {crossDocConflicts.map(item => <ConflictCard key={item.id} item={item} customResolution={customResolution} setCustomResolution={setCustomResolution} onResolve={handleResolve} />)}
              </div>
            </div>
          )}
        </>
      )}

      <div className="step-foot sticky-foot">
        <button onClick={handleSkip} className="btn-skip"><SkipForward /> Skip for Now</button>
        <button onClick={() => setCurrentStep(4)} disabled={pendingItems.length > 0 && conflicts.length > 0} className="btn-primary">Next: FAQs <ArrowRight /></button>
      </div>
    </div>
  );
};

function ConflictCard({ item, customResolution, setCustomResolution, onResolve }: {
  item: any;
  customResolution: Record<string, string>;
  setCustomResolution: (v: Record<string, string>) => void;
  onResolve: (id: string, r: 'keepA' | 'keepB' | 'custom') => void;
}) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`c-card ${item.resolution ? 'resolved' : 'pending'}`}>
      <div className="c-head">
        <div className={`c-icon ${item.type}`}>
          {item.type === 'internal' ? <Layers /> : <ArrowLeftRight />}
        </div>
        <div>
          <p className="c-topic">{item.topic}</p>
          <p className="c-type">{item.sourceA}{item.type === 'cross-document' ? ` vs ${item.sourceB}` : ''}</p>
        </div>
      </div>

      <div className="c-grid">
        <div className={`c-option ${item.resolution === 'keepA' ? 'selected' : ''}`}>
          <div className="c-option-label">
            {item.sourceA}
            {item.pageA && <span className="c-page-badge">Page {item.pageA}</span>}
          </div>
          <div className="c-option-value">{item.valueA}</div>
          {item.resolution === null && <button onClick={() => onResolve(item.id, 'keepA')} className="c-keep">Keep This</button>}
        </div>
        <div className={`c-option ${item.resolution === 'keepB' ? 'selected' : ''}`}>
          <div className="c-option-label">
            {item.sourceB}
            {item.pageB && <span className="c-page-badge">Page {item.pageB}</span>}
          </div>
          <div className="c-option-value">{item.valueB}</div>
          {item.resolution === null && <button onClick={() => onResolve(item.id, 'keepB')} className="c-keep">Keep This</button>}
        </div>
      </div>

      {item.resolution === null ? (
        <div className="c-custom">
          <div className="c-custom-field">
            <label className="c-custom-label">Custom Resolution</label>
            <input type="text" placeholder="Enter a custom value..." className="c-custom-input" value={customResolution[item.id] || ''} onChange={(e) => setCustomResolution({ ...customResolution, [item.id]: e.target.value })} />
          </div>
          <button onClick={() => onResolve(item.id, 'custom')} disabled={!customResolution[item.id]} className="btn-dark">Apply</button>
        </div>
      ) : (
        <div className="c-resolved">
          <AlertCircle />
          Resolved: {item.resolution === 'custom' ? item.customResolution : item.resolution === 'keepA' ? `Kept "${item.sourceA}"` : `Kept "${item.sourceB}"`}
        </div>
      )}
    </motion.div>
  );
}

function CheckCircle() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>;
}
