import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { injectable, inject } from 'inversify';
import { createEvent, createEventHandler, EventBusToken } from './events';
import type { EventBus, DomainEvent } from './events';
import { createApplication } from './application';
import { createMutation, createMutationHandler } from './mutation';
import { createQuery, createQueryHandler } from './query';
import type { ExtractMutationInput, ExtractMutationOutput } from './mutation';
import type { ExtractQueryInput, ExtractQueryOutput } from './query';

// ---- shared event definitions ----

const itemCreatedEvent = createEvent('itemCreated', z.object({ id: z.string(), name: z.string() }));
const itemDeletedEvent = createEvent('itemDeleted', z.object({ id: z.string() }));

// ---------------------------------------------------------------------------
// createEvent unit tests
// ---------------------------------------------------------------------------

describe('createEvent', () => {
    it('stores the type string', () => {
        expect(itemCreatedEvent.type).toBe('itemCreated');
    });

    it('stores the schema', () => {
        expect(itemCreatedEvent.schema).toBeDefined();
    });

    it('make() produces a typed event envelope', () => {
        const evt = itemCreatedEvent.make({ id: '1', name: 'thing' });
        expect(evt.type).toBe('itemCreated');
        expect(evt.payload).toEqual({ id: '1', name: 'thing' });
    });

    it('make() is constrained to the declared payload type', () => {
        // TypeScript would reject wrong payload at compile time; here we verify
        // the produced envelope has the exact payload passed.
        const evt = itemCreatedEvent.make({ id: 'abc', name: 'widget' });
        expect(evt).toEqual({ type: 'itemCreated', payload: { id: 'abc', name: 'widget' } });
    });
});

// ---------------------------------------------------------------------------
// createEventHandler unit tests
// ---------------------------------------------------------------------------

describe('createEventHandler', () => {
    it('attaches the definition to the handler instance', () => {
        @injectable()
        class Handler extends createEventHandler(itemCreatedEvent) {
            async handle() {}
        }
        const h = new Handler();
        expect(h.definition).toBe(itemCreatedEvent);
    });

    it('different handlers keep their own definitions', () => {
        @injectable()
        class H1 extends createEventHandler(itemCreatedEvent) {
            async handle() {}
        }
        @injectable()
        class H2 extends createEventHandler(itemDeletedEvent) {
            async handle() {}
        }
        expect(new H1().definition.type).toBe('itemCreated');
        expect(new H2().definition.type).toBe('itemDeleted');
    });
});

// ---------------------------------------------------------------------------
// Integration: event registration + publishing
// ---------------------------------------------------------------------------

