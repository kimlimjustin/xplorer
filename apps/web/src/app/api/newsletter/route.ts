import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 100 });
const RATE_LIMIT = 3;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, website, _t } = body as {
      email?: string;
      website?: string; // honeypot field — bots fill this, humans don't
      _t?: number; // timestamp when form rendered — reject if submitted too fast
    };

    // Honeypot: if the hidden "website" field has a value, it's a bot
    if (website) {
      // Return success to the bot so it thinks it worked
      return NextResponse.json({ ok: true });
    }

    // Time-based check: reject if form was submitted in under 2 seconds
    if (_t && Date.now() - _t < 2000) {
      return NextResponse.json({ ok: true }); // silent rejection
    }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    try {
      await limiter.check(RATE_LIMIT, ip);
    } catch {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    // Upsert subscriber (ignore if already exists)
    await prisma.newsletterSubscriber.upsert({
      where: { email: trimmed },
      update: {},
      create: { email: trimmed },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Newsletter] Subscribe error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
