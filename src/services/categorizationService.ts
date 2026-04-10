/**
 * Categorization Service
 *
 * Classifies documents into categories using:
 * 1. Rule-based logic (keyword matching, file type heuristics)
 * 2. AI/LLM-assisted classification (scaffold for future integration)
 *
 * Categories and rules are designed to be easily extensible.
 */

import type {
  ArchiveDocument,
  ClassificationResult,
  DocumentCategory,
  FinancialCategory,
  FinancialDocumentType,
} from "@/types/document";

/**
 * Keyword-to-category mapping for rule-based classification.
 * Add new categories and keywords here to extend the system.
 */
const CATEGORY_RULES: Array<{
  category: DocumentCategory;
  keywords: string[];
  weight: number;
}> = [
  {
    category: "Meeting Minutes",
    keywords: ["minutes", "meeting", "agenda", "attendees", "motion", "quorum", "adjourned"],
    weight: 1.0,
  },
  {
    category: "Financial Documents",
    keywords: [
      "budget", "financial", "revenue", "expense", "audit", "fiscal", "accounting",
      "invoice", "grant", "deposit", "deposit summary", "pledge", "sponsorship",
      "matching gift", "workplace giving", "payroll deduction", "frontstream",
      "adp", "corporate giving", "auction", "check number", "check no",
      "amount due", "balance due", "payment received", "total received",
      "bank", "account number", "routing", "transfer", "paypal",
      "annual fund", "end of year", "eoya", "board contribution",
    ],
    weight: 1.0,
  },
  {
    category: "Applications/Forms",
    keywords: [
      "application", "form", "submit", "applicant", "registration", "enrollment",
      "pledge form", "pledge card", "credit card authorization", "authorization form",
      "sponsorship form", "bid form", "auction form",
    ],
    weight: 1.0,
  },
  {
    category: "Legal Documents",
    keywords: ["legal", "court", "lawsuit", "plaintiff", "defendant", "statute", "ordinance", "compliance", "predatory lending"],
    weight: 1.0,
  },
  {
    category: "Reports",
    keywords: ["report", "findings", "analysis", "assessment", "evaluation", "survey results"],
    weight: 0.8,
  },
  {
    category: "Correspondence",
    keywords: [
      "letter", "memo", "correspondence", "dear", "sincerely", "regarding", "re:",
      "acknowledgment", "acknowledgement", "thank you", "thank-you", "grateful",
      "on behalf of", "your gift", "your contribution", "your donation",
      "tax deductible", "tax-deductible", "charitable contribution",
      "humanitarian tribute", "tribute dinner", "community ally",
      "end of year appeal", "eoya", "nonprofit", "501(c)(3)",
    ],
    weight: 0.9,
  },
  {
    category: "Outreach Materials",
    keywords: ["outreach", "flyer", "brochure", "newsletter", "campaign", "awareness", "community event"],
    weight: 0.9,
  },
  {
    category: "Policies/Procedures",
    keywords: ["policy", "procedure", "guideline", "regulation", "standard", "protocol", "charter", "mission"],
    weight: 1.0,
  },
  {
    category: "Historical Records",
    keywords: ["historical", "archive", "founding", "legacy", "anniversary", "milestone"],
    weight: 0.8,
  },
  {
    category: "Research",
    keywords: ["research", "study", "data", "methodology", "hypothesis", "findings", "conclusion", "analysis", "disparities"],
    weight: 0.9,
  },
  {
    category: "Community Report",
    keywords: ["community", "neighborhood", "residents", "voices", "impact", "grassroots"],
    weight: 0.8,
  },
  {
    category: "Youth Initiative",
    keywords: ["youth", "student", "young", "leadership", "mentoring", "college readiness"],
    weight: 0.9,
  },
  {
    category: "Housing",
    keywords: ["housing", "segregation", "fair housing", "residential", "redlining", "homeownership"],
    weight: 0.9,
  },
  {
    category: "Education",
    keywords: ["education", "school", "k-12", "curriculum", "teacher", "student", "funding", "enrollment"],
    weight: 0.9,
  },
  {
    category: "Policy",
    keywords: ["policy", "testimony", "legislative", "reform", "enforcement", "recommendation", "equity"],
    weight: 0.8,
  },
];

/**
 * Tag generation keywords.
 * Maps common document themes to suggested tags.
 */
