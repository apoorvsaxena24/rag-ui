import { render, screen, fireEvent } from '@testing-library/react';
import { UnreadableContentStep } from '../components/UnreadableContentStep';
import { useStore } from '../store/useStore';
import { vi } from 'vitest';

vi.mock('../store/useStore');

const baseMock = {
  parsedDocuments: [{ id: 'd1', name: 'Test.pdf', text: '', pages: [], pageCount: 1, size: 100, uploadDate: '2026-03-12' }],
  skipStep: vi.fn(),
};

describe('Integration Test: Step progression with Skip', () => {
  it('enables Next only when all items resolved; Skip always works', () => {
    const setCurrentStepMock = vi.fn();

    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseMock,
      unreadableItems: [
        { id: 'u1', documentId: 'd1', documentName: 'Test.pdf', section: 'Page 1', issue: 'Blurry', context: '', status: 'pending' },
      ],
      resolveUnreadable: vi.fn(),
      ignoreUnreadable: vi.fn(),
      setCurrentStep: setCurrentStepMock,
    });

    const { rerender } = render(<UnreadableContentStep />);

    const nextButton = screen.getByText(/Next: Terminology Check/i);
    expect(nextButton).toBeDisabled();

    const skipButton = screen.getByText(/Skip for Now/i);
    expect(skipButton).not.toBeDisabled();
    fireEvent.click(skipButton);

    (useStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...baseMock,
      unreadableItems: [
        { id: 'u1', documentId: 'd1', documentName: 'Test.pdf', section: 'Page 1', issue: 'Blurry', context: '', status: 'resolved', resolution: 'Fixed' },
      ],
      resolveUnreadable: vi.fn(),
      ignoreUnreadable: vi.fn(),
      setCurrentStep: setCurrentStepMock,
    });

    rerender(<UnreadableContentStep />);
    expect(screen.getByText(/Next: Terminology Check/i)).not.toBeDisabled();
  });
});
