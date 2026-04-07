import { render, screen, fireEvent } from '@testing-library/react';
import { UnreadableContentStep } from '../components/UnreadableContentStep';
import { useStore } from '../store/useStore';
import { vi } from 'vitest';

vi.mock('../store/useStore');

const baseMock = {
  parsedDocuments: [{ id: 'd1', name: 'Test.pdf', text: '', pages: [], pageCount: 1, size: 100, uploadDate: '2026-03-12' }],
  setCurrentStep: vi.fn(),
  skipStep: vi.fn(),
};

describe('Unit Test: UnreadableContentStep', () => {
  it('renders unreadable content items', () => {
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseMock,
      unreadableItems: [
        { id: 'u1', documentId: 'd1', documentName: 'Test.pdf', section: 'Page 1', issue: 'Blurry image', context: '', status: 'pending' },
      ],
      resolveUnreadable: vi.fn(),
      ignoreUnreadable: vi.fn(),
    });
    render(<UnreadableContentStep />);
    expect(screen.getByText('Blurry image')).toBeInTheDocument();
  });

  it('allows resolving an item', () => {
    const resolveMock = vi.fn();
    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseMock,
      unreadableItems: [
        { id: 'u1', documentId: 'd1', documentName: 'Test.pdf', section: 'Page 1', issue: 'Blurry image', context: '', status: 'pending' },
      ],
      resolveUnreadable: resolveMock,
      ignoreUnreadable: vi.fn(),
    });
    render(<UnreadableContentStep />);
    const textarea = screen.getByPlaceholderText('Provide explanation or text content...');
    fireEvent.change(textarea, { target: { value: 'Clarified text' } });
    fireEvent.click(screen.getByText('Resolve'));
    expect(resolveMock).toHaveBeenCalledWith('u1', 'Clarified text');
  });
});
