import { HttpException, HttpStatus } from '@nestjs/common';

// Single consistent error shape across the whole API, per
// docs/design/api.md §2.5 and §6, and ai/rules/error-handling.md
// (don't invent new codes, don't scatter ad hoc error handling).
export class ApiError extends HttpException {
  constructor(status: HttpStatus, code: string, message: string) {
    super({ error: { code, message } }, status);
  }
}
