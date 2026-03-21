import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  default: {
    t: (key: string) => (key.includes('.') ? key.split('.').pop()! : key),
  },
}));

import {
  useTour,
  startTour,
  endTour,
  nextStep,
  prevStep,
  goToStep,
  isTourCompleted,
  resetTourCompleted,
} from '@/hooks/use-tour';
import { getTourSteps } from '@/lib/tour-steps';

describe('useTour', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset tour state by ending without marking completed
    endTour(false);
  });

  describe('initial state', () => {
    it('starts inactive', () => {
      const { result } = renderHook(() => useTour());
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(0);
    });

    it('has all tour steps', () => {
      const { result } = renderHook(() => useTour());
      expect(result.current.steps).toEqual(getTourSteps());
      expect(result.current.steps.length).toBeGreaterThan(0);
    });
  });

  describe('startTour', () => {
    it('activates the tour at step 0', () => {
      const { result } = renderHook(() => useTour());

      act(() => {
        startTour();
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.currentStep).toBe(0);
    });
  });

  describe('endTour', () => {
    it('deactivates the tour', () => {
      const { result } = renderHook(() => useTour());

      act(() => {
        startTour();
      });
      act(() => {
        endTour();
      });

      expect(result.current.isActive).toBe(false);
      expect(result.current.currentStep).toBe(0);
    });

    it('marks tour as completed in localStorage by default', () => {
      act(() => {
        startTour();
      });
      act(() => {
        endTour();
      });

      expect(localStorage.getItem('xplorer:tour-completed')).toBe('true');
    });

    it('does not mark completed when markCompleted=false', () => {
      act(() => {
        startTour();
      });
      act(() => {
        endTour(false);
      });

      expect(localStorage.getItem('xplorer:tour-completed')).toBeNull();
    });
  });

  describe('nextStep', () => {
    it('advances to the next step', () => {
      const { result } = renderHook(() => useTour());

      act(() => {
        startTour();
      });
      act(() => {
        nextStep();
      });

      expect(result.current.currentStep).toBe(1);
    });

    it('ends tour when at the last step', () => {
      const { result } = renderHook(() => useTour());

      act(() => {
        startTour();
      });

      // Advance to last step
      for (let i = 0; i < getTourSteps().length - 1; i++) {
        act(() => {
          nextStep();
        });
      }
      expect(result.current.currentStep).toBe(getTourSteps().length - 1);

      // One more should end the tour
      act(() => {
        nextStep();
      });
      expect(result.current.isActive).toBe(false);
    });
  });

  describe('prevStep', () => {
    it('goes back one step', () => {
      const { result } = renderHook(() => useTour());

      act(() => {
        startTour();
      });
      act(() => {
        nextStep();
      });
      act(() => {
        nextStep();
      });
      expect(result.current.currentStep).toBe(2);

      act(() => {
        prevStep();
      });
      expect(result.current.currentStep).toBe(1);
    });

    it('does nothing at step 0', () => {
      const { result } = renderHook(() => useTour());

      act(() => {
        startTour();
      });
      act(() => {
        prevStep();
      });

      expect(result.current.currentStep).toBe(0);
    });
  });

  describe('goToStep', () => {
    it('jumps to a specific step', () => {
      const { result } = renderHook(() => useTour());

      act(() => {
        startTour();
      });
      act(() => {
        goToStep(3);
      });

      expect(result.current.currentStep).toBe(3);
    });

    it('ignores out-of-range index (negative)', () => {
      const { result } = renderHook(() => useTour());

      act(() => {
        startTour();
      });
      act(() => {
        goToStep(-1);
      });

      expect(result.current.currentStep).toBe(0);
    });

    it('ignores out-of-range index (too large)', () => {
      const { result } = renderHook(() => useTour());

      act(() => {
        startTour();
      });
      act(() => {
        goToStep(999);
      });

      expect(result.current.currentStep).toBe(0);
    });
  });

  describe('isTourCompleted', () => {
    it('returns false initially', () => {
      expect(isTourCompleted()).toBe(false);
    });

    it('returns true after ending tour with completion', () => {
      act(() => {
        startTour();
      });
      act(() => {
        endTour(true);
      });

      expect(isTourCompleted()).toBe(true);
    });
  });

  describe('resetTourCompleted', () => {
    it('clears the completed flag', () => {
      act(() => {
        startTour();
      });
      act(() => {
        endTour(true);
      });
      expect(isTourCompleted()).toBe(true);

      resetTourCompleted();
      expect(isTourCompleted()).toBe(false);
    });
  });

  describe('multiple listeners', () => {
    it('notifies multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useTour());
      const { result: result2 } = renderHook(() => useTour());

      act(() => {
        startTour();
      });

      expect(result1.current.isActive).toBe(true);
      expect(result2.current.isActive).toBe(true);
    });
  });
});
