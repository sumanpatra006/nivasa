import { ComplaintCategory } from '@nivasa/shared';

export interface ComplaintDuplicateCandidate {
  id: string;
  title: string;
  description: string;
  category: ComplaintCategory;
  tower: string;
  flatNumber: string;
  status: string;
  createdAt: string;
}

export interface DuplicateSuggestionResult {
  candidateId: string;
  candidateTitle: string;
  candidateFlat: string;
  candidateStatus: string;
  confidence: number; // 0.00 - 1.00
  matchingFactors: string[];
}

/**
 * Tokenize and normalize text into word sets for Jaccard similarity comparison.
 */
function tokenize(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'our', 'are'].includes(w));
  return new Set(words);
}

/**
 * Calculate Jaccard similarity between two token sets.
 */
function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersectionCount = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionCount++;
    }
  }
  const unionSize = setA.size + setB.size - intersectionCount;
  return unionSize > 0 ? intersectionCount / unionSize : 0;
}

export interface DuplicateDetectorOptions {
  timeWindowHours?: number; // Default 72 hours
  minimumConfidenceThreshold?: number; // Default 0.45
}

/**
 * Deterministic multi-factor duplicate detection service.
 * Considers: Category, Tower, Complaint text token similarity, and Time window.
 * Returns suggested candidates without auto-closing or mutating any tickets.
 */
export function detectDuplicates(
  newTicket: {
    title: string;
    description: string;
    category: ComplaintCategory;
    tower: string;
    flatNumber: string;
    createdAt?: string;
  },
  existingTickets: ComplaintDuplicateCandidate[],
  options: DuplicateDetectorOptions = {}
): DuplicateSuggestionResult[] {
  const timeWindowHours = options.timeWindowHours || 72;
  const minConfidence = options.minimumConfidenceThreshold || 0.45;
  const newCreatedTime = newTicket.createdAt ? new Date(newTicket.createdAt).getTime() : Date.now();
  const newTokens = tokenize(`${newTicket.title} ${newTicket.description}`);

  const suggestions: DuplicateSuggestionResult[] = [];

  for (const candidate of existingTickets) {
    // 1. Time window check (only compare with tickets created within window)
    const candidateTime = new Date(candidate.createdAt).getTime();
    const hoursDiff = Math.abs(newCreatedTime - candidateTime) / (1000 * 60 * 60);
    if (hoursDiff > timeWindowHours) {
      continue;
    }

    // Skip closed or cancelled tickets older than 24 hours
    if (['CLOSED', 'CANCELLED'].includes(candidate.status) && hoursDiff > 24) {
      continue;
    }

    const candidateTokens = tokenize(`${candidate.title} ${candidate.description}`);
    const textSimilarity = calculateJaccardSimilarity(newTokens, candidateTokens);

    let confidence = 0;
    const matchingFactors: string[] = [];

    // Factor 1: Tower Match (Same Tower)
    const sameTower = candidate.tower && candidate.tower.toUpperCase() === newTicket.tower.toUpperCase();
    if (sameTower) {
      confidence += 0.25;
      matchingFactors.push(`Same Tower (${candidate.tower})`);
    }

    // Factor 2: Exact identical flat unit
    if (sameTower && candidate.flatNumber === newTicket.flatNumber) {
      confidence += 0.25;
      matchingFactors.push(`Same Residential Flat Unit (${candidate.tower}-${candidate.flatNumber})`);
    }

    // Factor 3: Category Match
    const sameCategory = candidate.category === newTicket.category;
    if (sameCategory) {
      confidence += 0.25;
      matchingFactors.push(`Same Category (${candidate.category})`);
    }

    // Factor 4: Text Similarity
    if (textSimilarity > 0.10) {
      const textScore = Math.min(0.50, textSimilarity * 0.75);
      confidence += textScore;
      matchingFactors.push(`Text Token Similarity (${Math.round(textSimilarity * 100)}%)`);
    }

    const finalConfidence = Math.min(0.99, Math.round(confidence * 100) / 100);

    if (finalConfidence >= minConfidence) {
      suggestions.push({
        candidateId: candidate.id,
        candidateTitle: candidate.title,
        candidateFlat: `Tower ${candidate.tower} - ${candidate.flatNumber}`,
        candidateStatus: candidate.status,
        confidence: finalConfidence,
        matchingFactors,
      });
    }
  }

  // Sort descending by confidence
  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions;
}