describe('createApplication — event bus', () => {
    it('calls the event handler when its event type is published', async () => {
        const handle = vi.fn<(p: { id: string; name: string }) => Promise<void>>().mockResolvedValue(undefined);

        @injectable()
        class ItemCreatedHandler extends createEventHandler(itemCreatedEvent) {
            async handle(payload: { id: string; name: string }) { return handle(payload); }
        }

        const app = createApplication({ events: [ItemCreatedHandler] });

        // Reach the EventBus through a mutation handler that injects it.
        const doPublish = createMutation('doPublish', z.object({ id: z.string() }), z.void());
        @injectable()
        class DoPublishHandler extends createMutationHandler(doPublish) {
            constructor(@inject(EventBusToken) private bus: EventBus) { super(); }
            async execute(input: ExtractMutationInput<typeof doPublish>) {
                await this.bus.publish(itemCreatedEvent.make({ id: input.input.id, name: 'test' }));
            }
        }

        const fullApp = createApplication({
            events: [ItemCreatedHandler],
            mutations: [DoPublishHandler],
        });

        await fullApp.executeMutation('doPublish', { id: 'x' });
        expect(handle).toHaveBeenCalledOnce();
        expect(handle).toHaveBeenCalledWith({ id: 'x', name: 'test' });
    });

    it('calls multiple handlers registered for the same event type', async () => {
        const order: string[] = [];

        @injectable()
        class H1 extends createEventHandler(itemCreatedEvent) {
            async handle() { order.push('H1'); }
        }
        @injectable()
        class H2 extends createEventHandler(itemCreatedEvent) {
            async handle() { order.push('H2'); }
        }

        const doPublish = createMutation('doPublish2', z.void(), z.void());
        @injectable()
        class DoPublishHandler extends createMutationHandler(doPublish) {
            constructor(@inject(EventBusToken) private bus: EventBus) { super(); }
            async execute() {
                await this.bus.publish(itemCreatedEvent.make({ id: '1', name: 'x' }));
            }
        }

        const app = createApplication({
            events: [H1, H2],
            mutations: [DoPublishHandler],
        });

        await app.executeMutation('doPublish2', undefined);
        expect(order).toEqual(['H1', 'H2']);
    });

    it('calls handlers in registration order', async () => {
        const order: number[] = [];
        const makeHandler = (n: number) => {
            @injectable()
            class H extends createEventHandler(itemCreatedEvent) {
                async handle() { order.push(n); }
            }
            return H;
        };

        const doPublish = createMutation('doPublish3', z.void(), z.void());
        @injectable()
        class DoPublishHandler extends createMutationHandler(doPublish) {
            constructor(@inject(EventBusToken) private bus: EventBus) { super(); }
            async execute() {
                await this.bus.publish(itemCreatedEvent.make({ id: '1', name: 'x' }));
            }
        }

        const app = createApplication({
            events: [makeHandler(1), makeHandler(2), makeHandler(3)],
            mutations: [DoPublishHandler],
        });

        await app.executeMutation('doPublish3', undefined);
        expect(order).toEqual([1, 2, 3]);
    });

    it('publishing an event with no handlers silently succeeds', async () => {
        // No handlers registered for itemDeletedEvent
        const doPublish = createMutation('doPublish4', z.void(), z.void());
        @injectable()
        class DoPublishHandler extends createMutationHandler(doPublish) {
            constructor(@inject(EventBusToken) private bus: EventBus) { super(); }
            async execute() {
                await this.bus.publish(itemDeletedEvent.make({ id: '99' }));
            }
        }

        const app = createApplication({ mutations: [DoPublishHandler] });
        await expect(app.executeMutation('doPublish4', undefined)).resolves.not.toThrow();
    });

    it('event handler error propagates to the publisher', async () => {
        @injectable()
        class BoomHandler extends createEventHandler(itemCreatedEvent) {
            async handle() { throw new Error('event-handler-boom'); }
        }

        const doPublish = createMutation('doPublish5', z.void(), z.void());
        @injectable()
        class DoPublishHandler extends createMutationHandler(doPublish) {
            constructor(@inject(EventBusToken) private bus: EventBus) { super(); }
            async execute() {
                await this.bus.publish(itemCreatedEvent.make({ id: '1', name: 'x' }));
            }
        }

        const app = createApplication({
            events: [BoomHandler],
            mutations: [DoPublishHandler],
        });

        await expect(app.executeMutation('doPublish5', undefined)).rejects.toThrow('event-handler-boom');
    });

    it('query handlers can also inject and use the EventBus', async () => {
        const published: DomainEvent[] = [];

        @injectable()
        class Spy extends createEventHandler(itemCreatedEvent) {
            async handle(payload: unknown) { published.push({ type: 'itemCreated', payload }); }
        }

        const doQuery = createQuery('doQuery', z.void(), z.void());
        @injectable()
        class DoQueryHandler extends createQueryHandler(doQuery) {
            constructor(@inject(EventBusToken) private bus: EventBus) { super(); }
            async execute(_input: ExtractQueryInput<typeof doQuery>): Promise<ExtractQueryOutput<typeof doQuery>> {
                await this.bus.publish(itemCreatedEvent.make({ id: 'q', name: 'from-query' }));
            }
        }

        const app = createApplication({
            events: [Spy],
            queries: [DoQueryHandler],
        });

        await app.executeQuery('doQuery', undefined);
        expect(published).toHaveLength(1);
        expect(published[0]!.payload).toEqual({ id: 'q', name: 'from-query' });
    });

    it('EventBusToken is bound even when no events are registered (for optional injection)', async () => {
        // A handler that injects EventBus but events list is empty
        const noop = createMutation('noop', z.void(), z.void());
        @injectable()
        class NoopHandler extends createMutationHandler(noop) {
            constructor(@inject(EventBusToken) private bus: EventBus) { super(); }
            async execute() {
                // EventBus exists; publishing to it with no handlers is a no-op
                await this.bus.publish({ type: 'ghost', payload: {} });
            }
        }

        const app = createApplication({ events: [], mutations: [NoopHandler] });
        await expect(app.executeMutation('noop', undefined)).resolves.not.toThrow();
    });
});
