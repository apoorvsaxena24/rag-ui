import { create } from 'zustand';
import type { ParsedDocument } from '../services/documentParser';
import type { UnreadableItem, ConflictItem, FAQItem, TermMatch, UndefinedTerm, GuidelineViolation } from '../services/textAnalyzer';
import { detectUnreadable, detectConflicts, generateFAQs, detectUndefinedTerms, validateContentGuidelines } from '../services/textAnalyzer';

export interface KnowledgeVersion {
  id: string;
  version: string;
  date: string;
  summary: string;
  faqCount: number;
}

export type SkippedStep = 'unreadable' | 'terminology' | 'conflicts' | 'faqs';

interface StoreState {
  // Mode
  uploadMode: 'single' | 'multiple';
  setUploadMode: (m: 'single' | 'multiple') => void;

  // Documents
  parsedDocuments: ParsedDocument[];
  addParsedDocument: (doc: ParsedDocument) => void;
  removeParsedDocument: (id: string) => void;
  clearDocuments: () => void;

  // Processing state
  isProcessing: boolean;
  processingProgress: string;
  setProcessing: (v: boolean, msg?: string) => void;

  // Navigation
  currentStep: number;
  setCurrentStep: (step: number) => void;
  currentDocIndex: number;
  processedDocCount: number;
  setCurrentDocIndex: (i: number) => void;
  setProcessedDocCount: (n: number) => void;

  // Skip tracking
  skippedSteps: Set<SkippedStep>;
  skipStep: (step: SkippedStep) => void;
  unskipStep: (step: SkippedStep) => void;

  // Step 1: Unreadable
  unreadableItems: UnreadableItem[];
  resolveUnreadable: (id: string, resolution: string) => void;
  ignoreUnreadable: (id: string) => void;

  // Step 2: Terminology search + undefined terms
  termSearchQuery: string;
  termMatches: TermMatch[];
  termMatchIndex: number;
  setTermSearch: (query: string, matches: TermMatch[]) => void;
  setTermMatchIndex: (i: number) => void;
  undefinedTerms: UndefinedTerm[];
  defineTerm: (id: string, definition: string) => void;
  ignoreTerm: (id: string) => void;

  // Step 3: Conflicts
  conflicts: ConflictItem[];
  resolveConflict: (id: string, resolution: 'keepA' | 'keepB' | 'custom', customValue?: string) => void;

  // Step 4: FAQs
  faqs: FAQItem[];
  acceptFAQ: (id: string) => void;
  editFAQ: (id: string, question: string, answer: string) => void;
  deleteFAQ: (id: string) => void;
  addFAQ: (question: string, answer: string) => void;

  // Content guideline violations
  guidelineViolations: GuidelineViolation[];
  refreshGuidelines: () => void;

  // Final
  knowledgeCreated: boolean;
  setKnowledgeCreated: (v: boolean) => void;
  versions: KnowledgeVersion[];
  activeVersion: string;
  ragTrained: boolean;
  setRagTrained: (v: boolean) => void;
  publishVersion: () => void;
  finalFAQIndex: number;
  setFinalFAQIndex: (i: number) => void;

  // Ingestion: runs analysis on all parsed docs
  runIngestion: () => void;

  // Reset
  resetAll: () => void;
}

