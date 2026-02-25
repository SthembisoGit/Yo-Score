export class DomainError extends Error {
  public readonly code: string;

  public readonly httpStatus: number;

  public readonly internalMessage: string;

  constructor(code: string, message: string, httpStatus: number, internalMessage?: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.internalMessage = internalMessage || message;
  }
}

export const isDomainError = (error: unknown): error is DomainError =>
  error instanceof DomainError;
