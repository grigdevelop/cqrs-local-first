'use client';

import { createClientMutators } from 'cqrs';
import { useEffect, useRef, useState } from 'react';
import { Replicache } from 'replicache';
import { useSubscribe } from 'replicache-react';
import type { TodoApplication } from '../application/app';
import type { Todo } from '../model/schema';

const mutators = createClientMutators<TodoApplication>({
    createTodo: async (tx, args) => {
        await tx.set(`todo/${args.id}`, { id: args.id, text: args.text, done: false });
    },
    toggleTodo: async (tx, args) => {
        const todo = (await tx.get(`todo/${args.id}`)) as Todo | undefined;
        if (todo) await tx.set(`todo/${args.id}`, { ...todo, done: !todo.done });
    },
    deleteTodo: async (tx, args) => {
        await tx.del(`todo/${args.id}`);
    },
});

type Rep = Replicache<typeof mutators>;

export type TodoFilter = 'all' | 'active' | 'completed';

type TodoAppProps = {
    filter?: TodoFilter;
};

function matchesFilter(todo: Todo, filter: TodoFilter) {
    if (filter === 'active') return !todo.done;
    if (filter === 'completed') return todo.done;
    return true;
}

export function TodoApp({ filter = 'all' }: TodoAppProps) {
    const [rep, setRep] = useState<Rep | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const r = new Replicache({
            name: 'todos',
            licenseKey: 'l123456789',
            pushURL: '/api/replicache/push',
            pullURL: '/api/replicache/pull',
            mutators,
        });
        setRep(r);
        return () => {
            r.close();
        };
    }, []);

    const todos = useSubscribe(
        rep,
        async (tx) => {
            const values = await tx.scan({ prefix: 'todo/' }).toArray();
            return values as Todo[];
        },
        { default: [] as Todo[] }
    );
    const visibleTodos = todos.filter((todo) => matchesFilter(todo, filter));

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const text = inputRef.current?.value.trim();
        if (!text || !rep) return;
        rep.mutate.createTodo({ id: crypto.randomUUID(), text });
        if (inputRef.current) inputRef.current.value = '';
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="mb-6 flex flex-col gap-3 md:flex-row">
                <label className="input input-bordered input-lg flex w-full items-center gap-3 md:flex-1">
                    <span className="text-base-content/40">+</span>
                    <input
                        ref={inputRef}
                        placeholder="What needs to be done?"
                        autoComplete="off"
                        className="grow"
                    />
                </label>
                <button type="submit" className="btn btn-primary btn-lg md:w-auto">
                    Add
                </button>
            </form>

            {visibleTodos.length === 0 ? (
                <div className="hero rounded-box border border-dashed border-base-300 bg-base-200/60 py-12">
                    <div className="hero-content text-center">
                        <div className="max-w-sm">
                            <div className="mb-3 text-4xl">□</div>
                            <p className="text-lg font-semibold">No todos in this view yet.</p>
                            <p className="mt-2 text-sm text-base-content/60">Add one above to create your first synced task.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <ul className="space-y-3">
                    {visibleTodos.map((todo) => (
                        <li
                            key={todo.id}
                            className={[
                                'flex items-center gap-3 rounded-box border border-base-300 bg-base-100 px-4 py-3 shadow-sm transition-all',
                                todo.done ? 'opacity-80' : 'hover:-translate-y-0.5 hover:shadow-md',
                            ].join(' ')}
                        >
                            <button
                                onClick={() => rep?.mutate.toggleTodo({ id: todo.id })}
                                className={`btn btn-circle btn-sm ${todo.done ? 'btn-success' : 'btn-ghost'}`}
                                aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
                            >
                                {todo.done ? '\u2705' : '\u2B1C'}
                            </button>
                            <div className="flex-1">
                                <span className={`block text-base ${todo.done ? 'text-base-content/50 line-through' : 'text-base-content'}`}>
                                    {todo.text}
                                </span>
                                <span className="text-xs text-base-content/50">
                                    {todo.done ? 'Completed task' : 'Active task'}
                                </span>
                            </div>
                            <div className="badge badge-outline">{todo.done ? 'Done' : 'Open'}</div>
                            <button
                                onClick={() => rep?.mutate.deleteTodo({ id: todo.id })}
                                className="btn btn-ghost btn-sm text-error"
                                aria-label="Delete todo"
                            >
                                {'\u00D7'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
