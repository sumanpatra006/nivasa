import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { flatAccessMiddleware } from '../../middleware/flatAccess.middleware.js';
import { getLedgerEntries, calculateClosingBalancePaise } from './ledgerStore.js';

export const ledgerRouter = Router();

ledgerRouter.use(authMiddleware);

ledgerRouter.get('/:flatId', flatAccessMiddleware, (req: Request, res: Response) => {
  const flatId = Array.isArray(req.params.flatId) ? req.params.flatId[0] : req.params.flatId;
  const entries = getLedgerEntries(flatId);
  const closingBalancePaise = calculateClosingBalancePaise(entries);

  res.status(200).json({
    flatId,
    closingBalancePaise,
    entries,
  });
});
