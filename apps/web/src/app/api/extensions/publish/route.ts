import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { uploadExtensionFile, computeChecksum } from '@/lib/upload';
import { publishExtensionSchema } from '@/lib/validation';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import { publishLimiter, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/extensions/publish — Publish an extension with a ZIP file upload
 */
export async function POST(request: NextRequest) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // CRIT-08: Rate limit — 5 requests per minute per IP
    try {
      await publishLimiter.check(5, getClientIp(request));
    } catch {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders(request) }
      );
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders(request) }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Extension file (ZIP) is required' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    if (file.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 50MB limit' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Only ZIP files are accepted' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // MED-29: Content-Type validation
    if (file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed') {
      return NextResponse.json(
        { error: 'Invalid file type. Only ZIP files are accepted.' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // Validate ZIP magic bytes
    const magicBuffer = Buffer.from(await file.slice(0, 4).arrayBuffer());
    if (magicBuffer[0] !== 0x50 || magicBuffer[1] !== 0x4B || magicBuffer[2] !== 0x03 || magicBuffer[3] !== 0x04) {
      return NextResponse.json(
        { error: 'Invalid ZIP file' },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    // Extract metadata from form fields
    const metadata: Record<string, any> = {};
    for (const key of [
      'name', 'displayName', 'description', 'longDescription', 'version',
      'minimumXplorerVersion', 'licenseType', 'repositoryUrl', 'homepageUrl',
      'bugReportUrl', 'pricingType', 'price', 'currency',
    ]) {
      const val = formData.get(key);
      if (val !== null) metadata[key] = val.toString();
    }

    // Parse categories and tags from JSON strings
    const categoriesRaw = formData.get('categories');
    const tagsRaw = formData.get('tags');
    let categories: string[] = [];
    let tags: string[] = [];

    try {
      if (categoriesRaw) categories = JSON.parse(categoriesRaw.toString());
    } catch {
      categories = [];
    }

    try {
      if (tagsRaw) tags = JSON.parse(tagsRaw.toString());
    } catch {
      tags = [];
    }

    // Validate metadata
    const parsed = publishExtensionSchema.safeParse({
      ...metadata,
      categories,
      tags,
      price: metadata.price ? parseInt(metadata.price, 10) : undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(request) }
      );
    }

    const data = parsed.data;

    // Generate slug
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Validate paid extension requirements (outside transaction as it doesn't need atomicity)
    if (data.pricingType === 'PAID') {
      if (!data.price || data.price < 99) {
        return NextResponse.json(
          { error: 'Paid extensions must have a price of at least $0.99' },
          { status: 400, headers: corsHeaders(request) }
        );
      }

      const author = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { stripeConnectOnboarded: true },
      });

      if (!author?.stripeConnectOnboarded) {
        return NextResponse.json(
          { error: 'You must complete Stripe Connect onboarding before publishing paid extensions' },
          { status: 400, headers: corsHeaders(request) }
        );
      }
    }

    // Compute checksum
    const arrayBuffer = await file.arrayBuffer();
    const checksum = await computeChecksum(arrayBuffer);

    // LOW-21: Wrap uniqueness check + create in a transaction to prevent slug race conditions
    const extension = await prisma.$transaction(async (tx) => {
      // Check for duplicate inside transaction to prevent race conditions
      const existing = await tx.extension.findFirst({
        where: {
          OR: [{ name: data.name }, { slug }],
        },
      });

      if (existing) {
        // If same author, treat as version update
        if (existing.authorId === session.user.id) {
          const { url, downloadUrl } = await uploadExtensionFile(file, existing.id, data.version, slug);

          await tx.extension.update({
            where: { id: existing.id },
            data: {
              displayName: data.displayName,
              description: data.description,
              longDescription: data.longDescription || existing.longDescription,
              version: data.version,
              downloadUrl,
              fileSize: file.size,
              checksum,
            },
          });

          // Mark old versions as not latest
          await tx.extensionVersion.updateMany({
            where: { extensionId: existing.id },
            data: { isLatest: false },
          });

          await tx.extensionVersion.create({
            data: {
              extensionId: existing.id,
              version: data.version,
              downloadUrl,
              blobUrl: url,
              fileSize: file.size,
              checksum,
              isLatest: true,
              changeLog: (formData.get('changeLog') || 'Version update').toString(),
            },
          });

          return existing;
        }

        throw new Error('DUPLICATE_EXTENSION');
      }

      const ext = await tx.extension.create({
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
          fileSize: file.size,
          checksum,
          status: 'PENDING',
          isPublished: false,
          authorId: session.user.id,
          categories: {
            create: data.categories.map((catSlug: string) => ({
              category: { connect: { slug: catSlug } },
            })),
          },
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
      });

      // Upload to Vercel Blob
      const { url, downloadUrl } = await uploadExtensionFile(file, ext.id, data.version, slug);

      // Update extension with download URLs
      await tx.extension.update({
        where: { id: ext.id },
        data: { downloadUrl },
      });

      // Create version record
      await tx.extensionVersion.create({
        data: {
          extensionId: ext.id,
          version: data.version,
          downloadUrl,
          blobUrl: url,
          fileSize: file.size,
          checksum,
          isLatest: true,
        },
      });

      return ext;
    });

    const result = await prisma.extension.findUnique({
      where: { id: extension.id },
      include: {
        author: { select: { id: true, name: true, username: true, image: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
        versions: true,
      },
    });

    return NextResponse.json(result, { status: 201, headers: corsHeaders(request) });
  } catch (error) {
    // LOW-21: Handle duplicate extension error from transactional uniqueness check
    if (error instanceof Error && error.message === 'DUPLICATE_EXTENSION') {
      return NextResponse.json(
        { error: 'An extension with this name already exists' },
        { status: 409, headers: corsHeaders(request) }
      );
    }

    console.error('POST /api/extensions/publish error:', error);
    return NextResponse.json(
      { error: 'Failed to publish extension' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
