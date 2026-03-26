import { z } from 'zod';

/**
 * Validation schema for publishing/updating an extension.
 */
export const publishExtensionSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(64, 'Name must be at most 64 characters')
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens only'),
  displayName: z
    .string()
    .min(3, 'Display name must be at least 3 characters')
    .max(128, 'Display name must be at most 128 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be at most 500 characters'),
  longDescription: z
    .string()
    .max(10000, 'Long description must be at most 10000 characters')
    .optional(),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver (e.g., 1.0.0)'),
  minimumXplorerVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Minimum version must follow semver')
    .default('0.1.0'),
  licenseType: z.string().default('MIT'),
  repositoryUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  homepageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  bugReportUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  categories: z.array(z.string()).min(1, 'Select at least one category').max(3, 'Maximum 3 categories'),
  tags: z.array(z.string()).max(10, 'Maximum 10 tags').optional(),

  // Pricing fields
  pricingType: z.enum(['FREE', 'PAID']).default('FREE'),
  price: z
    .number()
    .int('Price must be a whole number (in cents)')
    .min(99, 'Minimum price is $0.99')
    .max(99999, 'Maximum price is $999.99')
    .optional(),
  currency: z.string().default('usd'),
}).refine(
  (data) => data.pricingType !== 'PAID' || (data.price !== undefined && data.price > 0),
  { message: 'Price is required for paid extensions', path: ['price'] }
);

export type PublishExtensionInput = z.infer<typeof publishExtensionSchema>;

/**
 * Validation schema for creating/updating a review.
 */
export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  title: z.string().max(128, 'Title must be at most 128 characters').optional(),
  content: z
    .string()
    .min(10, 'Review must be at least 10 characters')
    .max(5000, 'Review must be at most 5000 characters'),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/**
 * Validation schema for version changelog.
 */
export const versionSchema = z.object({
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver (e.g., 1.0.0)'),
  changeLog: z.string().max(5000, 'Changelog must be at most 5000 characters').optional(),
});

export type VersionInput = z.infer<typeof versionSchema>;

/**
 * Validation schema for admin extension updates.
 */
export const adminUpdateExtensionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'PENDING', 'ARCHIVED']).optional(),
  isFeatured: z.boolean().optional(),
});

/**
 * Validation schema for extension updates (by owner).
 */
export const updateExtensionSchema = z.object({
  displayName: z.string().min(3).max(128).optional(),
  description: z.string().min(10).max(500).optional(),
  longDescription: z.string().max(10000).optional(),
  icon: z.string().url().optional().or(z.literal('')),
  screenshots: z.string().optional(),
  licenseType: z.string().optional(),
  repositoryUrl: z.string().url().optional().or(z.literal('')),
  homepageUrl: z.string().url().optional().or(z.literal('')),
  bugReportUrl: z.string().url().optional().or(z.literal('')),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  pricingType: z.enum(['FREE', 'PAID']).optional(),
  price: z.number().int().min(99).max(99999).optional(),
  currency: z.string().optional(),
});

/**
 * Validation schema for check-updates requests.
 */
export const checkUpdatesSchema = z.object({
  extensions: z.array(
    z.object({
      id: z.string(),
      version: z.string(),
    })
  ),
});

/**
 * Validation schema for checkout.
 */
export const checkoutSchema = z.object({
  extensionId: z.string().optional(),
});

/**
 * Validation schema for donations.
 */
export const donateSchema = z.object({
  amount: z.number().int().min(100), // cents, minimum $1.00
  message: z.string().max(500).optional(),
});

/**
 * Validation schema for starting a trial.
 */
export const startTrialSchema = z.object({
  extensionId: z.string(),
});

/**
 * Aggregated schemas object for convenience.
 */
export const schemas = {
  publishExtension: publishExtensionSchema,
  updateExtension: updateExtensionSchema,
  review: reviewSchema,
  version: versionSchema,
  adminUpdateExtension: adminUpdateExtensionSchema,
  checkUpdates: checkUpdatesSchema,
  checkout: checkoutSchema,
  donate: donateSchema,
  startTrial: startTrialSchema,
};
