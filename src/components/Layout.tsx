import React from 'react';
import { useStore } from '../store/useStore';
import { FileText, AlertTriangle, CheckCircle, HelpCircle, Layers, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import exotelLogo from '../assets/exotel-logo.png';
import '../styles/Layout.css';

const steps = [
  { id: 0, name: 'Upload', icon: FileText },
  { id: 1, name: 'Unreadable', icon: AlertTriangle },
  { id: 2, name: 'Terminology', icon: Search },
  { id: 3, name: 'Conflicts', icon: Layers },
  { id: 4, name: 'FAQs', icon: HelpCircle },
  { id: 5, name: 'Review', icon: CheckCircle },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentStep, setCurrentStep, parsedDocuments, skippedSteps } = useStore();
  const totalDocs = parsedDocuments.length;
  const showProgress = currentStep >= 1 && currentStep <= 4 && totalDocs > 0;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo-wrap">
            <img src={exotelLogo} alt="Exotel" className="brand-logo" />
          </div>
          <span className="brand-rag">RAG</span>
        </div>

        {showProgress && (
          <div className="doc-progress">
            <div className="doc-progress-text">{totalDocs} document{totalDocs !== 1 ? 's' : ''} loaded</div>
            <div className="doc-progress-bar">
              <div className="doc-progress-fill" style={{ width: `${(Math.max(currentStep, 1) / 5) * 100}%` }} />
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            const stepKey = ['', 'unreadable', 'terminology', 'conflicts', 'faqs', ''][step.id];
            const isSkipped = stepKey && skippedSteps.has(stepKey as any);
            return (
              <button key={step.id} onClick={() => setCurrentStep(step.id)} className={`nav-btn ${isActive ? 'active' : ''} ${isSkipped ? 'skipped' : ''}`}>
                <div className="nav-icon-box"><Icon /></div>
                <span>{step.name}</span>
                {isCompleted && !isSkipped && <CheckCircle className="nav-check" />}
                {isSkipped && <span className="nav-skip-badge">Skipped</span>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">AS</div>
          <div>
            <p className="user-name">Apoorv Saxena</p>
            <p className="user-role">Product Manager</p>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <motion.div key={currentStep} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {children}
        </motion.div>
      </main>
    </div>
  );
};
