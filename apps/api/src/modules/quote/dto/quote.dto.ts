import { QuoteStatus } from '@logix/shared';

export interface CreateQuoteDto {
  matchGroupId: string;
  oceanFreight: number | string;
  handlingFee: number | string;
  documentationFee: number | string;
  surcharges: number | string;
  vatRateBps?: number;
  transitDays: number;
  validUntil: string;
  notes?: string;
}

export interface QuoteQueryDto {
  matchGroupId?: string;
  status?: QuoteStatus;
}
