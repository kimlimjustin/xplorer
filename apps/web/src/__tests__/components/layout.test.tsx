import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------
describe('Navbar', () => {
  it('renders the brand name "Xplorer"', () => {
    render(<Navbar />);
    expect(screen.getByText('Xplorer')).toBeInTheDocument();
  });

  it('renders a link to the home page', () => {
    render(<Navbar />);
    const brandLink = screen.getByText('Xplorer').closest('a');
    expect(brandLink).toHaveAttribute('href', '/');
  });

  it('renders the Docs navigation link', () => {
    render(<Navbar />);
    expect(screen.getByText('Docs')).toBeInTheDocument();
    const docsLink = screen.getByText('Docs').closest('a');
    expect(docsLink).toHaveAttribute('href', '/docs');
  });

  it('renders the Extensions navigation link', () => {
    render(<Navbar />);
    expect(screen.getByText('Extensions')).toBeInTheDocument();
    const extensionsLink = screen.getByText('Extensions').closest('a');
    expect(extensionsLink).toHaveAttribute('href', '/extensions');
  });

  it('renders the Pricing navigation link', () => {
    render(<Navbar />);
    expect(screen.getByText('Pricing')).toBeInTheDocument();
    const pricingLink = screen.getByText('Pricing').closest('a');
    expect(pricingLink).toHaveAttribute('href', '/pricing');
  });

  it('renders the theme toggle button', () => {
    render(<Navbar />);
    // ThemeToggle renders a button with aria-label
    const toggle = screen.getAllByLabelText(/Switch to (light|dark) mode/);
    expect(toggle.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Sign In button when user is not authenticated', () => {
    render(<Navbar />);
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('renders the mobile menu toggle button', () => {
    render(<Navbar />);
    const toggleBtn = screen.getByLabelText('Toggle menu');
    expect(toggleBtn).toBeInTheDocument();
  });

  it('opens mobile menu when toggle is clicked', () => {
    render(<Navbar />);
    const toggleBtn = screen.getByLabelText('Toggle menu');

    // Mobile menu should not show Docs in the mobile panel initially
    // (Docs exists in desktop nav but mobile panel is hidden)
    fireEvent.click(toggleBtn);

    // After clicking, the mobile menu should render nav links again inside mobile panel
    const docsLinks = screen.getAllByText('Docs');
    expect(docsLinks.length).toBeGreaterThanOrEqual(2); // desktop + mobile
  });

  it('renders a sticky header element', () => {
    render(<Navbar />);
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    expect(header.className).toContain('sticky');
  });

  it('renders Sign In link pointing to /auth/signin', () => {
    render(<Navbar />);
    const signInLink = screen.getByText('Sign In').closest('a');
    expect(signInLink).toHaveAttribute('href', '/auth/signin');
  });
});

// ---------------------------------------------------------------------------
// ThemeToggle
// ---------------------------------------------------------------------------
describe('ThemeToggle', () => {
  it('renders a button with an accessibility label', () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label');
  });

  it('has label "Switch to dark mode" when theme is light', () => {
    render(<ThemeToggle />);
    const btn = screen.getByLabelText('Switch to dark mode');
    expect(btn).toBeInTheDocument();
  });

  it('calls setTheme when clicked', async () => {
    // We need to access the mock to verify it was called
    const { useTheme } = await import('next-themes');
    const mockSetTheme = vi.fn();
    (useTheme as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
    });

    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('shows "Switch to light mode" when theme is dark', async () => {
    const { useTheme } = await import('next-themes');
    (useTheme as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      theme: 'dark',
      setTheme: vi.fn(),
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);
    const btn = screen.getByLabelText('Switch to light mode');
    expect(btn).toBeInTheDocument();
  });

  it('calls setTheme("light") when in dark mode and clicked', async () => {
    const { useTheme } = await import('next-themes');
    const mockSetTheme = vi.fn();
    (useTheme as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
    });

    render(<ThemeToggle />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
describe('Footer', () => {
  it('renders the brand name', () => {
    render(<Footer />);
    expect(screen.getByText('Xplorer')).toBeInTheDocument();
  });

  it('renders the brand description', () => {
    render(<Footer />);
    expect(
      screen.getByText(/A modern, AI-powered file explorer built with Rust and React./),
    ).toBeInTheDocument();
  });

  it('renders the "Product" link section', () => {
    render(<Footer />);
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('renders the "Developers" link section', () => {
    render(<Footer />);
    expect(screen.getByText('Developers')).toBeInTheDocument();
  });

  it('renders the "Connect" link section', () => {
    render(<Footer />);
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('renders Product links: Docs, Extensions, Pricing', () => {
    render(<Footer />);
    // Docs link in footer
    const docsLinks = screen.getAllByText('Docs');
    expect(docsLinks.length).toBeGreaterThanOrEqual(1);

    const extensionsLinks = screen.getAllByText('Extensions');
    expect(extensionsLinks.length).toBeGreaterThanOrEqual(1);

    const pricingLinks = screen.getAllByText('Pricing');
    expect(pricingLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Developers links: Publish, SDK Reference, API', () => {
    render(<Footer />);
    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.getByText('SDK Reference')).toBeInTheDocument();
    expect(screen.getByText('API')).toBeInTheDocument();
  });

  it('renders Connect links: GitHub, Twitter, Donate', () => {
    render(<Footer />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Twitter')).toBeInTheDocument();
    expect(screen.getByText('Donate')).toBeInTheDocument();
  });

  it('renders the GitHub link with correct external URL', () => {
    render(<Footer />);
    const githubLink = screen.getByText('GitHub').closest('a');
    expect(githubLink).toHaveAttribute('href', 'https://github.com/kimlimjustin/xplorer');
  });

  it('renders the Twitter link with correct external URL', () => {
    render(<Footer />);
    const twitterLink = screen.getByText('Twitter').closest('a');
    expect(twitterLink).toHaveAttribute('href', 'https://twitter.com/xplorer_app');
  });

  it('renders copyright text with the current year', () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`${year}`))).toBeInTheDocument();
  });

  it('renders copyright text mentioning "Xplorer"', () => {
    render(<Footer />);
    expect(screen.getByText(/Xplorer\. All rights reserved/)).toBeInTheDocument();
  });

  it('renders footer as a footer element', () => {
    render(<Footer />);
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();
  });

  it('renders Donate link pointing to /donate', () => {
    render(<Footer />);
    const donateLink = screen.getByText('Donate').closest('a');
    expect(donateLink).toHaveAttribute('href', '/donate');
  });

  it('renders SDK Reference link pointing to /docs/extensions/sdk', () => {
    render(<Footer />);
    const sdkLink = screen.getByText('SDK Reference').closest('a');
    expect(sdkLink).toHaveAttribute('href', '/docs/extensions/sdk');
  });

  it('renders API link pointing to /docs/api/tauri-commands', () => {
    render(<Footer />);
    const apiLink = screen.getByText('API').closest('a');
    expect(apiLink).toHaveAttribute('href', '/docs/api/tauri-commands');
  });
});
