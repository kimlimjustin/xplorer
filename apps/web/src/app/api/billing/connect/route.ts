import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let accountId = user.stripeConnectAccountId;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: 'express',
      email: user.email || undefined,
      metadata: { userId: user.id },
    });
    accountId = account.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeConnectAccountId: accountId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const accountLink = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/dashboard`,
    return_url: `${appUrl}/dashboard`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
