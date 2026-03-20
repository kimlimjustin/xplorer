import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTour, nextStep, prevStep, endTour, goToStep } from '@/hooks/use-tour';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  PanelLeft,
  FolderOpen,
  Search,
  Puzzle,
  Terminal,
  Keyboard,
  Package,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import type { TourStep } from '@/lib/tour-steps';

const ICON_MAP: Record<string, React.ElementType> = {
  Sparkles,
  PanelLeft,
  FolderOpen,
  Search,
  Puzzle,
  Terminal,
  Keyboard,
  Package,
  CheckCircle,
};

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const TOOLTIP_WIDTH = 380;
const TOOLTIP_ESTIMATE_HEIGHT = 220;
const GAP = 16;
const VIEWPORT_PADDING = 16;
const SPOTLIGHT_PADDING = 8;

const computePositions = (step: TourStep) => {
  if (!step.target) {
    return {
      spotlight: null,
      tooltipStyle: {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      },
      placement: 'center' as const,
    };
  }

  const el = document.querySelector(`[data-tour="${step.target}"]`);
  if (!el) {
    return {
      spotlight: null,
      tooltipStyle: {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      },
      placement: 'center' as const,
    };
  }

  const rect = el.getBoundingClientRect();
  const spot: SpotlightRect = {
    x: rect.left - SPOTLIGHT_PADDING,
    y: rect.top - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };

  // Determine placement with fallback
  let placement = step.placement;
  if (placement === 'bottom' && rect.bottom + GAP + TOOLTIP_ESTIMATE_HEIGHT > window.innerHeight) {
    placement = 'top';
  } else if (placement === 'top' && rect.top - GAP - TOOLTIP_ESTIMATE_HEIGHT < 0) {
    placement = 'bottom';
  } else if (placement === 'right' && rect.right + GAP + TOOLTIP_WIDTH > window.innerWidth) {
    placement = 'left';
  } else if (placement === 'left' && rect.left - GAP - TOOLTIP_WIDTH < 0) {
    placement = 'right';
  }

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'bottom':
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'top':
      top = rect.top - GAP - TOOLTIP_ESTIMATE_HEIGHT;
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
      break;
    case 'right':
      top = rect.top + rect.height / 2 - TOOLTIP_ESTIMATE_HEIGHT / 2;
      left = rect.right + GAP;
      break;
    case 'left':
      top = rect.top + rect.height / 2 - TOOLTIP_ESTIMATE_HEIGHT / 2;
      left = rect.left - GAP - TOOLTIP_WIDTH;
      break;
  }

  // Viewport clamp
  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING),
  );
  top = Math.max(
    VIEWPORT_PADDING,
    Math.min(top, window.innerHeight - TOOLTIP_ESTIMATE_HEIGHT - VIEWPORT_PADDING),
  );

  return {
    spotlight: spot,
    tooltipStyle: { top, left, transform: undefined as string | undefined },
    placement,
  };
}

const TourOverlay = () => {
  const { t } = useTranslation();
  const { isActive, currentStep, steps } = useTour();
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<Record<string, string | number | undefined>>({});
  const [isVisible, setIsVisible] = useState(false);
  const [stepKey, setStepKey] = useState(0); // triggers tooltip entrance animation
  const maskIdRef = useRef(`tour-mask-${Date.now()}`);

  const step = steps[currentStep];

  const updatePositions = useCallback(() => {
    if (!step) return;
    const { spotlight: s, tooltipStyle: ts } = computePositions(step);
    setSpotlight(s);
    setTooltipStyle(ts);
  }, [step]);

  // Recalculate on step change / resize
  useEffect(() => {
    if (!isActive) return;
    updatePositions();
    setStepKey((k) => k + 1);

    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [isActive, currentStep, updatePositions]);

  // Entrance / exit fade
  useEffect(() => {
    if (isActive) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isActive]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        endTour(false);
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevStep();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [isActive]);

  if (!isActive || !step) return null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const isCentered = !step.target;
  const Icon = ICON_MAP[step.icon];
  const maskId = maskIdRef.current;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[60] transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {/* SVG spotlight overlay */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.x}
                y={spotlight.y}
                width={spotlight.width}
                height={spotlight.height}
                rx="8"
                fill="black"
                style={{ transition: 'all 0.5s ease-in-out' }}
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask={`url(#${maskId})`}
          className="pointer-events-auto"
          onClick={() => endTour(false)}
        />
        {/* Spotlight glow border */}
        {spotlight && (
          <rect
            x={spotlight.x}
            y={spotlight.y}
            width={spotlight.width}
            height={spotlight.height}
            rx="8"
            fill="none"
            stroke="var(--xp-blue, #7aa2f7)"
            strokeWidth="2"
            className="tour-spotlight-glow"
            style={{ transition: 'all 0.5s ease-in-out' }}
          />
        )}
      </svg>

      {/* Tooltip */}
      <div
        key={stepKey}
        className={cn(
          'fixed rounded-xl border border-xp-border bg-xp-surface shadow-2xl',
          'tour-tooltip-enter',
          isCentered && 'text-center',
        )}
        style={{
          width: TOOLTIP_WIDTH,
          zIndex: 61,
          ...tooltipStyle,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn('flex items-center gap-2.5 p-4 pb-2', isCentered && 'justify-center')}>
          {Icon && <Icon size={20} className="text-xp-blue shrink-0" />}
          <h3 className="text-base font-semibold text-xp-text">{step.title}</h3>
          {!isCentered && (
            <button
              onClick={() => endTour(false)}
              className="ml-auto p-1 rounded-md text-xp-text-muted hover:text-xp-text hover:bg-xp-surface-light transition-colors"
              aria-label={t('tour.closeTour')}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Description */}
        <div className="px-4 pb-3">
          <p className="text-sm text-xp-text-secondary leading-relaxed">{step.description}</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 pt-2 border-t border-xp-border/50">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => goToStep(i)}
                className={cn(
                  'h-2 rounded-full transition-all duration-200',
                  i === currentStep
                    ? 'bg-xp-blue w-4'
                    : i < currentStep
                      ? 'bg-xp-blue/40 w-2'
                      : 'bg-xp-border w-2',
                )}
                aria-label={t('tour.goToStep', { step: i + 1 })}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            {isFirst && (
              <button
                onClick={() => endTour(false)}
                className="px-3 py-1.5 rounded-md text-sm text-xp-text-secondary hover:text-xp-text hover:bg-xp-surface-light transition-colors"
              >
                {t('tour.skip')}
              </button>
            )}
            {!isFirst && (
              <button
                onClick={() => prevStep()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm text-xp-text-secondary hover:text-xp-text hover:bg-xp-surface-light transition-colors"
              >
                <ChevronLeft size={14} />
                {t('tour.back')}
              </button>
            )}
            <button
              onClick={isLast ? () => endTour(true) : () => nextStep()}
              className="flex items-center gap-1 px-4 py-1.5 rounded-md text-sm font-medium bg-xp-blue text-white hover:opacity-90 transition-opacity"
            >
              {isLast ? t('tour.getStarted') : t('tour.next')}
              {!isLast && <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        {/* Step counter */}
        <div className="pb-3 text-[10px] text-xp-text-muted text-center">
          {t('tour.stepOf', { current: currentStep + 1, total: steps.length })}
        </div>
      </div>
    </div>
  );
}

export default TourOverlay;
