import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import {
  COMPLAINT_CATEGORY,
  COMPLAINT_URGENCY,
  ComplaintCategory,
  ComplaintUrgency,
  checkSafetyEscalation,
} from '@nivasa/shared';

export const aiRouter = Router();

aiRouter.use(authMiddleware);

aiRouter.post('/classify-complaint', (req: Request, res: Response) => {
  const { title = '', description = '' } = req.body;

  // 1. Mandatory Deterministic Safety Escalation Rule (Overrides AI)
  const safety = checkSafetyEscalation(title, description);

  // 2. Fallback heuristic classifier
  let category: ComplaintCategory = COMPLAINT_CATEGORY.OTHER;
  let urgency: ComplaintUrgency = COMPLAINT_URGENCY.NORMAL;
  let confidence = 0.85;

  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('water') || text.includes('leak') || text.includes('pipe') || text.includes('drain')) {
    category = COMPLAINT_CATEGORY.PLUMBING;
  } else if (text.includes('power') || text.includes('electric') || text.includes('light') || text.includes('switch')) {
    category = COMPLAINT_CATEGORY.ELECTRICAL;
  } else if (text.includes('lift') || text.includes('elevator')) {
    category = COMPLAINT_CATEGORY.LIFT;
  } else if (text.includes('guard') || text.includes('gate') || text.includes('theft') || text.includes('trespass')) {
    category = COMPLAINT_CATEGORY.SECURITY;
  } else if (text.includes('clean') || text.includes('garbage') || text.includes('sweep')) {
    category = COMPLAINT_CATEGORY.CLEANING;
  }

  // Enforce safety override
  if (safety.isSafetyEscalation) {
    urgency = COMPLAINT_URGENCY.CRITICAL;
    confidence = 1.0;
  }

  res.status(200).json({
    category,
    urgency,
    confidence,
    isSafetyEscalation: safety.isSafetyEscalation,
    matchedSafetyTerms: safety.matchedTerms,
    explanation: safety.isSafetyEscalation
      ? `Safety rule triggered due to [${safety.matchedTerms.join(', ')}]. Urgency forced to CRITICAL.`
      : `Heuristic classification matched category ${category} based on keywords.`,
    isAiFallback: true,
  });
});
