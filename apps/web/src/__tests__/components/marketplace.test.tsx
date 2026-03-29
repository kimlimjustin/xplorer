import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtensionCard } from '@/components/marketplace/ExtensionCard';
import { CategoryFilter } from '@/components/marketplace/CategoryFilter';
import type { ExtensionCardData } from '@/components/marketplace/ExtensionCard';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function createExtension(overrides: Partial<ExtensionCardData> = {}): ExtensionCardData {
  return {
    id: 'ext-1',
    slug: 'my-extension',
    displayName: 'My Extension',
    description: 'A great extension for testing purposes',
    icon: null,
    downloadCount: 1234,
    averageRating: 4.5,
    reviewCount: 42,
    pricingType: 'FREE',
    price: null,
    author: { name: 'Test Author', username: 'testauthor' },
    categories: [{ category: { name: 'Themes', slug: 'themes' } }],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ExtensionCard
// ---------------------------------------------------------------------------
describe('ExtensionCard', () => {
  it('renders the extension display name', () => {
    render(<ExtensionCard extension={createExtension()} />);
    expect(screen.getByText('My Extension')).toBeInTheDocument();
  });

  it('renders the extension description', () => {
    render(<ExtensionCard extension={createExtension()} />);
    expect(screen.getByText('A great extension for testing purposes')).toBeInTheDocument();
  });

  it('renders the download count formatted', () => {
    render(<ExtensionCard extension={createExtension({ downloadCount: 1234 })} />);
    expect(screen.getByText('1.2K')).toBeInTheDocument();
  });

  it('renders the download count as raw number when under 1000', () => {
    render(<ExtensionCard extension={createExtension({ downloadCount: 500 })} />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('renders the author name', () => {
    render(<ExtensionCard extension={createExtension()} />);
    expect(screen.getByText('by Test Author')).toBeInTheDocument();
  });

  it('renders the author username when name is null', () => {
    render(
      <ExtensionCard
        extension={createExtension({
          author: { name: null, username: 'devuser' },
        })}
      />,
    );
    expect(screen.getByText('by devuser')).toBeInTheDocument();
  });

  it('renders the average rating when greater than 0', () => {
    render(<ExtensionCard extension={createExtension({ averageRating: 4.5, reviewCount: 42 })} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('(42)')).toBeInTheDocument();
  });

  it('does not render rating when averageRating is 0', () => {
    render(<ExtensionCard extension={createExtension({ averageRating: 0 })} />);
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });

  it('renders as a link to the extension page', () => {
    render(<ExtensionCard extension={createExtension({ slug: 'cool-ext' })} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/extensions/cool-ext');
  });

  it('renders category names', () => {
    render(
      <ExtensionCard
        extension={createExtension({
          categories: [
            { category: { name: 'Themes', slug: 'themes' } },
            { category: { name: 'Utilities', slug: 'utilities' } },
          ],
        })}
      />,
    );
    expect(screen.getByText('Themes, Utilities')).toBeInTheDocument();
  });

  it('renders first letter as icon fallback when no icon is provided', () => {
    render(<ExtensionCard extension={createExtension({ icon: null, displayName: 'Zapper' })} />);
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('renders an image when icon URL is provided', () => {
    const { container } = render(
      <ExtensionCard extension={createExtension({ icon: 'https://example.com/icon.png' })} />,
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/icon.png');
  });

  it('renders safe icon URL - rejects javascript: URLs', () => {
    const { container } = render(
      <ExtensionCard extension={createExtension({ icon: 'javascript:alert(1)' })} />,
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/placeholder-icon.png');
  });

  it('renders safe icon URL - rejects data: URLs', () => {
    const { container } = render(
      <ExtensionCard
        extension={createExtension({ icon: 'data:text/html,<script>alert(1)</script>' })}
      />,
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/placeholder-icon.png');
  });

  it('does not render categories section when categories is empty', () => {
    render(<ExtensionCard extension={createExtension({ categories: [] })} />);
    // No category text should be present
    expect(screen.queryByText('Themes')).not.toBeInTheDocument();
  });

  it('renders FREE pricing badge for free extensions', () => {
    render(<ExtensionCard extension={createExtension({ pricingType: 'FREE' })} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('renders price for paid extensions', () => {
    render(<ExtensionCard extension={createExtension({ pricingType: 'PAID', price: 999 })} />);
    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });

  it('renders "Paid" label when price is null for paid extensions', () => {
    render(<ExtensionCard extension={createExtension({ pricingType: 'PAID', price: null })} />);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CategoryFilter
// ---------------------------------------------------------------------------
describe('CategoryFilter', () => {
  const categories = [
    { id: '1', name: 'Themes', slug: 'themes' },
    { id: '2', name: 'Previews', slug: 'previews' },
    { id: '3', name: 'Productivity', slug: 'productivity' },
  ];

  it('renders the "All" button', () => {
    render(<CategoryFilter categories={categories} selected={null} onChange={vi.fn()} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders all category names', () => {
    render(<CategoryFilter categories={categories} selected={null} onChange={vi.fn()} />);
    expect(screen.getByText('Themes')).toBeInTheDocument();
    expect(screen.getByText('Previews')).toBeInTheDocument();
    expect(screen.getByText('Productivity')).toBeInTheDocument();
  });

  it('highlights the "All" button when no category is selected', () => {
    render(<CategoryFilter categories={categories} selected={null} onChange={vi.fn()} />);
    const allBtn = screen.getByText('All');
    expect(allBtn.className).toContain('bg-brand-600');
    expect(allBtn.className).toContain('text-white');
  });

  it('highlights the active category button', () => {
    render(<CategoryFilter categories={categories} selected="themes" onChange={vi.fn()} />);
    const themesBtn = screen.getByText('Themes');
    expect(themesBtn.className).toContain('bg-brand-600');
    expect(themesBtn.className).toContain('text-white');
  });

  it('does not highlight the "All" button when a category is selected', () => {
    render(<CategoryFilter categories={categories} selected="themes" onChange={vi.fn()} />);
    const allBtn = screen.getByText('All');
    expect(allBtn.className).not.toContain('bg-brand-600');
  });

  it('does not highlight inactive categories', () => {
    render(<CategoryFilter categories={categories} selected="themes" onChange={vi.fn()} />);
    const previewsBtn = screen.getByText('Previews');
    expect(previewsBtn.className).not.toContain('bg-brand-600');
    expect(previewsBtn.className).toContain('bg-gray-100');
  });

  it('calls onChange with null when "All" is clicked', () => {
    const onChange = vi.fn();
    render(<CategoryFilter categories={categories} selected="themes" onChange={onChange} />);
    fireEvent.click(screen.getByText('All'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onChange with category slug when a category is clicked', () => {
    const onChange = vi.fn();
    render(<CategoryFilter categories={categories} selected={null} onChange={onChange} />);
    fireEvent.click(screen.getByText('Previews'));
    expect(onChange).toHaveBeenCalledWith('previews');
  });

  it('calls onChange with null when the active category is clicked again (toggle off)', () => {
    const onChange = vi.fn();
    render(<CategoryFilter categories={categories} selected="themes" onChange={onChange} />);
    fireEvent.click(screen.getByText('Themes'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('renders correct number of buttons (All + categories)', () => {
    render(<CategoryFilter categories={categories} selected={null} onChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(4); // All + 3 categories
  });

  it('renders with empty categories array', () => {
    render(<CategoryFilter categories={[]} selected={null} onChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1); // Only "All"
  });
});
