export interface Extension {
  id: string;
  name: string;
  slug: string;
  displayName: string;
  description: string;
  longDescription: string | null;
  version: string;
  minimumXplorerVersion: string;
  icon: string | null;
  screenshots: string | null;
  downloadCount: number;
  averageRating: number;
  reviewCount: number;
  fileSize: number;
  checksum: string;
  downloadUrl: string;
  status: string;
  isPublished: boolean;
  isFeatured: boolean;
  pricingType: 'FREE' | 'PAID';
  price: number | null;
  currency: string;
  licenseType: string;
  repositoryUrl: string | null;
  homepageUrl: string | null;
  bugReportUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  author: {
    id: string;
    username: string | null;
    name: string | null;
    image: string | null;
  };
  categories: Array<{ id: string; name: string; slug: string }>;
  tags: Array<{ id: string; name: string; slug: string }>;
}

export interface ExtensionVersion {
  id: string;
  version: string;
  changeLog: string | null;
  downloadUrl: string;
  blobUrl: string | null;
  fileSize: number;
  checksum: string;
  isLatest: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string | null;
    name: string | null;
    image: string | null;
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
}
