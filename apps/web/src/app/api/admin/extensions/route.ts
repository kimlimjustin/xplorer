import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { adminUpdateExtensionSchema } from '@/lib/validation';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/admin/extensions — List all extensions (admin)
 */
export async function GET(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403, headers: corsHeaders(request) }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || '';
    const page = Math.max(1, Math.min(10000, parseInt(searchParams.get('page') || '1', 10) || 1));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const search = searchParams.get('search') || '';

    const where: Prisma.ExtensionWhereInput = {};

    if (status && ['PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'].includes(status)) {
      where.status = status as any;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [extensions, total] = await Promise.all([
      prisma.extension.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: {
            select: { id: true, name: true, username: true, email: true, image: true },
          },
          categories: { include: { category: true } },
          _count: { select: { reviews: true, versions: true } },
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
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('GET /api/admin/extensions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch extensions' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

/**
 * PATCH /api/admin/extensions — Update extension status (admin)
 */
export async function PATCH(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403, headers: corsHeaders(request) }
    );
  }

  try {
    const body = await request.json();
    const { extensionId, ...updateFields } = body;

    if (!extensionId) {
      return NextResponse.json(
        { error: 'extensionId is required' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const parsed = adminUpdateExtensionSchema.safeParse(updateFields);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const extension = await prisma.extension.findUnique({
      where: { id: extensionId },
      select: { id: true },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    const data: Record<string, any> = {};

    if (parsed.data.status) {
      data.status = parsed.data.status;

      // Auto-manage isPublished and publishedAt based on status
      if (parsed.data.status === 'APPROVED') {
        data.isPublished = true;
        data.publishedAt = new Date();
      } else if (parsed.data.status === 'REJECTED' || parsed.data.status === 'ARCHIVED') {
        data.isPublished = false;
      }
    }

    if (parsed.data.isFeatured !== undefined) {
      data.isFeatured = parsed.data.isFeatured;
    }

    const updated = await prisma.extension.update({
      where: { id: extensionId },
      data,
      include: {
        author: { select: { id: true, name: true, username: true, image: true } },
        categories: { include: { category: true } },
      },
    });

    return NextResponse.json(updated, { headers: corsHeaders(request) });
  } catch (error) {
    console.error('PATCH /api/admin/extensions error:', error);
    return NextResponse.json(
      { error: 'Failed to update extension' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
