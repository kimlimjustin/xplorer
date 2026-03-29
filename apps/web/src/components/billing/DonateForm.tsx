'use client';

import { useState } from 'react';
import { Heart, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const PRESET_AMOUNTS = [500, 1000, 2500, 5000]; // in cents

export function DonateForm() {
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = isCustom ? Math.round(parseFloat(customAmount || '0') * 100) : selectedAmount;

  const handleDonate = async () => {
    if (amountCents < 100) {
      setError('Minimum donation is $1.00');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/billing/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountCents }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to create donation session');
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="space-y-4">
        {/* Preset amounts */}
        <div className="grid grid-cols-4 gap-3">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => {
                setSelectedAmount(amount);
                setIsCustom(false);
              }}
              className={cn(
                'rounded-lg border py-3 text-sm font-semibold transition-colors',
                !isCustom && selectedAmount === amount
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600',
              )}
            >
              ${(amount / 100).toFixed(0)}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div>
          <button
            onClick={() => setIsCustom(true)}
            className={cn(
              'mb-2 w-full rounded-lg border py-3 text-sm font-semibold transition-colors',
              isCustom
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600',
            )}
          >
            Custom Amount
          </button>
          {isCustom && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-gray-400 dark:text-gray-500">
                $
              </span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="10.00"
                className="w-full rounded-lg border border-gray-200 py-2.5 pl-8 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          onClick={handleDonate}
          size="lg"
          loading={loading}
          className="w-full"
          disabled={amountCents < 100}
        >
          <Heart className="h-4 w-4" />
          Donate ${(amountCents / 100).toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
