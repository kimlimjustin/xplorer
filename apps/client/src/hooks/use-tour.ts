import { useState, useEffect } from 'react';
import { getTourSteps, type TourStep } from '@/lib/tour-steps';

const TOUR_COMPLETED_KEY = 'xplorer:tour-completed';

interface TourState {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
}

// Module-level singleton (same pattern as use-toast.ts)
let tourState: TourState = {
  isActive: false,
  currentStep: 0,
  steps: getTourSteps(),
};

const listeners: Array<(state: TourState) => void> = [];

const notify = () => {
  listeners.forEach((fn) => fn({ ...tourState }));
};

export const startTour = () => {
  tourState = { isActive: true, currentStep: 0, steps: getTourSteps() };
  notify();
};

export const endTour = (markCompleted = true) => {
  tourState = { ...tourState, isActive: false, currentStep: 0 };
  if (markCompleted) {
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
  }
  notify();
};

export const nextStep = () => {
  if (tourState.currentStep < tourState.steps.length - 1) {
    tourState = { ...tourState, currentStep: tourState.currentStep + 1 };
    notify();
  } else {
    endTour(true);
  }
};

export const prevStep = () => {
  if (tourState.currentStep > 0) {
    tourState = { ...tourState, currentStep: tourState.currentStep - 1 };
    notify();
  }
};

export const goToStep = (index: number) => {
  if (index >= 0 && index < tourState.steps.length) {
    tourState = { ...tourState, currentStep: index };
    notify();
  }
};

export const isTourCompleted = (): boolean => {
  return localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
};

export const resetTourCompleted = () => {
  localStorage.removeItem(TOUR_COMPLETED_KEY);
};

export const useTour = () => {
  const [state, setState] = useState<TourState>(tourState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return {
    ...state,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    isTourCompleted,
  };
};
