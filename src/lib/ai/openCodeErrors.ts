export type OpenCodeErrorCode = 'timeout' | 'cancelled' | 'unavailable' | 'rate_limit' | 'rejected' | 'incomplete';

export class OpenCodeError extends Error {
  constructor(public readonly code: OpenCodeErrorCode, message: string) {
    super(message);
    this.name = 'OpenCodeError';
  }
}
