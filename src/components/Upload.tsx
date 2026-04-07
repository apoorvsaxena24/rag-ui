import React, { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { parseFile } from '../services/documentParser';
import { Upload as UploadIcon, FileText, X, Link, Eye, Edit2, RotateCcw, Loader2, ToggleLeft, ToggleRight, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Upload.css';

export const Upload: React.FC = () => {
  const {
    parsedDocuments, addParsedDocument, removeParsedDocument,
    setCurrentStep, knowledgeCreated, setKnowledgeCreated,
    versions, faqs, uploadMode, setUploadMode,
    isProcessing, setProcessing, runIngestion,
  } = useStore();

  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    setParseErrors([]);
    setProcessing(true, 'Reading documents...');

    for (const file of fileArray) {
      try {
        const doc = await parseFile(file);
        addParsedDocument(doc);
      } catch (err: any) {
        setParseErrors(prev => [...prev, `${file.name}: ${err.message}`]);
      }
    }
    setProcessing(false);
  }, [addParsedDocument, setProcessing]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    addParsedDocument({
      id: `url-${Date.now()}`,
      name: urlInput.trim(),
      text: `[URL reference: ${urlInput.trim()}]`,
      pages: [`[URL reference: ${urlInput.trim()}]`],
      pageCount: 1,
      size: 0,
      uploadDate: new Date().toISOString().split('T')[0],
    });
    setUrlInput('');
  };

  const handleIngest = async () => {
    if (parsedDocuments.length === 0) return;
    setProcessing(true, 'Analyzing documents for unreadable content, conflicts, and generating FAQs...');
    await new Promise(r => setTimeout(r, 800));
    runIngestion();
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return 'URL';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (knowledgeCreated) {
    const latestVersion = versions[versions.length - 1];
    const acceptedCount = faqs.filter(f => f.status === 'accepted' || f.status === 'edited').length;
    return (
      <div className="upload-wrap">
        <div className="card">
          <h2 className="card-title">Enterprise Knowledge Content</h2>
          <p className="card-desc">Your consolidated knowledge base is ready.</p>
          <div className="knowledge-file">
            <div className="kf-info">
              <div className="doc-icon"><FileText /></div>
              <div>
                <p className="doc-name">Enterprise_Knowledge_Base.json</p>
                <p className="doc-meta">Last Updated: {latestVersion?.date} &bull; {parsedDocuments.length} Documents &bull; {acceptedCount} FAQs</p>
              </div>
            </div>
            <div className="kf-status"><span className="badge badge-approved">Active &bull; {latestVersion?.version}</span></div>
          </div>
          <div className="kf-actions">
            <button onClick={() => setCurrentStep(5)} className="btn-primary"><Eye style={{ width: '1rem', height: '1rem' }} /> View</button>
            <button onClick={() => { setKnowledgeCreated(false); }} className="btn-outline-sm"><Edit2 style={{ width: '1rem', height: '1rem' }} /> Edit</button>
            <button onClick={() => setCurrentStep(1)} className="btn-outline-sm"><RotateCcw style={{ width: '1rem', height: '1rem' }} /> Re-run Analysis</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-wrap">
      <div className="card">
        <div className="upload-header">
          <div>
            <h2 className="card-title">Upload Documents</h2>
            <p className="card-desc">Add files to start the knowledge ingestion process.</p>
          </div>
          <div className="mode-switch" onClick={() => setUploadMode(uploadMode === 'single' ? 'multiple' : 'single')}>
            {uploadMode === 'multiple' ? <ToggleRight style={{ color: 'var(--color-primary)' }} /> : <ToggleLeft />}
            <span className="mode-label">{uploadMode === 'single' ? 'Single Document' : 'Multiple Documents'}</span>
          </div>
        </div>

        <div className={`dropzone ${dragActive ? 'active' : ''}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}>
          <input type="file" multiple={uploadMode === 'multiple'} accept=".pdf,.doc,.docx,.txt,.ppt,.pptx" onChange={handleFileInput} />
          <div className="dropzone-inner">
            <div className="dropzone-icon"><UploadIcon /></div>
            <div>
              <p className="dropzone-text">Click to upload or drag and drop</p>
              <p className="dropzone-sub">PDF, DOC/DOCX, TXT, PPT — {uploadMode === 'single' ? '1 document' : 'multiple documents'}</p>
            </div>
          </div>
        </div>

        <div className="url-row">
          <Link style={{ width: '1rem', height: '1rem', color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <input type="text" className="url-input" placeholder="Add a web URL..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()} />
          <button onClick={handleAddUrl} disabled={!urlInput.trim()} className="btn-sm btn-sm-primary">Add URL</button>
        </div>

        {parseErrors.length > 0 && (
          <div className="error-list">
            {parseErrors.map((err, i) => <div key={i} className="error-item">{err}</div>)}
          </div>
        )}
      </div>

      <AnimatePresence>
        {parsedDocuments.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="card">
            <h3 className="card-title" style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>
              Uploaded Documents ({parsedDocuments.length})
            </h3>
            <div className="doc-list">
              {parsedDocuments.map((doc) => (
                <motion.div key={doc.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="doc-item">
                  <div className="doc-info">
                    <div className="doc-icon">{doc.name.startsWith('http') ? <Link /> : <FileText />}</div>
                    <div>
                      <p className="doc-name">{doc.name}</p>
                      <p className="doc-meta">
                        {doc.uploadDate} &bull; {formatSize(doc.size)} &bull;
                        {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} &bull;
                        {doc.text.length.toLocaleString()} chars extracted
                      </p>
                    </div>
                  </div>
                  <div className="doc-right">
                    <span className="badge badge-approved"><CheckCircle style={{ width: '.75rem', height: '.75rem' }} /> Parsed</span>
                    <button onClick={() => removeParsedDocument(doc.id)} className="btn-ghost"><X /></button>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="card-footer">
              <button onClick={handleIngest} disabled={isProcessing} className="btn-primary">
                {isProcessing ? (
                  <><Loader2 className="spin" /> Processing...</>
                ) : (
                  <>Ingest Documents <CheckCircle /></>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isProcessing && (
        <div className="processing-overlay">
          <div className="processing-card">
            <Loader2 className="spin processing-spinner" />
            <p className="processing-text">{useStore.getState().processingProgress}</p>
          </div>
        </div>
      )}
    </div>
  );
};
