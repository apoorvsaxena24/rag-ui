import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { searchTermAcrossDocs } from '../services/textAnalyzer';
import { Search, ArrowUp, ArrowDown, ArrowRight, SkipForward, FileText, X, Check, Book, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Steps.css';

export const TerminologyStep: React.FC = () => {
  const {
    parsedDocuments, termSearchQuery, termMatches, termMatchIndex,
    setTermSearch, setTermMatchIndex, setCurrentStep, skipStep,
    undefinedTerms, defineTerm, ignoreTerm,
  } = useStore();

  const [localQuery, setLocalQuery] = useState(termSearchQuery);
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [defText, setDefText] = useState<Record<string, string>>({});
  const [termsExpanded, setTermsExpanded] = useState(true);
  const [searchExpanded, setSearchExpanded] = useState(true);
  const matchRefs = useRef<(HTMLDivElement | null)[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const pendingTerms = undefinedTerms.filter(t => t.status === 'pending');
  const definedTerms = undefinedTerms.filter(t => t.status === 'defined');

  const doSearch = useCallback((query: string) => {
    const matches = searchTermAcrossDocs(parsedDocuments, query);
    setTermSearch(query, matches);
  }, [parsedDocuments, setTermSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) handlePrev();
      else handleNext();
    }
  };

  const handleNext = () => {
    if (termMatches.length === 0) return;
    const next = (termMatchIndex + 1) % termMatches.length;
    setTermMatchIndex(next);
    setSelectedMatch(next);
    scrollToMatch(next);
  };

  const handlePrev = () => {
    if (termMatches.length === 0) return;
    const prev = (termMatchIndex - 1 + termMatches.length) % termMatches.length;
    setTermMatchIndex(prev);
    setSelectedMatch(prev);
    scrollToMatch(prev);
  };

  const scrollToMatch = (index: number) => {
    matchRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  useEffect(() => {
    if (termMatches.length > 0 && selectedMatch === null) setSelectedMatch(0);
  }, [termMatches, selectedMatch]);

  const clearSearch = () => {
    setLocalQuery('');
    setTermSearch('', []);
    setSelectedMatch(null);
  };

  const handleSkip = () => { skipStep('terminology'); setCurrentStep(3); };

  const handleDefine = (id: string) => {
    if (defText[id]?.trim()) defineTerm(id, defText[id].trim());
  };

  const handleTermClick = (term: string) => {
    setLocalQuery(term);
    doSearch(term);
    setSearchExpanded(true);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="highlight">{part}</mark>
        : part,
    );
  };

  return (
    <div className="step">
      <div className="step-head">
        <div>
          <h2 className="step-title">Terminology Check</h2>
          <p className="step-desc">
            {pendingTerms.length} undefined terms detected across {parsedDocuments.length} document(s).
            Define them or search for any word.
          </p>
        </div>
        <div className="step-count">
          {definedTerms.length} defined &bull; {pendingTerms.length} pending
        </div>
      </div>

      {/* --- SECTION 1: Undefined Terms --- */}
      <div className="term-section">
        <button className="term-section-toggle" onClick={() => setTermsExpanded(!termsExpanded)}>
          {termsExpanded ? <ChevronDown /> : <ChevronRight />}
          <Book style={{ width: '1rem', height: '1rem' }} />
          <span>Undefined / Non-English Terms ({pendingTerms.length} pending)</span>
        </button>

        <AnimatePresence>
          {termsExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="term-list-wrap">
              {pendingTerms.length === 0 && definedTerms.length === 0 ? (
                <div className="term-empty">No non-English or undefined terms detected.</div>
              ) : (
                <div className="term-grid">
                  {undefinedTerms.filter(t => t.status !== 'ignored').map(term => (
                    <div key={term.id} className={`term-card ${term.status}`}>
                      <div className="term-card-head">
                        <span className="term-word" onClick={() => handleTermClick(term.displayForm || term.term)}>{term.displayForm || term.term}</span>
                        <span className="term-occ">{term.occurrences}x</span>
                        {term.status === 'defined' && <span className="tag tag-approved"><Check /> Defined</span>}
                      </div>
                      <div className="term-sources">
                        {term.sourceDocNames.map(n => (
                          <span key={n} className="term-src"><FileText style={{ width: '.625rem', height: '.625rem' }} /> {n}</span>
                        ))}
                      </div>
                      {term.sampleContext && (
                        <div className="term-context">{highlightText(term.sampleContext, term.term)}</div>
                      )}
                      {term.status === 'pending' ? (
                        <div className="term-define-row">
                          <input
                            type="text"
                            className="term-define-input"
                            placeholder={`What does "${term.term}" mean?`}
                            value={defText[term.id] || ''}
                            onChange={e => setDefText({ ...defText, [term.id]: e.target.value })}
                            onKeyDown={e => { if (e.key === 'Enter') handleDefine(term.id); }}
                          />
                          <button onClick={() => handleDefine(term.id)} disabled={!defText[term.id]?.trim()} className="btn-sm btn-sm-primary"><Check /></button>
                          <button onClick={() => ignoreTerm(term.id)} className="btn-sm btn-sm-outline"><X /></button>
                        </div>
                      ) : (
                        <div className="term-definition">{term.definition}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- SECTION 2: Search --- */}
      <div className="term-section">
        <button className="term-section-toggle" onClick={() => setSearchExpanded(!searchExpanded)}>
          {searchExpanded ? <ChevronDown /> : <ChevronRight />}
          <Search style={{ width: '1rem', height: '1rem' }} />
          <span>Search Across Documents</span>
        </button>

        <AnimatePresence>
          {searchExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <div className="search-bar-wrap">
                <div className="search-bar">
                  <Search className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Enter a word or phrase to search across all documents..."
                    value={localQuery}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                  />
                  {localQuery && (
                    <button onClick={clearSearch} className="search-clear"><X /></button>
                  )}
                  {termMatches.length > 0 && (
                    <div className="search-nav">
                      <span className="search-count">{termMatchIndex + 1} of {termMatches.length}</span>
                      <button onClick={handlePrev} className="search-nav-btn" title="Previous (Shift+Enter)"><ArrowUp /></button>
                      <button onClick={handleNext} className="search-nav-btn" title="Next (Enter)"><ArrowDown /></button>
                    </div>
                  )}
                  {localQuery && termMatches.length === 0 && (
                    <span className="search-no-match">No matches</span>
                  )}
                </div>
              </div>

              <div className="match-results">
                <AnimatePresence>
                  {termMatches.length > 0 && termMatches.slice(0, 50).map((match, idx) => (
                    <motion.div
                      key={`${match.docId}-${match.pageIndex}-${match.charOffset}`}
                      ref={el => { matchRefs.current[idx] = el; }}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`match-card ${idx === termMatchIndex ? 'active' : ''} ${idx === selectedMatch ? 'selected' : ''}`}
                      onClick={() => { setTermMatchIndex(idx); setSelectedMatch(idx); }}
                    >
                      <div className="match-header">
                        <div className="match-doc">
                          <FileText style={{ width: '.875rem', height: '.875rem' }} />
                          <span>{match.docName}</span>
                        </div>
                        <span className="match-page">Page {match.pageIndex + 1}</span>
                        <span className="match-idx">#{idx + 1}</span>
                      </div>
                      <div className="match-context">
                        {highlightText(match.surroundingText, localQuery)}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {termMatches.length > 50 && (
                  <div className="match-truncated">Showing first 50 of {termMatches.length} matches. Use Previous/Next to navigate all.</div>
                )}

                {!localQuery && (
                  <div className="search-hint">
                    <Search style={{ width: '2rem', height: '2rem', color: 'var(--color-text-light)' }} />
                    <p>Type a term, acronym, or phrase to find all occurrences. Click any undefined term above to search for it.</p>
                    <p className="hint-sub">Use <kbd>Enter</kbd> for Next and <kbd>Shift+Enter</kbd> for Previous.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="step-foot sticky-foot">
        <button onClick={handleSkip} className="btn-skip"><SkipForward /> Skip for Now</button>
        <button onClick={() => setCurrentStep(3)} className="btn-primary">Next: Conflict Detection <ArrowRight /></button>
      </div>
    </div>
  );
};

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
