import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { publishExtensionSchema } from '@/lib/validation';
import { extensionsListLimiter, getClientIp } from '@/lib/rate-limit';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/extensions — List published & approved extensions
 */
export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit — 60 requests per minute per IP
    try {
      await extensionsListLimiter.check(60, getClientIp(request));
    } catch {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders(request) },
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || '';
    const sort = searchParams.get('sort') || 'newest';
    // MED-W03: Explicit pagination validation with NaN protection and tighter max limit
    const page = Math.max(1, Math.min(10000, parseInt(searchParams.get('page') || '1', 10) || 1));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const pricingType = searchParams.get('pricingType') || '';

    const where: Prisma.ExtensionWhereInput = {
      isPublished: true,
      status: 'APPROVED',
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.categories = {
        some: {
          category: {
            slug: category,
          },
        },
      };
    }

    if (pricingType === 'FREE' || pricingType === 'PAID') {
      where.pricingType = pricingType;
    }

    let orderBy: Prisma.ExtensionOrderByWithRelationInput;
    switch (sort) {
      case 'popular':
        orderBy = { downloadCount: 'desc' };
        break;
      case 'rating':
        orderBy = { averageRating: 'desc' };
        break;
      case 'name':
        orderBy = { displayName: 'asc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const [extensions, total] = await Promise.all([
      prisma.extension.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: { id: true, name: true, username: true, image: true },
          },
          categories: {
            include: { category: true },
          },
          _count: {
            select: { reviews: true, versions: true },
          },
        },
      }),
      prisma.extension.count({ where }),
    ]);

    return NextResponse.json(
      {
        extensions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error('GET /api/extensions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extensions' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

/**
 * POST /api/extensions — Create a new extension (metadata only, no file upload)
 */
export async function POST(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders(request) },
      );
    }

    const body = await request.json();
    const parsed = publishExtensionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const data = parsed.data;

    // Generate slug from name
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Validate paid extension requirements (outside transaction — read-only checks)
    if (data.pricingType === 'PAID') {
      if (!data.price || data.price < 99) {
        return NextResponse.json(
          { error: 'Paid extensions must have a price of at least $0.99' },
          { status: 400, headers: corsHeaders(request) },
        );
      }

      const author = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { stripeConnectOnboarded: true },
      });

      if (!author?.stripeConnectOnboarded) {
        return NextResponse.json(
          {
            error: 'You must complete Stripe Connect onboarding before publishing paid extensions',
          },
          { status: 400, headers: corsHeaders(request) },
        );
      }
    }

    // Wrap uniqueness check + create in a transaction to prevent race conditions
    const extension = await prisma.$transaction(async (tx) => {
      // Check for duplicate name/slug inside transaction
      const existing = await tx.extension.findFirst({
        where: {
          OR: [{ name: data.name }, { slug }],
        },
      });

      if (existing) {
        throw new Error('DUPLICATE_EXTENSION');
      }

      return tx.extension.create({
        data: {
          name: data.name,
          slug,
          displayName: data.displayName,
          description: data.description,
          longDescription: data.longDescription || null,
          version: data.version,
          minimumXplorerVersion: data.minimumXplorerVersion,
          licenseType: data.licenseType,
          repositoryUrl: data.repositoryUrl || null,
          homepageUrl: data.homepageUrl || null,
          bugReportUrl: data.bugReportUrl || null,
          pricingType: data.pricingType,
          price: data.pricingType === 'PAID' ? data.price : null,
          currency: data.currency,
          authorId: session.user.id,
          categories: data.categories
            ? {
                create: data.categories.map((catSlug: string) => ({
                  category: { connect: { slug: catSlug } },
                })),
              }
            : undefined,
          tags: data.tags
            ? {
                create: data.tags.map((tagName: string) => ({
                  tag: {
                    connectOrCreate: {
                      where: { name: tagName },
                      create: {
                        name: tagName,
                        slug: tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                      },
                    },
                  },
                })),
              }
            : undefined,
        },
        include: {
          author: { select: { id: true, name: true, username: true, image: true } },
          categories: { include: { category: true } },
          tags: { include: { tag: true } },
        },
      });
    });

    return NextResponse.json(extension, { status: 201, headers: corsHeaders(request) });
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_EXTENSION') {
      return NextResponse.json(
        { error: 'An extension with this name already exists' },
        { status: 409, headers: corsHeaders(request) },
      );
    }
    console.error('POST /api/extensions error:', error);
    return NextResponse.json(
      { error: 'Failed to create extension' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
