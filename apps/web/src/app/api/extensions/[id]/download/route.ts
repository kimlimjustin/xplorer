import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { corsHeaders, handleCors } from '@/lib/cors';
import { PLANS } from '@/lib/stripe';
import { downloadLimiter, getClientIp } from '@/lib/rate-limit';
import { head } from '@vercel/blob';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * HIGH-W05: Generate a dedup identifier for download tracking.
 * Uses the authenticated user ID when available (not spoofable).
 * For anonymous users, uses a SHA-256 hash of IP + user-agent to make spoofing harder.
 */
function getDownloadIdentifier(
  session: { user?: { id: string } } | null,
  request: NextRequest
): string {
  if (session?.user?.id) {
    return session.user.id;
  }
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || '';
  return createHash('sha256').update(`${ip}:${userAgent}`).digest('hex');
}

/**
 * GET /api/extensions/[id]/download — Download an extension
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    // CRIT-08: Rate limit — 60 requests per minute per IP
    const clientIp = getClientIp(request);
    try {
      await downloadLimiter.check(60, clientIp);
    } catch {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: corsHeaders(request) }
      );
    }

    const { id } = await context.params;

    // Support lookup by both CUID (id) and slug
    const isCuid = /^c[a-z0-9]{24,}$/.test(id);
    const extension = await prisma.extension.findFirst({
      where: isCuid ? { id } : { slug: id },
      select: {
        id: true,
        name: true,
        slug: true,
        version: true,
        downloadUrl: true,
        isPublished: true,
        status: true,
        pricingType: true,
        authorId: true,
      },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    if (!extension.isPublished || extension.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Extension is not available for download' },
        { status: 403, headers: corsHeaders(request) }
      );
    }

    let session: Awaited<ReturnType<typeof auth>> = null;
    try {
      session = await auth();
    } catch {
      // Auth may not be configured in local dev — proceed without session
    }

    // CRIT-07: For paid extensions, require authentication.
    // Unauthenticated users must not bypass the payment check.
    if (extension.pricingType === 'PAID' && !session?.user) {
      return NextResponse.json(
        { error: 'Authentication required to download paid extensions' },
        { status: 401, headers: corsHeaders(request) }
      );
    }

    // Check subscription tier limits and paid extension access for authenticated users
    if (session?.user) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { subscriptionTier: true },
      });

      if (user?.subscriptionTier === 'FREE') {
        // Count user's existing downloads (unique extensions)
        const downloadCount = await prisma.download.groupBy({
          by: ['extensionId'],
          where: {
            ip: session.user.id, // We store userId in ip field for authenticated users
          },
        });

        if (downloadCount.length >= PLANS.FREE.maxExtensions) {
          // Check for active trial
          const activeTrial = await prisma.trial.findFirst({
            where: {
              userId: session.user.id,
              extensionId: id,
              expiresAt: { gt: new Date() },
              isExpired: false,
            },
          });

          if (!activeTrial) {
            return NextResponse.json(
              {
                error: 'Free tier extension limit reached',
                message: `You have reached the maximum of ${PLANS.FREE.maxExtensions} extensions on the Free tier. Upgrade to Pro for unlimited extensions, or start a 30-minute trial.`,
                upgradeRequired: true,
                trialAvailable: true,
              },
              { status: 403, headers: corsHeaders(request) }
            );
          }
        }
      }

      // For paid extensions, check if user has purchased it
      if (extension.pricingType === 'PAID' && extension.authorId !== session.user.id) {
        const purchase = await prisma.purchase.findUnique({
          where: {
            userId_extensionId: {
              userId: session.user.id,
              extensionId: id,
            },
          },
        });

        if (!purchase) {
          // Check for active trial
          const activeTrial = await prisma.trial.findFirst({
            where: {
              userId: session.user.id,
              extensionId: id,
              expiresAt: { gt: new Date() },
              isExpired: false,
            },
          });

          if (!activeTrial) {
            return NextResponse.json(
              {
                error: 'Purchase required',
                message: 'You must purchase this extension before downloading.',
                purchaseRequired: true,
              },
              { status: 403, headers: corsHeaders(request) }
            );
          }
        }
      }
    }

    // HIGH-W05: Deduplicate download count using authenticated user ID or hashed IP+UA
    const dedupId = getDownloadIdentifier(session, request);

    const recentDownload = await prisma.download.findFirst({
      where: {
        extensionId: extension.id,
        ip: dedupId,
        createdAt: { gte: new Date(Date.now() - 3600000) },
      },
    });

    if (!recentDownload) {
      // Record download only if no recent download from same user/identity
      await prisma.download.create({
        data: {
          extensionId: extension.id,
          ip: dedupId,
          userAgent: request.headers.get('user-agent') || null,
        },
      });

      // Increment download count
      await prisma.extension.update({
        where: { id: extension.id },
        data: { downloadCount: { increment: 1 } },
      });
    }

    // Local dev: zip and serve extension from the filesystem
    if (!extension.downloadUrl || extension.downloadUrl.startsWith('local://')) {
      const { existsSync, readdirSync, readFileSync, statSync } = await import('fs');
      const { join, resolve, relative } = await import('path');
      const { default: JSZip } = await import('jszip');

      // Look for extension in both public and private directories
      const extRoots = [
        resolve(process.cwd(), '..', '..', 'packages', 'extensions'),
        resolve(process.cwd(), '..', 'extensions'),
      ];
      const candidates = [
        extension.slug,
        `${extension.slug}-extension`,
        extension.slug.replace('xplorer-', ''),
        extension.slug.replace('-extension', ''),
        extension.slug.replace('xplorer-', '').replace('-theme', '-theme'),
        extension.slug.replace('xplorer-', '').replace('-extension', ''),
        extension.slug.replace('-dialog', '-extension'),
      ];

      let extDir: string | null = null;
      for (const extRoot of extRoots) {
        for (const candidate of candidates) {
          const dirPath = join(extRoot, candidate);
          if (existsSync(join(dirPath, 'package.json'))) {
            extDir = dirPath;
            break;
          }
        }
        if (extDir) break;
      }

      if (!extDir) {
        return NextResponse.json(
          { error: 'Extension not found locally', slug: extension.slug },
          { status: 404, headers: corsHeaders(request) }
        );
      }

      // Create a zip of the extension directory (package.json + dist/)
      const zip = new JSZip();
      const addDir = (dirPath: string, zipFolder: JSZip) => {
        for (const entry of readdirSync(dirPath)) {
          if (entry === 'node_modules' || entry === '.git') continue;
          const fullPath = join(dirPath, entry);
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            addDir(fullPath, zipFolder.folder(entry)!);
          } else {
            zipFolder.file(entry, readFileSync(fullPath));
          }
        }
      };
      addDir(extDir, zip);

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const headers = new Headers(corsHeaders(request));
      headers.set('Content-Type', 'application/zip');
      headers.set('Content-Disposition', `attachment; filename="${extension.slug}.zip"`);
      headers.set('Content-Length', String(zipBuffer.length));
      return new NextResponse(zipBuffer, { headers });
    }

    // CRIT-W02: For paid extensions, proxy the blob content through this API route
    // instead of redirecting to the raw URL (which is private and inaccessible directly).
    if (extension.pricingType === 'PAID') {
      try {
        const blobResponse = await fetch(extension.downloadUrl, {
          headers: {
            Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
          },
        });

        if (!blobResponse.ok) {
          return NextResponse.json(
            { error: 'Failed to retrieve extension file' },
            { status: 502, headers: corsHeaders(request) }
          );
        }

        const headers = new Headers(corsHeaders(request));
        headers.set('Content-Type', 'application/zip');
        headers.set(
          'Content-Disposition',
          `attachment; filename="${extension.slug}-${extension.version}.zip"`
        );
        const contentLength = blobResponse.headers.get('content-length');
        if (contentLength) {
          headers.set('Content-Length', contentLength);
        }

        return new NextResponse(blobResponse.body, { headers });
      } catch (err) {
        console.error('Failed to proxy paid extension download:', err);
        return NextResponse.json(
          { error: 'Failed to retrieve extension file' },
          { status: 502, headers: corsHeaders(request) }
        );
      }
    }

    // Free extensions: redirect to the public blob URL
    return NextResponse.redirect(extension.downloadUrl, {
      headers: corsHeaders(request),
    });
  } catch (error) {
    console.error('GET /api/extensions/[id]/download error:', error);
    return NextResponse.json(
      { error: 'Failed to download extension' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}

/**
 * POST /api/extensions/[id]/download — Track a download (analytics only)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const corsResponse = handleCors(request);
  if (corsResponse) return corsResponse;

  try {
    const { id } = await context.params;

    const isCuidPost = /^c[a-z0-9]{24,}$/.test(id);
    const extension = await prisma.extension.findFirst({
      where: isCuidPost ? { id } : { slug: id },
      select: { id: true },
    });

    if (!extension) {
      return NextResponse.json(
        { error: 'Extension not found' },
        { status: 404, headers: corsHeaders(request) }
      );
    }

    let session: Awaited<ReturnType<typeof auth>> = null;
    try {
      session = await auth();
    } catch {
      // Auth may not be configured in local dev
    }
    // HIGH-W05: Use authenticated user ID or hashed IP+UA for dedup
    const dedupId = getDownloadIdentifier(session, request);

    // Rate limit: deduplicate downloads from the same user/identity within the last hour
    const recentDownload = await prisma.download.findFirst({
      where: {
        extensionId: extension.id,
        ip: dedupId,
        createdAt: { gte: new Date(Date.now() - 3600000) },
      },
    });

    if (recentDownload) {
      return NextResponse.json(
        { ok: true },
        { headers: corsHeaders(request) }
      );
    }

    await prisma.download.create({
      data: {
        extensionId: extension.id,
        ip: dedupId,
        userAgent: request.headers.get('user-agent') || null,
      },
    });

    await prisma.extension.update({
      where: { id: extension.id },
      data: { downloadCount: { increment: 1 } },
    });

    return NextResponse.json(
      { message: 'Download tracked' },
      { headers: corsHeaders(request) }
    );
  } catch (error) {
    console.error('POST /api/extensions/[id]/download error:', error);
    return NextResponse.json(
      { error: 'Failed to track download' },
      { status: 500, headers: corsHeaders(request) }
    );
  }
}
