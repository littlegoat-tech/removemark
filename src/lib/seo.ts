type MetaTag = {
  charSet?: string;
  name?: string;
  content?: string;
  property?: string;
  title?: string;
};

type LinkTag = {
  rel: string;
  href: string;
  as?: string;
  type?: string;
  sizes?: string;
  media?: string;
};

type ScriptTag = {
  type?: string;
  children?: string;
  src?: string;
  defer?: boolean;
  async?: boolean;
};

export type HeadTags = {
  meta?: MetaTag[];
  links?: LinkTag[];
  scripts?: ScriptTag[];
};

export type BlogSeoPayload = {
  slug: string;
  title: string;
  excerpt?: string;
  tags?: string[];
  date?: string;
};

const SITE_URL = "https://littlegoat.com.br";
const SITE_NAME = "Watermark Remover";
const DEFAULT_TITLE = "Watermark Remover | Free AI-Powered Image Watermark Removal Tool";
const DEFAULT_DESCRIPTION =
  "Remove watermarks from images instantly using AI. 100% free, unlimited removals, private browser-based processing. No sign-up required.";
const DEFAULT_KEYWORDS = [
  "watermark remover",
  "remove watermark",
  "watermark removal tool",
  "AI watermark remover",
  "remove watermark from image",
  "online watermark remover",
  "free watermark remover",
  "watermark removal software",
  "image watermark removal",
  "photo watermark remover",
  "privacy watermark remover",
  "browser watermark remover",
];
const AUTHOR = "Little Goat";
const CONTACT_EMAIL = "contato@littlegoat.com.com.br";
const SOCIAL_PROFILES = [
  "https://github.com/littlegoat-tech",
  "https://www.linkedin.com/company/little-goat",
  "https://www.instagram.com/littlegoat.tech",
];

export const absoluteUrl = (path = "/") => {
  if (!path) return SITE_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return new URL(path, SITE_URL).toString();
};

const DEFAULT_IMAGE = absoluteUrl("/og-image.png");
const DEFAULT_LOGO = absoluteUrl("/favicon-32x32.png");

export const siteMetadata = {
  siteName: SITE_NAME,
  baseUrl: SITE_URL,
  defaultTitle: DEFAULT_TITLE,
  defaultDescription: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  author: AUTHOR,
  email: CONTACT_EMAIL,
  socialProfiles: SOCIAL_PROFILES,
  defaultOgImage: DEFAULT_IMAGE,
};

const defaultJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  image: DEFAULT_IMAGE,
  url: absoluteUrl("/"),
  description: DEFAULT_DESCRIPTION,
  applicationCategory: "ImageEditingApplication",
  operatingSystem: "Web Browser",
  offers: {
    "@type": "Offer",
    name: "Watermark Remover - Free Access",
    description: "AI-powered watermark removal tool. 100% free with unlimited removals. No sign-up required.",
    price: "0",
    priceCurrency: "USD",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5",
    reviewCount: "50",
  },
  featureList: [
    "AI-powered watermark removal",
    "Browser-based processing",
    "100% private",
    "Manual and auto detection",
    "High quality results",
    "Fast processing",
    "Completely free",
    "Unlimited removals",
  ],
};

export function getRootSeo(): HeadTags {
  const canonical = absoluteUrl("/");
  const meta: MetaTag[] = [
    { charSet: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { title: DEFAULT_TITLE },
    { name: "description", content: DEFAULT_DESCRIPTION },
    { name: "keywords", content: DEFAULT_KEYWORDS.join(", ") },
    { name: "author", content: AUTHOR },
    { name: "robots", content: "index,follow" },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:url", content: canonical },
    { property: "og:title", content: DEFAULT_TITLE },
    {
      property: "og:description",
      content: DEFAULT_DESCRIPTION,
    },
    { property: "og:image", content: DEFAULT_IMAGE },
    { name: "twitter:card", content: "summary_large_image" },
    { property: "twitter:url", content: canonical },
    { property: "twitter:title", content: DEFAULT_TITLE },
    {
      property: "twitter:description",
      content: DEFAULT_DESCRIPTION,
    },
    { property: "twitter:image", content: DEFAULT_IMAGE },
  ];

  const links: LinkTag[] = [
    { rel: "canonical", href: canonical },
    { rel: "icon", href: "/favicon.ico" },
    { rel: "icon", href: "/favicon-96x96.png", sizes: "96x96" },
    { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    { rel: "manifest", href: "/site.webmanifest" },
  ];

  const scripts: ScriptTag[] = [
    {
      type: "application/ld+json",
      children: JSON.stringify(defaultJsonLd),
    },
  ];

  return { meta, links, scripts };
}

const getIsoDate = (input?: string) => {
  if (!input) return undefined;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

export function getBlogPostSeo(post: BlogSeoPayload): HeadTags {
  const canonical = absoluteUrl(`/blog/${post.slug}`);
  const description = post.excerpt?.trim() || DEFAULT_DESCRIPTION;
  const keywords = post.tags && post.tags.length > 0 ? post.tags.join(", ") : DEFAULT_KEYWORDS.join(", ");
  const isoDate = getIsoDate(post.date);

  const meta: MetaTag[] = [
    { title: `${post.title} | Little Goat Blog` },
    { name: "description", content: description },
    { name: "author", content: AUTHOR },
    { name: "keywords", content: keywords },
    { property: "og:type", content: "article" },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:url", content: canonical },
    { property: "og:title", content: post.title },
    {
      property: "og:description",
      content: description,
    },
    { property: "og:image", content: DEFAULT_IMAGE },
    { property: "twitter:card", content: "summary_large_image" },
    { property: "twitter:url", content: canonical },
    { property: "twitter:title", content: post.title },
    {
      property: "twitter:description",
      content: description,
    },
    { property: "twitter:image", content: DEFAULT_IMAGE },
  ];

  if (isoDate) {
    meta.push(
      { property: "article:published_time", content: isoDate },
      { property: "article:modified_time", content: isoDate },
    );
  }

  (post.tags ?? []).forEach((tag) => {
    if (tag && tag.trim().length > 0) {
      meta.push({ property: "article:tag", content: tag });
    }
  });

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    headline: post.title,
    description,
    image: DEFAULT_IMAGE,
    datePublished: isoDate,
    dateModified: isoDate,
    author: {
      "@type": "Person",
      name: AUTHOR,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: DEFAULT_LOGO,
      },
    },
    keywords: post.tags && post.tags.length > 0 ? post.tags.join(", ") : undefined,
  };

  const links: LinkTag[] = [{ rel: "canonical", href: canonical }];
  const scripts: ScriptTag[] = [
    {
      type: "application/ld+json",
      children: JSON.stringify(blogJsonLd),
    },
  ];

  return { meta, links, scripts };
}