const TAG_RULES: Array<{ keywords: string[]; tag: string }> = [
  { keywords: ["detroit", "metro detroit", "michigan"], tag: "Detroit" },
  { keywords: ["michigan roundtable", "mrdi", "roundtable for diversity"], tag: "Michigan Roundtable" },
  { keywords: ["diversity", "inclusion", "dei"], tag: "diversity & inclusion" },
  { keywords: ["humanitarian tribute", "tribute dinner", "gala"], tag: "humanitarian tribute" },
  { keywords: ["golf classic", "golf tournament"], tag: "golf classic" },
  { keywords: ["racial", "race", "equity", "justice"], tag: "racial equity" },
  { keywords: ["housing", "home", "residential"], tag: "housing" },
  { keywords: ["education", "school", "student"], tag: "education" },
  { keywords: ["health", "medical", "pandemic", "covid"], tag: "health" },
  { keywords: ["water", "environmental", "flint"], tag: "environmental justice" },
  { keywords: ["youth", "young", "leadership"], tag: "youth" },
  { keywords: ["legal", "law", "court"], tag: "legal" },
  { keywords: ["community", "neighborhood", "grassroots"], tag: "community" },
  { keywords: ["funding", "budget", "grant", "financial"], tag: "funding" },
  { keywords: ["policy", "legislation", "reform"], tag: "policy" },
  { keywords: ["discrimination", "bias", "predatory"], tag: "discrimination" },
  { keywords: ["invoice", "receipt", "expense", "payment"], tag: "spending" },
  { keywords: ["payroll", "salary", "wages", "adp"], tag: "payroll" },
  { keywords: ["tax", "1099", "w2"], tag: "tax" },
  { keywords: ["audit", "auditing"], tag: "audit" },
  { keywords: ["reimbursement", "reimburse"], tag: "reimbursement" },
  { keywords: ["donation", "donor", "pledge", "tribute", "gift of", "your gift"], tag: "donation" },
  { keywords: ["matching gift", "corporate giving", "workplace giving", "frontstream"], tag: "matching gift" },
  { keywords: ["acknowledgment", "acknowledgement", "thank you", "thank-you"], tag: "acknowledgment letter" },
  { keywords: ["deposit", "deposit summary", "deposit slip"], tag: "deposit" },
  { keywords: ["auction", "bid", "silent auction"], tag: "auction" },
  { keywords: ["sponsorship", "sponsor"], tag: "sponsorship" },
  { keywords: ["paypal", "bank transfer", "electronic transfer"], tag: "electronic payment" },
  { keywords: ["annual fund", "end of year appeal", "eoya", "annual campaign"], tag: "annual fund" },
];

/**
 * Financial category detection keywords.
 */
const FINANCIAL_CATEGORY_RULES: Array<{
  category: FinancialCategory;
  keywords: string[];
}> = [
  {
    category: "Funding",
    keywords: [
      "funding", "grant", "award", "donation", "donor", "contribution",
      "revenue", "income", "fundraising", "endowment", "subsidy", "sponsorship", "stipend",
      "pledge", "tribute", "matching gift", "workplace giving", "frontstream",
      "corporate giving", "annual fund", "eoya", "end of year appeal",
      "board contribution", "humanitarian tribute", "gift of", "your gift",
      "deposit", "auction proceeds", "auction revenue",
    ],
  },
  {
    category: "Spending",
    keywords: [
      "spending", "expense", "expenses", "invoice", "receipt", "payment",
      "purchase", "cost", "disbursement", "expenditure", "paid", "payroll",
      "reimbursement", "procurement", "vendor", "adp", "payroll deduction",
      "amount due", "balance due", "total due",
    ],
  },
];

/**
 * Financial document type detection keywords.
 */
