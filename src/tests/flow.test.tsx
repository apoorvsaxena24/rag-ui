import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { useStore } from '../store/useStore';
import { vi } from 'vitest';

vi.mock('../store/useStore');
vi.mock('../services/documentParser', () => ({ parseFile: vi.fn() }));
vi.mock('../services/textAnalyzer', () => ({
  detectUnreadable: vi.fn(() => []),
  detectConflicts: vi.fn(() => []),
  generateFAQs: vi.fn(() => []),
  detectUndefinedTerms: vi.fn(() => []),
  validateContentGuidelines: vi.fn(() => []),
  searchTermAcrossDocs: vi.fn(() => []),
  exportFAQsToDocx: vi.fn(),
}));

const baseMock = {
  parsedDocuments: [{ id: 'd1', name: 'Test.pdf', text: '', pages: [], pageCount: 1, size: 100, uploadDate: '2026-03-12' }],
  currentDocIndex: 0,
  processedDocCount: 0,
  setCurrentStep: vi.fn(),
  setCurrentDocIndex: vi.fn(),
  setProcessedDocCount: vi.fn(),
  knowledgeCreated: false,
  setKnowledgeCreated: vi.fn(),
  versions: [],
  activeVersion: 'Draft',
  ragTrained: false,
  publishVersion: vi.fn(),
  setRagTrained: vi.fn(),
  finalFAQIndex: 0,
  setFinalFAQIndex: vi.fn(),
  skippedSteps: new Set(),
  skipStep: vi.fn(),
  unskipStep: vi.fn(),
  resetAll: vi.fn(),
  uploadMode: 'multiple',
  setUploadMode: vi.fn(),
  isProcessing: false,
  setProcessing: vi.fn(),
  runIngestion: vi.fn(),
  addParsedDocument: vi.fn(),
  removeParsedDocument: vi.fn(),
  clearDocuments: vi.fn(),
  termSearchQuery: '',
  termMatches: [],
  termMatchIndex: 0,
  setTermSearch: vi.fn(),
  setTermMatchIndex: vi.fn(),
  undefinedTerms: [],
  defineTerm: vi.fn(),
  ignoreTerm: vi.fn(),
  guidelineViolations: [],
  refreshGuidelines: vi.fn(),
};

describe('Full Flow Test: Document Processing', () => {
  it('completes the workflow from Unreadable to FAQs to Final Review', () => {
    const resolveUnreadableMock = vi.fn();
    const resolveConflictMock = vi.fn();
    const acceptFAQMock = vi.fn();

    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseMock,
      currentStep: 1,
      unreadableItems: [{ id: 'u1', documentId: 'd1', documentName: 'Test.pdf', section: 'Page 1', issue: 'Blurry', context: '', status: 'pending' }],
      conflicts: [],
      faqs: [],
      resolveUnreadable: resolveUnreadableMock,
      ignoreUnreadable: vi.fn(),
    });

    const { rerender } = render(<App />);
    expect(screen.getByText('Unreadable Content Check')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Provide explanation or text content...'), { target: { value: 'Fixed' } });
    fireEvent.click(screen.getByText('Resolve'));
    expect(resolveUnreadableMock).toHaveBeenCalledWith('u1', 'Fixed');

    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseMock,
      currentStep: 3,
      unreadableItems: [],
      conflicts: [{ id: 'c1', topic: 'Topic 1', type: 'internal', valueA: 'A', valueB: 'B', sourceA: 'Test.pdf', sourceB: 'Test.pdf', contextA: 'A', contextB: 'B', resolution: null }],
      faqs: [],
      resolveConflict: resolveConflictMock,
    });
    rerender(<App />);

    expect(screen.getByText('Conflict Detection')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Keep This')[0]);
    expect(resolveConflictMock).toHaveBeenCalledWith('c1', 'keepA', undefined);

    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseMock,
      currentStep: 4,
      unreadableItems: [],
      conflicts: [],
      faqs: [{ id: 'faq-1', question: 'What is UNO?', answer: 'A digital bank.', sourceDoc: 'Test.pdf', category: 'extracted', status: 'pending' }],
      acceptFAQ: acceptFAQMock,
      editFAQ: vi.fn(),
      deleteFAQ: vi.fn(),
      addFAQ: vi.fn(),
    });
    rerender(<App />);

    expect(screen.getByRole('heading', { name: 'FAQs' })).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Accept'));
    expect(acceptFAQMock).toHaveBeenCalledWith('faq-1');

    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseMock,
      currentStep: 5,
      unreadableItems: [],
      conflicts: [],
      faqs: [{ id: 'faq-1', question: 'What is UNO?', answer: 'A digital bank.', sourceDoc: 'Test.pdf', category: 'extracted', status: 'accepted' }],
      acceptFAQ: vi.fn(),
      editFAQ: vi.fn(),
    });
    rerender(<App />);

    expect(screen.getByText('Final Knowledge Consultation')).toBeInTheDocument();
    expect(screen.getByText('FAQs Approved')).toBeInTheDocument();
  });
});
