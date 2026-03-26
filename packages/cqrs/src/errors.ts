import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

/** Root class for all errors thrown by the cqrs library. */
export class CqrsError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = this.constructor.name;
    }
}

// ---------------------------------------------------------------------------
// Infrastructure errors — thrown by the library itself
// ---------------------------------------------------------------------------

/**
 * Thrown when `executeQuery` or `executeMutation` is called for a type that
 * has no registered handler.
 */
export class HandlerNotFoundError extends CqrsError {
    readonly code = 'HANDLER_NOT_FOUND' as const;

    constructor(
        readonly kind: 'query' | 'mutation',
        readonly operationType: string,
    ) {
        super(`No handler for ${kind} type: ${operationType}`);
    }
}

/**
 * Thrown when input or output fails Zod schema validation.
 * `phase` distinguishes caller mistakes (input) from handler bugs (output).
 */
export class ValidationError extends CqrsError {
    readonly code = 'VALIDATION_ERROR' as const;
    /** The raw Zod error with field-level details. */
    readonly zodError: ZodError;

    constructor(
        readonly phase: 'input' | 'output',
        readonly operationType: string,
        zodError: ZodError,
    ) {
        super(`Validation failed for ${phase} of operation "${operationType}"`, { cause: zodError });
        this.zodError = zodError;
    }
}

// ---------------------------------------------------------------------------
// Domain errors — intended to be thrown by handler implementations
// ---------------------------------------------------------------------------

/** The requested resource does not exist. */
export class NotFoundError extends CqrsError {
    readonly code = 'NOT_FOUND' as const;

    constructor(
        readonly resource: string,
        readonly id: string,
    ) {
        super(`${resource} with id '${id}' not found`);
    }
}

/** The operation would create a duplicate or violate a uniqueness constraint. */
export class ConflictError extends CqrsError {
    readonly code = 'CONFLICT' as const;

    constructor(
        readonly resource: string,
        readonly detail?: string,
    ) {
        super(detail ? `Conflict on ${resource}: ${detail}` : `Conflict on ${resource}`);
    }
}

/** The caller is not authenticated. */
export class UnauthorizedError extends CqrsError {
    readonly code = 'UNAUTHORIZED' as const;

    constructor(detail?: string) {
        super(detail ?? 'Unauthorized');
    }
}

/** The caller is authenticated but does not have permission for this operation. */
export class ForbiddenError extends CqrsError {
    readonly code = 'FORBIDDEN' as const;

    constructor(detail?: string) {
        super(detail ?? 'Forbidden');
    }
}
