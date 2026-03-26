import { describe, it, expect } from 'vitest';
import { ZodError, z } from 'zod';
import {
    CqrsError,
    HandlerNotFoundError,
    ValidationError,
    NotFoundError,
    ConflictError,
    UnauthorizedError,
    ForbiddenError,
} from './errors';

// Helper to produce a real ZodError.
function makeZodError(): ZodError {
    const result = z.string().safeParse(42);
    if (result.success) throw new Error('Expected ZodError');
    return result.error;
}

describe('CqrsError', () => {
    it('is an instance of Error', () => {
        const err = new CqrsError('test');
        expect(err).toBeInstanceOf(Error);
    });

    it('sets name to the subclass constructor name', () => {
        class MyError extends CqrsError {}
        expect(new MyError('x').name).toBe('MyError');
    });
});

describe('HandlerNotFoundError', () => {
    it('is instanceof CqrsError and HandlerNotFoundError', () => {
        const err = new HandlerNotFoundError('query', 'myOp');
        expect(err).toBeInstanceOf(CqrsError);
        expect(err).toBeInstanceOf(HandlerNotFoundError);
    });

    it('has code HANDLER_NOT_FOUND', () => {
        expect(new HandlerNotFoundError('mutation', 'x').code).toBe('HANDLER_NOT_FOUND');
    });

    it('exposes kind and operationType', () => {
        const err = new HandlerNotFoundError('query', 'getTodos');
        expect(err.kind).toBe('query');
        expect(err.operationType).toBe('getTodos');
    });

    it('message includes kind and operationType', () => {
        const err = new HandlerNotFoundError('mutation', 'createTodo');
        expect(err.message).toBe('No handler for mutation type: createTodo');
    });
});

describe('ValidationError', () => {
    it('is instanceof CqrsError and ValidationError', () => {
        const err = new ValidationError('input', 'myOp', makeZodError());
        expect(err).toBeInstanceOf(CqrsError);
        expect(err).toBeInstanceOf(ValidationError);
    });

    it('has code VALIDATION_ERROR', () => {
        expect(new ValidationError('output', 'x', makeZodError()).code).toBe('VALIDATION_ERROR');
    });

    it('exposes phase, operationType, and zodError', () => {
        const zodError = makeZodError();
        const err = new ValidationError('output', 'getTodos', zodError);
        expect(err.phase).toBe('output');
        expect(err.operationType).toBe('getTodos');
        expect(err.zodError).toBe(zodError);
    });

    it('message describes phase and operation', () => {
        const err = new ValidationError('input', 'createTodo', makeZodError());
        expect(err.message).toBe('Validation failed for input of operation "createTodo"');
    });

    it('sets Error.cause to the ZodError', () => {
        const zodError = makeZodError();
        const err = new ValidationError('input', 'op', zodError);
        expect(err.cause).toBe(zodError);
    });
});

describe('NotFoundError', () => {
    it('is instanceof CqrsError', () => {
        expect(new NotFoundError('Todo', '1')).toBeInstanceOf(CqrsError);
    });

    it('has code NOT_FOUND', () => {
        expect(new NotFoundError('Todo', '1').code).toBe('NOT_FOUND');
    });

    it('exposes resource and id', () => {
        const err = new NotFoundError('Todo', 'abc');
        expect(err.resource).toBe('Todo');
        expect(err.id).toBe('abc');
    });

    it('message includes resource and id', () => {
        expect(new NotFoundError('User', '99').message).toBe("User with id '99' not found");
    });
});

describe('ConflictError', () => {
    it('is instanceof CqrsError', () => {
        expect(new ConflictError('Todo')).toBeInstanceOf(CqrsError);
    });

    it('has code CONFLICT', () => {
        expect(new ConflictError('Todo').code).toBe('CONFLICT');
    });

    it('message without detail', () => {
        expect(new ConflictError('User').message).toBe('Conflict on User');
    });

    it('message with detail', () => {
        expect(new ConflictError('User', 'email already taken').message)
            .toBe('Conflict on User: email already taken');
    });

    it('exposes resource and optional detail', () => {
        const err = new ConflictError('Todo', 'duplicate id');
        expect(err.resource).toBe('Todo');
        expect(err.detail).toBe('duplicate id');
        expect(new ConflictError('Todo').detail).toBeUndefined();
    });
});

describe('UnauthorizedError', () => {
    it('is instanceof CqrsError', () => {
        expect(new UnauthorizedError()).toBeInstanceOf(CqrsError);
    });

    it('has code UNAUTHORIZED', () => {
        expect(new UnauthorizedError().code).toBe('UNAUTHORIZED');
    });

    it('defaults to "Unauthorized" message', () => {
        expect(new UnauthorizedError().message).toBe('Unauthorized');
    });

    it('accepts optional detail', () => {
        expect(new UnauthorizedError('token expired').message).toBe('token expired');
    });
});

describe('ForbiddenError', () => {
    it('is instanceof CqrsError', () => {
        expect(new ForbiddenError()).toBeInstanceOf(CqrsError);
    });

    it('has code FORBIDDEN', () => {
        expect(new ForbiddenError().code).toBe('FORBIDDEN');
    });

    it('defaults to "Forbidden" message', () => {
        expect(new ForbiddenError().message).toBe('Forbidden');
    });

    it('accepts optional detail', () => {
        expect(new ForbiddenError('read-only resource').message).toBe('read-only resource');
    });
});
