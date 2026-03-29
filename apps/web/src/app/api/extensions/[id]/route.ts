import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { updateExtensionSchema } from '@/lib/validation';
import { extensionDetailLimiter, getClientIp } from '@/lib/rate-limit';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/extensions/[id] — Get extension details
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // Rate limit — 120 requests per minute per IP
    try {
      await extensionDetailLimiter.check(120, getClientIp(request));
    } catch {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders(request) },
      );
    }

    const { id } = await context.params;

    const extension = await prisma.extension.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, username: true, image: true, bio: true },
        },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        versions: { orderBy: { createdAt: 'desc' } },
        reviews: {
          include: {
            user: { select: { id: true, name: true, username: true, image: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { reviews: true, versions: true } },
      },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    // If not published/approved, only owner or admin can view
    if (!extension.isPublished || extension.status !== 'APPROVED') {
      const session = await auth();
      const isOwner = session?.user?.id === extension.authorId;
      const isAdmin = session?.user?.role === 'ADMIN';

      if (!isOwner && !isAdmin) {
        return NextResponse.json(
          { error: 'Extension not found' },
          { status: 404, headers: corsHeaders(request) },
        );
      }
    }

    return NextResponse.json(extension, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('GET /api/extensions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extension' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

/**
 * PATCH /api/extensions/[id] — Update an extension (owner or admin)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    const extension = await prisma.extension.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    const isOwner = session.user.id === extension.authorId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: corsHeaders(request) },
      );
    }

    const body = await request.json();
    const parsed = updateExtensionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(request) },
      );
    }

    const data = parsed.data;

    // MED-28: Prevent price/pricingType changes if purchases exist
    if (data.pricingType !== undefined || data.price !== undefined) {
      const purchaseCount = await prisma.purchase.count({
        where: { extensionId: id },
      });

      if (purchaseCount > 0) {
        return NextResponse.json(
          {
            error:
              'Cannot change pricing for an extension that has existing purchases. Please create a new extension listing instead.',
          },
          { status: 400, headers: corsHeaders(request) },
        );
      }
    }

    // Build update payload
    const updateData: Record<string, any> = {};
    const allowedFields = [
      'displayName',
      'description',
      'longDescription',
      'icon',
      'screenshots',
      'licenseType',
      'repositoryUrl',
      'homepageUrl',
      'bugReportUrl',
      'pricingType',
      'price',
      'currency',
    ];

    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        updateData[field] = (data as any)[field];
      }
    }

    // Handle categories update
    if (data.categories) {
      await prisma.categoriesOnExtensions.deleteMany({ where: { extensionId: id } });
      const matchedCategories = await prisma.category.findMany({
        where: { slug: { in: data.categories } },
        select: { id: true },
      });
      if (matchedCategories.length > 0) {
        await prisma.categoriesOnExtensions.createMany({
          data: matchedCategories.map((cat) => ({ extensionId: id, categoryId: cat.id })),
        });
      }
    }

    // Handle tags update
    if (data.tags) {
      await prisma.tagsOnExtensions.deleteMany({ where: { extensionId: id } });
      const upsertedTags = await prisma.$transaction(
        data.tags.map((tagName) =>
          prisma.tag.upsert({
            where: { name: tagName },
            update: {},
            create: {
              name: tagName,
              slug: tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            },
            select: { id: true },
          }),
        ),
      );
      if (upsertedTags.length > 0) {
        await prisma.tagsOnExtensions.createMany({
          data: upsertedTags.map((tag) => ({ extensionId: id, tagId: tag.id })),
        });
      }
    }

    const updated = await prisma.extension.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, username: true, image: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    return NextResponse.json(updated, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('PATCH /api/extensions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update extension' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}

/**
 * DELETE /api/extensions/[id] — Archive an extension (soft delete)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const { id } = await context.params;

    const extension = await prisma.extension.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) },
      );
    }

    const isOwner = session.user.id === extension.authorId;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403, headers: corsHeaders(request) },
      );
    }

    await prisma.extension.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        isPublished: false,
      },
    });

    return NextResponse.json(
      { message: 'Extension archived successfully' },
      { headers: corsHeaders(request) },
    );
  } catch (error) {
    console.error('DELETE /api/extensions/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to archive extension' },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
