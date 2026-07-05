# Error Handling

HTTP status codes and error codes must match `docs/design/api.md` §6 exactly. Don't invent new error codes or repurpose an existing code for a different meaning.

Map domain/validation errors to responses through a consistent mechanism (e.g. NestJS exception filters), not ad hoc try/catch blocks scattered through controllers.
