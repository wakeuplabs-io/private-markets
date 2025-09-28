/**
 * @fileoverview DTO for GetMarket API response
 * Defines the structure of the market data returned by the API
 *
 * @module application/dto/GetMarketResponse
 */

import { z } from 'zod';

/**
 * Zod schema for market response validation
 */
export const GetMarketResponseSchema = z.object({
  id: z.number().int().positive(),
  question: z.string().min(1),
  admin: z.string().min(1),
  status: z.enum(['active', 'resolved', 'cancelled']),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
  winningOutcome: z.boolean().optional(),
  ageInDays: z.number().int().min(0),
});

/**
 * TypeScript type for market response
 */
export type GetMarketResponse = z.infer<typeof GetMarketResponseSchema>;

/**
 * Factory function to create GetMarketResponse from domain entity
 */
export function createGetMarketResponse(market: {
  id: number;
  question: string;
  admin: string;
  status: string;
  createdAt: Date;
  resolvedAt?: Date;
  winningOutcome?: boolean;
  getAgeInDays(): number;
}): GetMarketResponse {
  return {
    id: market.id,
    question: market.question,
    admin: market.admin,
    status: market.status as 'active' | 'resolved' | 'cancelled',
    createdAt: market.createdAt.toISOString(),
    resolvedAt: market.resolvedAt?.toISOString(),
    winningOutcome: market.winningOutcome,
    ageInDays: market.getAgeInDays(),
  };
}