const FINANCIAL_TYPE_RULES: Array<{
  type: FinancialDocumentType;
  keywords: string[];
}> = [
  { type: "Grant", keywords: ["grant", "award"] },
  {
    type: "Donation",
    keywords: [
      "donation", "donor", "contribution", "pledge", "tribute", "gift of",
      "humanitarian tribute", "matching gift", "workplace giving", "frontstream",
      "corporate giving", "annual fund", "eoya", "end of year appeal",
      "board contribution", "community ally", "auction proceeds",
    ],
  },
  { type: "Invoice", keywords: ["invoice", "bill", "amount due", "balance due", "total due", "remit"] },
  { type: "Receipt", keywords: ["receipt", "acknowledgment", "acknowledgement", "thank you for your gift"] },
  { type: "Budget", keywords: ["budget", "budgetary"] },
  { type: "Expense Report", keywords: ["expense report", "expense_report"] },
  {
    type: "Bank Statement",
    keywords: [
      "bank statement", "bank_statement", "statement of account",
      "deposit summary", "deposit slip", "account balance", "paypal", "electronic transfer",
    ],
  },
  {
    type: "Payroll",
    keywords: ["payroll", "salary", "wages", "adp", "payroll deduction", "employee earnings", "pay stub"],
  },
  { type: "Tax Document", keywords: ["tax document", "tax_document", "1099", "w2", "w-2", "tax return"] },
  { type: "Reimbursement", keywords: ["reimbursement", "reimburse"] },
  { type: "Purchase Order", keywords: ["purchase order", "purchase_order"] },
  { type: "Financial Summary", keywords: ["financial summary", "financial_summary", "deposit summary", "total deposits"] },
  { type: "Audit", keywords: ["audit", "auditing"] },
];

/**
 * Rule-based document categorization.
 * Scores each category based on keyword matches and returns the best match.
 * Also detects financial category and document type.
 */
export function categorizeDocument(
  doc: ArchiveDocument,
  extractedText: string
): ClassificationResult {
  const textLower = [
    doc.title,
    doc.description,
    extractedText,
    ...doc.keywords,
    ...doc.tags,
  ]
    .join(" ")
    .toLowerCase();

  // Score each category
  const scores: Array<{ category: DocumentCategory; score: number }> = [];

  for (const rule of CATEGORY_RULES) {
    let matchCount = 0;
    for (const keyword of rule.keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      const score = (matchCount / rule.keywords.length) * rule.weight;
      scores.push({ category: rule.category, score });
    }
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Generate tags
  const suggestedTags: string[] = [];
  for (const rule of TAG_RULES) {
    for (const keyword of rule.keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        suggestedTags.push(rule.tag);
        break;
      }
    }
  }

  // Detect financial category
  let financialCategory: FinancialCategory | undefined =
    doc.financialCategory;
  if (!financialCategory) {
    let fundingScore = 0;
    let spendingScore = 0;
    for (const rule of FINANCIAL_CATEGORY_RULES) {
      for (const keyword of rule.keywords) {
        if (textLower.includes(keyword)) {
          if (rule.category === "Funding") fundingScore++;
          else spendingScore++;
        }
      }
    }
    if (fundingScore > 0 && fundingScore >= spendingScore) financialCategory = "Funding";
    else if (spendingScore > 0) financialCategory = "Spending";
  }

  // Detect financial document type
  let financialDocumentType: FinancialDocumentType | undefined =
    doc.financialDocumentType;
  if (!financialDocumentType) {
    for (const rule of FINANCIAL_TYPE_RULES) {
      for (const keyword of rule.keywords) {
        if (textLower.includes(keyword)) {
          financialDocumentType = rule.type;
          break;
        }
      }
      if (financialDocumentType) break;
    }
  }

  if (scores.length === 0) {
    return {
      category: "Uncategorized",
      confidence: 0,
      method: "rule_based",
      suggestedTags,
      financialCategory,
      financialDocumentType,
    };
  }

  const best = scores[0];
  return {
    category: best.category,
    confidence: Math.min(best.score, 1.0),
    method: "rule_based",
    suggestedTags,
    financialCategory,
    financialDocumentType,
  };
}

/**
 * Scaffold: AI-assisted classification.
 *
 * When an LLM API is available (OpenAI, Anthropic, etc.), this function
 * sends the document text to the API for classification.
 *
 * Integration point:
 * ```
 * const response = await fetch('/api/classify', {
 *   method: 'POST',
 *   body: JSON.stringify({ text: extractedText, categories: DOCUMENT_CATEGORIES }),
 * });
 * const result = await response.json();
 * return { category: result.category, confidence: result.confidence, method: 'ai_assisted', suggestedTags: result.tags };
 * ```
 */
export async function categorizeWithAI(
  _doc: ArchiveDocument,
  _extractedText: string
): Promise<ClassificationResult> {
  // TODO: Integrate with LLM API for AI classification
  throw new Error(
    "AI classification is not yet implemented. Use categorizeDocument() for rule-based classification."
  );
}

/**
 * Manual category override.
 * Allows staff to manually set the category and tags.
 */
export function manualCategorize(
  category: DocumentCategory,
  tags: string[]
): ClassificationResult {
  return {
    category,
    confidence: 1.0,
    method: "manual",
    suggestedTags: tags,
  };
}
