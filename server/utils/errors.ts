export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public data?: unknown) { super(message) }
}
export const fail = (status: number, message: string, code?: string, data?: unknown): never => { throw new HttpError(status, message, code, data) }
