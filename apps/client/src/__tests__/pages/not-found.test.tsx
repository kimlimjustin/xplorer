import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotFound from '@/pages/not-found';

describe('NotFound Page', () => {
  it('renders the 404 heading', () => {
    render(<NotFound />);
    expect(screen.getByText('404 Page Not Found')).toBeInTheDocument();
  });

  it('displays the descriptive message about missing router entry', () => {
    render(<NotFound />);
    expect(
      screen.getByText('Did you forget to add the page to the router?'),
    ).toBeInTheDocument();
  });

  it('renders the error indicator symbol', () => {
    render(<NotFound />);
    const errorIndicator = screen.getByRole('img', { name: 'error' });
    expect(errorIndicator).toBeInTheDocument();
    expect(errorIndicator).toHaveTextContent('!');
  });

  it('uses the correct layout classes on the outer wrapper', () => {
    const { container } = render(<NotFound />);
    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain('min-h-screen');
    expect(outerDiv.className).toContain('flex');
    expect(outerDiv.className).toContain('items-center');
    expect(outerDiv.className).toContain('justify-center');
  });

  it('wraps content in a card-like container with border and padding', () => {
    const { container } = render(<NotFound />);
    const card = container.querySelector('.max-w-md');
    expect(card).toBeInTheDocument();
    expect(card?.className).toContain('border');
    expect(card?.className).toContain('rounded-lg');
    expect(card?.className).toContain('p-6');
  });
});
