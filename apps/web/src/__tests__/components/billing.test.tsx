import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PricingCards } from '@/components/billing/PricingCards';

// ---------------------------------------------------------------------------
// PricingCards
// ---------------------------------------------------------------------------
describe('PricingCards', () => {
  it('renders the Free tier', () => {
    render(<PricingCards />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('renders the Pro (Sponsor) tier', () => {
    render(<PricingCards />);
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders the Free tier price as $0', () => {
    render(<PricingCards />);
    expect(screen.getByText('$0')).toBeInTheDocument();
  });

  it('renders the Pro tier price as "Sponsor"', () => {
    render(<PricingCards />);
    expect(screen.getByText('Sponsor')).toBeInTheDocument();
  });

  it('renders Free tier period as "forever"', () => {
    render(<PricingCards />);
    expect(screen.getByText('forever')).toBeInTheDocument();
  });

  it('renders Pro tier period as "via GitHub"', () => {
    render(<PricingCards />);
    expect(screen.getByText('via GitHub')).toBeInTheDocument();
  });

  it('renders Free tier description', () => {
    render(<PricingCards />);
    expect(
      screen.getByText('Everything you need to get started with Xplorer.'),
    ).toBeInTheDocument();
  });

  it('renders Pro tier description', () => {
    render(<PricingCards />);
    expect(screen.getByText(/Sponsor us on GitHub to unlock Pro/)).toBeInTheDocument();
  });

  it('renders Free tier CTA button "Get Started"', () => {
    render(<PricingCards />);
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });

  it('renders Pro tier CTA button "Become a Sponsor"', () => {
    render(<PricingCards />);
    expect(screen.getByText('Become a Sponsor')).toBeInTheDocument();
  });

  it('renders the "Get Started" link pointing to installation docs', () => {
    render(<PricingCards />);
    const getStartedLink = screen.getByText('Get Started').closest('a');
    expect(getStartedLink).toHaveAttribute('href', '/docs/getting-started/installation');
  });

  it('renders the "Become a Sponsor" link pointing to GitHub sponsors', () => {
    render(<PricingCards />);
    const sponsorLink = screen.getByText('Become a Sponsor').closest('a');
    expect(sponsorLink).toHaveAttribute('href', 'https://github.com/sponsors/kimlimjustin');
  });

  it('renders the sponsor link as external (target _blank)', () => {
    render(<PricingCards />);
    const sponsorLink = screen.getByText('Become a Sponsor').closest('a');
    expect(sponsorLink).toHaveAttribute('target', '_blank');
    expect(sponsorLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  // Feature list tests for Free tier
  it('renders Free tier feature: Full desktop app', () => {
    render(<PricingCards />);
    expect(screen.getByText('Full desktop app')).toBeInTheDocument();
  });

  it('renders Free tier feature: All built-in features', () => {
    render(<PricingCards />);
    expect(screen.getByText('All built-in features')).toBeInTheDocument();
  });

  it('renders Free tier feature: SSH remote access', () => {
    render(<PricingCards />);
    expect(screen.getByText('SSH remote access')).toBeInTheDocument();
  });

  it('renders Free tier feature: AI search (local Ollama)', () => {
    render(<PricingCards />);
    expect(screen.getByText('AI search (local Ollama)')).toBeInTheDocument();
  });

  it('renders Free tier feature: Install up to 20 extensions', () => {
    render(<PricingCards />);
    expect(screen.getByText('Install up to 20 extensions')).toBeInTheDocument();
  });

  it('renders Free tier feature: 30-min paid extension trials', () => {
    render(<PricingCards />);
    expect(screen.getByText('30-min paid extension trials')).toBeInTheDocument();
  });

  it('renders Free tier feature: Publish extensions (30% platform fee)', () => {
    render(<PricingCards />);
    expect(screen.getByText('Publish extensions (30% platform fee)')).toBeInTheDocument();
  });

  // Feature list tests for Pro tier
  it('renders Pro tier feature: Everything in Free', () => {
    render(<PricingCards />);
    expect(screen.getByText('Everything in Free')).toBeInTheDocument();
  });

  it('renders Pro tier feature: Unlimited extension installs', () => {
    render(<PricingCards />);
    expect(screen.getByText('Unlimited extension installs')).toBeInTheDocument();
  });

  it('renders Pro tier feature: Full access to paid extensions', () => {
    render(<PricingCards />);
    expect(screen.getByText('Full access to paid extensions')).toBeInTheDocument();
  });

  it('renders Pro tier feature: Reduced platform fee (10%)', () => {
    render(<PricingCards />);
    expect(screen.getByText('Reduced platform fee (10%)')).toBeInTheDocument();
  });

  it('renders Pro tier feature: Priority support', () => {
    render(<PricingCards />);
    expect(screen.getByText('Priority support')).toBeInTheDocument();
  });

  it('renders Pro tier feature: Early access to new features', () => {
    render(<PricingCards />);
    expect(screen.getByText('Early access to new features')).toBeInTheDocument();
  });

  it('renders Pro tier feature: Badge on marketplace profile', () => {
    render(<PricingCards />);
    expect(screen.getByText('Badge on marketplace profile')).toBeInTheDocument();
  });

  it('renders Pro tier feature: Perpetual license', () => {
    render(<PricingCards />);
    expect(screen.getByText('Perpetual license')).toBeInTheDocument();
  });

  // Excluded features (marked as not included in Free)
  it('renders "Unlimited extensions" as not included in Free', () => {
    render(<PricingCards />);
    expect(screen.getByText('Unlimited extensions')).toBeInTheDocument();
  });

  it('renders "Reduced platform fee" as not included in Free', () => {
    render(<PricingCards />);
    expect(screen.getByText('Reduced platform fee')).toBeInTheDocument();
  });

  // Styling tests
  it('highlights the Pro tier with a special border', () => {
    render(<PricingCards />);
    // Pro has highlight: true which adds ring-1 and shadow-lg
    const proCard = screen.getByText('Pro').closest('div[class*="rounded-2xl"]');
    expect(proCard?.className).toContain('shadow-lg');
    expect(proCard?.className).toContain('ring-1');
  });

  it('renders two pricing cards', () => {
    const { container } = render(<PricingCards />);
    const cards = container.querySelectorAll('[class*="rounded-2xl"][class*="border"]');
    expect(cards.length).toBe(2);
  });
});
