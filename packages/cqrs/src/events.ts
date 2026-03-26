import { z } from "zod";
import { injectable } from "inversify";
import type { Newable } from "inversify";

// ---------------------------------------------------------------------------
// Event definition
// ---------------------------------------------------------------------------

export interface EventDefinition<TType extends string, TPayload> {
    readonly type: TType;
    readonly schema: z.ZodType<TPayload>;
    /** Creates a typed event envelope ready to pass to EventBus.publish(). */
    make(payload: TPayload): DomainEvent<TType, TPayload>;
}

export type ExtractEventPayload<T> =
    T extends EventDefinition<string, infer P> ? P : never;

export function createEvent<TType extends string, TPayload>(
    type: TType,
    schema: z.ZodType<TPayload>,
): EventDefinition<TType, TPayload> {
    return {
        type,
        schema,
        make: (payload) => ({ type, payload }),
    };
}

// ---------------------------------------------------------------------------
// Event envelope
// ---------------------------------------------------------------------------

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
    readonly type: TType;
    readonly payload: TPayload;
}

// ---------------------------------------------------------------------------
// Event handler base class
// ---------------------------------------------------------------------------

export interface EventHandlerInstance {
    readonly definition: EventDefinition<string, unknown>;
    handle(payload: unknown): Promise<void>;
}

export type EventHandlerClass = Newable<EventHandlerInstance>;

export function createEventHandler<TType extends string, TPayload>(
    definition: EventDefinition<TType, TPayload>,
) {
    @injectable()
    abstract class Handler {
        readonly definition = definition as EventDefinition<string, unknown>;
        abstract handle(payload: TPayload): Promise<void>;
    }
    return Handler;
}

// ---------------------------------------------------------------------------
// EventBus — injected into handlers via DI
// ---------------------------------------------------------------------------

/** DI token for the EventBus. Use @inject(EventBusToken) in handlers. */
export const EventBusToken = Symbol('EventBus');

export interface EventBus {
    publish(event: DomainEvent): Promise<void>;
}
