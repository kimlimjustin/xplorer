import { describe, it, expect, vi } from 'vitest';

vi.mock('@/i18n', () => ({
  default: {
    t: (key: string) => key.includes('.') ? key.split('.').pop()! : key,
  },
}));

import { getTourSteps, type TourStep } from '@/lib/tour-steps';

describe('tour-steps', () => {
  describe('getTourSteps() array', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(getTourSteps())).toBe(true);
      expect(getTourSteps().length).toBeGreaterThan(0);
    });

    it('each step has the required properties', () => {
      for (const step of getTourSteps()) {
        expect(step).toHaveProperty('target');
        expect(typeof step.title).toBe('string');
        expect(step.title.length).toBeGreaterThan(0);
        expect(typeof step.description).toBe('string');
        expect(step.description.length).toBeGreaterThan(0);
        expect(['top', 'bottom', 'left', 'right', 'center']).toContain(step.placement);
        expect(typeof step.icon).toBe('string');
        expect(step.icon.length).toBeGreaterThan(0);
      }
    });

    it('target is either null or a non-empty string', () => {
      for (const step of getTourSteps()) {
        if (step.target !== null) {
          expect(typeof step.target).toBe('string');
          expect(step.target.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('tour flow', () => {
    it('starts with a welcome step (target=null, placement=center)', () => {
      const first = getTourSteps()[0];
      expect(first.target).toBeNull();
      expect(first.placement).toBe('center');
      expect(first.title).toBe('title');
    });

    it('ends with a completion step (target=null, placement=center)', () => {
      const last = getTourSteps()[getTourSteps().length - 1];
      expect(last.target).toBeNull();
      expect(last.placement).toBe('center');
    });

    it('has intermediate steps that target UI elements', () => {
      // At least some steps should have non-null targets
      const targetedSteps = getTourSteps().filter((s) => s.target !== null);
      expect(targetedSteps.length).toBeGreaterThan(0);
    });

    it('includes a step targeting the sidebar', () => {
      const sidebarStep = getTourSteps().find((s) => s.target === 'sidebar');
      expect(sidebarStep).toBeDefined();
      expect(sidebarStep).toBeDefined();
    });

    it('includes a step targeting the file grid', () => {
      const fileGridStep = getTourSteps().find((s) => s.target === 'file-grid');
      expect(fileGridStep).toBeDefined();
    });

    it('includes a step targeting the top bar', () => {
      const topBarStep = getTourSteps().find((s) => s.target === 'top-bar');
      expect(topBarStep).toBeDefined();
    });

    it('includes a step targeting extensions bar', () => {
      const extStep = getTourSteps().find((s) => s.target === 'extensions-bar');
      expect(extStep).toBeDefined();
    });

    it('includes a step targeting bottom panel', () => {
      const bottomStep = getTourSteps().find((s) => s.target === 'bottom-panel-toggle');
      expect(bottomStep).toBeDefined();
    });
  });

  describe('step content quality', () => {
    it('all titles are non-empty strings', () => {
      const titles = getTourSteps().map((s) => s.title);
      for (const title of titles) {
        expect(typeof title).toBe('string');
        expect(title.length).toBeGreaterThan(0);
      }
    });

    it('all descriptions are non-empty strings', () => {
      for (const step of getTourSteps()) {
        expect(typeof step.description).toBe('string');
        expect(step.description.length).toBeGreaterThan(0);
      }
    });

    it('all icons are valid Lucide icon names (PascalCase)', () => {
      const pascalCaseRegex = /^[A-Z][a-zA-Z0-9]*$/;
      for (const step of getTourSteps()) {
        expect(step.icon).toMatch(pascalCaseRegex);
      }
    });
  });

  describe('step count', () => {
    it('has a reasonable number of steps (5-15)', () => {
      expect(getTourSteps().length).toBeGreaterThanOrEqual(5);
      expect(getTourSteps().length).toBeLessThanOrEqual(15);
    });
  });

  describe('TourStep type', () => {
    it('conforms to the TourStep interface', () => {
      const step: TourStep = {
        target: 'test',
        title: 'Test Step',
        description: 'This is a test step for type checking',
        placement: 'bottom',
        icon: 'TestIcon',
      };
      expect(step.target).toBe('test');
      expect(step.placement).toBe('bottom');
    });

    it('allows null target for centered steps', () => {
      const step: TourStep = {
        target: null,
        title: 'Centered Step',
        description: 'A centered dialog step',
        placement: 'center',
        icon: 'Info',
      };
      expect(step.target).toBeNull();
    });
  });
});
