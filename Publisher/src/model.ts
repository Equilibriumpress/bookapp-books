export type PublicationProfile = "reflowable" | "fixed";

export interface PublicationBook {
  id: string;
  notionPageId: string;
  title: string;
  subtitle: string;
  author: string;
  language: string;
  version: number;
  theme: string;
  profile: PublicationProfile;
  coverMediaId?: string;
  pages: PublicationPage[];
  media: Record<string, PublicationMedia>;
  components: Record<string, PublicationComponent>;
}

export interface PublicationPage {
  id: string;
  notionPageId: string;
  name: string;
  order: number;
  template: string;
  eyebrow: string;
  deck: string;
  sectionId?: string;
  showInTOC: boolean;
  tocTitle?: string;
  tocSubtitle?: string;
  primaryMediaId?: string;
  mediaIds: string[];
  componentIds: string[];
  bodyHtml: string;
}

export interface PublicationComponent {
  id: string;
  notionPageId: string;
  type: string;
  slot: string;
  order: number;
  label: string;
  title: string;
  body: string;
  value: string;
  secondaryValue: string;
  listStyle: string;
  style: string;
  linkUrl?: string;
  linkLabel: string;
  pageIds: string[];
  mediaIds: string[];
}

export interface PublicationMedia {
  id: string;
  notionPageId: string;
  name: string;
  type: string;
  externalUrl?: string;
  sourceUrl?: string;
  permanentUrl?: string;
  geoJsonUrl?: string;
  previewMediaId?: string;
  galleryItemIds: string[];
  caption: string;
  altText: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  rightsVerified: boolean;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  pageId?: string;
  mediaId?: string;
}
