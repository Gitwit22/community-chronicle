export interface Document {
  id: string;
  title: string;
  year: number;
  author: string;
  category: string;
  type: string;
  description: string;
  keywords: string[];
  fileUrl: string;
  createdAt: string;
  aiSummary: string;
}

export interface TimelineEvent {
  year: number;
  title: string;
  description: string;
  documentIds?: string[];
}

export const categories = [
  "Research",
  "Policy",
  "Community Report",
  "Youth Initiative",
  "Housing",
  "Education",
  "Legal",
] as const;

export const documentTypes = [
  "Report",
  "Brief",
  "Study",
  "Newsletter",
  "Testimony",
  "Presentation",
] as const;

// Empty — ready for real document uploads
export const mockDocuments: Document[] = [];

export const timelineEvents: TimelineEvent[] = [];
