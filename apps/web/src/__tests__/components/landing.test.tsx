import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/landing/Hero';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';
import { Stats } from '@/components/landing/Stats';
import { Cta } from '@/components/landing/Cta';
import { TechStrip } from '@/components/landing/TechStrip';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
describe('Hero', () => {
  it('renders the headline text', () => {
    render(<Hero />);
    expect(screen.getByText('The file manager')).toBeInTheDocument();
    expect(screen.getByText('you deserve.')).toBeInTheDocument();
  });

  it('renders the download button linking to installation docs', () => {
    render(<Hero />);
    const link = screen.getByText('Download for Free');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/docs/getting-started/installation');
  });

  it('renders the GitHub button with correct external link', () => {
    render(<Hero />);
    const link = screen.getByText('Star on GitHub');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://github.com/kimlimjustin/xplorer');
  });

  it('renders the app window mockup with title', () => {
    render(<Hero />);
    expect(screen.getByText(/Xplorer — ~\/Projects/)).toBeInTheDocument();
  });

  it('renders the beta badge', () => {
    render(<Hero />);
    expect(screen.getByText(/Now in Beta/)).toBeInTheDocument();
  });

  it('renders the subtitle describing features', () => {
    render(<Hero />);
    expect(screen.getByText(/AI-powered search/)).toBeInTheDocument();
  });

  it('renders the hero screenshot image', () => {
    render(<Hero />);
    const img = screen.getByAltText('Xplorer file manager');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/screenshots/hero-app.png');
  });
});

// ---------------------------------------------------------------------------
// FeatureShowcase
// ---------------------------------------------------------------------------
describe('FeatureShowcase', () => {
  it('renders the section header', () => {
    render(<FeatureShowcase />);
    // The heading is split by a <br /> so we use a regex to match partial text
    expect(screen.getByText(/Everything you need/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing you don/)).toBeInTheDocument();
  });

  it('renders the "Features" label', () => {
    render(<FeatureShowcase />);
    expect(screen.getByText('Features')).toBeInTheDocument();
  });

  it('renders all 6 feature titles', () => {
    render(<FeatureShowcase />);
    const featureTitles = [
      'Navigate at the speed of thought.',
      'Preview anything. Instantly.',
      'Ask your files anything.',
      'Search by meaning, not just name.',
      'Your repo, at a glance.',
      'Make it yours.',
    ];
    for (const title of featureTitles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('renders all 6 feature labels', () => {
    render(<FeatureShowcase />);
    const featureLabels = [
      'File Browsing',
      'Rich Previews',
      'AI Chat',
      'Smart Search',
      'Git Integration',
      'Extensions',
    ];
    for (const label of featureLabels) {
      // Labels appear twice: once in the text, once as screenshot alt text suffix
      const elements = screen.getAllByText(label);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders feature descriptions', () => {
    render(<FeatureShowcase />);
    expect(screen.getByText(/Grid, list, and column views/)).toBeInTheDocument();
    expect(screen.getByText(/Images, PDFs, code with syntax highlighting/)).toBeInTheDocument();
  });

  it('renders feature demo windows with title bars', () => {
    const { container } = render(<FeatureShowcase />);
    // Each feature renders an interactive demo inside a window frame
    // with macOS-style traffic light dots and "Xplorer" title
    const xplorerTitles = screen.getAllByText('Xplorer');
    // There should be 6 features, each with a window frame
    expect(xplorerTitles.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------
describe('Stats', () => {
  it('renders all stat values', () => {
    render(<Stats />);
    expect(screen.getByText('50+')).toBeInTheDocument();
    expect(screen.getByText('<50MB')).toBeInTheDocument();
    expect(screen.getByText('SSH')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders all stat labels', () => {
    render(<Stats />);
    expect(screen.getByText('File Formats')).toBeInTheDocument();
    expect(screen.getByText('Install Size')).toBeInTheDocument();
    expect(screen.getByText('Remote Access')).toBeInTheDocument();
    expect(screen.getByText('Offline AI')).toBeInTheDocument();
  });

  it('renders stat descriptions', () => {
    render(<Stats />);
    expect(screen.getByText('Previewed natively')).toBeInTheDocument();
    expect(screen.getByText('Lightweight and fast')).toBeInTheDocument();
    expect(screen.getByText('Full server browsing')).toBeInTheDocument();
    expect(screen.getByText('Local Ollama models')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Cta
// ---------------------------------------------------------------------------
describe('Cta', () => {
  it('renders the call to action heading', () => {
    render(<Cta />);
    expect(screen.getByText('Ready to explore?')).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<Cta />);
    expect(screen.getByText(/Download Xplorer for free/)).toBeInTheDocument();
  });

  it('renders the download link', () => {
    render(<Cta />);
    const link = screen.getByText('Download Xplorer');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/docs/getting-started/installation');
  });

  it('renders the GitHub link', () => {
    render(<Cta />);
    const link = screen.getByText('Star on GitHub');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', 'https://github.com/kimlimjustin/xplorer');
  });
});

// ---------------------------------------------------------------------------
// TechStrip
// ---------------------------------------------------------------------------
describe('TechStrip', () => {
  it('renders the "Built with" header', () => {
    render(<TechStrip />);
    expect(screen.getByText('Built with')).toBeInTheDocument();
  });

  it('renders all tech names', () => {
    render(<TechStrip />);
    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.getByText('Tauri v2')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Ollama')).toBeInTheDocument();
  });

  it('renders tech descriptions', () => {
    render(<TechStrip />);
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.getByText('Framework')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByText('AI Engine')).toBeInTheDocument();
  });
});
