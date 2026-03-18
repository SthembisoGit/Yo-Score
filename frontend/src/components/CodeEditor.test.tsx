import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeEditor } from './CodeEditor';

vi.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({
    value = '',
    language,
  }: {
    value?: string;
    language?: string;
  }) => (
    <div data-testid="monaco-editor" data-language={language}>
      {String(value).slice(0, 24)}
    </div>
  ),
}));

describe('CodeEditor', () => {
  it('keeps the execution panel visible while editor size changes', () => {
    render(<CodeEditor language="python" value="print('hello')" />);

    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type input used by your program...')).toBeInTheDocument();
    expect(screen.getByText('Run your code to see real output.')).toBeInTheDocument();

    const slider = screen.getByLabelText('Editor size');
    fireEvent.change(slider, { target: { value: '78' } });

    expect(screen.getByText('78%')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type input used by your program...')).toBeInTheDocument();
  });
});