export const useStore = create<StoreState>((set, get) => ({
  uploadMode: 'multiple',
  setUploadMode: (m) => set({ uploadMode: m }),

  parsedDocuments: [],
  addParsedDocument: (doc) => set(s => {
    if (s.uploadMode === 'single') return { parsedDocuments: [doc] };
    return { parsedDocuments: [...s.parsedDocuments, doc] };
  }),
  removeParsedDocument: (id) => set(s => ({
    parsedDocuments: s.parsedDocuments.filter(d => d.id !== id),
  })),
  clearDocuments: () => set({ parsedDocuments: [] }),

  isProcessing: false,
  processingProgress: '',
  setProcessing: (v, msg) => set({ isProcessing: v, processingProgress: msg ?? '' }),

  currentStep: 0,
  setCurrentStep: (step) => set({ currentStep: step }),
  currentDocIndex: 0,
  processedDocCount: 0,
  setCurrentDocIndex: (i) => set({ currentDocIndex: i }),
  setProcessedDocCount: (n) => set({ processedDocCount: n }),

  skippedSteps: new Set(),
  skipStep: (step) => set(s => {
    const next = new Set(s.skippedSteps);
    next.add(step);
    return { skippedSteps: next };
  }),
  unskipStep: (step) => set(s => {
    const next = new Set(s.skippedSteps);
    next.delete(step);
    return { skippedSteps: next };
  }),

  unreadableItems: [],
  resolveUnreadable: (id, resolution) => set(s => ({
    unreadableItems: s.unreadableItems.map(u =>
      u.id === id ? { ...u, status: 'resolved' as const, resolution } : u,
    ),
  })),
  ignoreUnreadable: (id) => set(s => ({
    unreadableItems: s.unreadableItems.map(u =>
      u.id === id ? { ...u, status: 'ignored' as const } : u,
    ),
  })),

  termSearchQuery: '',
  termMatches: [],
  termMatchIndex: 0,
  setTermSearch: (query, matches) => set({ termSearchQuery: query, termMatches: matches, termMatchIndex: 0 }),
  setTermMatchIndex: (i) => set({ termMatchIndex: i }),
  undefinedTerms: [],
  defineTerm: (id, definition) => set(s => ({
    undefinedTerms: s.undefinedTerms.map(t =>
      t.id === id ? { ...t, definition, status: 'defined' as const } : t,
    ),
  })),
  ignoreTerm: (id) => set(s => ({
    undefinedTerms: s.undefinedTerms.map(t =>
      t.id === id ? { ...t, status: 'ignored' as const } : t,
    ),
  })),

  conflicts: [],
  resolveConflict: (id, resolution, customValue) => set(s => ({
    conflicts: s.conflicts.map(c =>
      c.id === id ? { ...c, resolution, customResolution: customValue } : c,
    ),
  })),

  faqs: [],
  acceptFAQ: (id) => set(s => ({
    faqs: s.faqs.map(f => f.id === id ? { ...f, status: 'accepted' as const } : f),
  })),
  editFAQ: (id, question, answer) => set(s => ({
    faqs: s.faqs.map(f => f.id === id ? { ...f, question, answer, status: 'edited' as const } : f),
  })),
  deleteFAQ: (id) => set(s => ({
    faqs: s.faqs.map(f => f.id === id ? { ...f, status: 'deleted' as const } : f),
  })),
  addFAQ: (question, answer) => set(s => ({
    faqs: [...s.faqs, {
      id: `faq-custom-${Date.now()}`,
      question,
      answer,
      sourceDoc: 'User Added',
      category: 'generated' as const,
      status: 'pending' as const,
    }],
  })),

  guidelineViolations: [],
  refreshGuidelines: () => {
    const state = get();
    const violations = validateContentGuidelines(state.faqs, state.parsedDocuments);
    set({ guidelineViolations: violations });
  },

  knowledgeCreated: false,
  setKnowledgeCreated: (v) => set({ knowledgeCreated: v }),
  versions: [],
  activeVersion: '',
  ragTrained: false,
  setRagTrained: (v) => set({ ragTrained: v }),
  publishVersion: () => {
    const state = get();
    const verNum = state.versions.length + 1;
    const newVer = `v${verNum}.0`;
    const acceptedCount = state.faqs.filter(f => f.status === 'accepted' || f.status === 'edited').length;
    set({
      versions: [...state.versions, {
        id: `v${verNum}`,
        version: newVer,
        date: new Date().toISOString().split('T')[0],
        summary: `Knowledge base with ${state.parsedDocuments.length} documents`,
        faqCount: acceptedCount,
      }],
      activeVersion: newVer,
      ragTrained: true,
      knowledgeCreated: true,
    });
  },
  finalFAQIndex: 0,
  setFinalFAQIndex: (i) => set({ finalFAQIndex: i }),

  runIngestion: () => {
    const docs = get().parsedDocuments;
    const unreadableItems = detectUnreadable(docs);
    const conflicts = detectConflicts(docs);
    const faqs = generateFAQs(docs);
    const undefinedTerms = detectUndefinedTerms(docs);
    const guidelineViolations = validateContentGuidelines(faqs, docs);

    set({
      unreadableItems,
      conflicts,
      faqs,
      undefinedTerms,
      guidelineViolations,
      currentStep: 1,
      isProcessing: false,
      processingProgress: '',
      skippedSteps: new Set(),
    });
  },

  resetAll: () => set({
    parsedDocuments: [],
    currentStep: 0,
    currentDocIndex: 0,
    processedDocCount: 0,
    unreadableItems: [],
    termSearchQuery: '',
    termMatches: [],
    termMatchIndex: 0,
    undefinedTerms: [],
    conflicts: [],
    faqs: [],
    guidelineViolations: [],
    skippedSteps: new Set(),
    knowledgeCreated: false,
    ragTrained: false,
    finalFAQIndex: 0,
    isProcessing: false,
    processingProgress: '',
  }),
}));
