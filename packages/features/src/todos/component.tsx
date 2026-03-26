'use client';

import { createClientMutators } from 'cqrs';
import { useEffect, useRef, useState } from 'react';
import { Replicache } from 'replicache';
import { useSubscribe } from 'replicache-react';
import type { TodoApplication } from './app';
import type { Todo } from './schema';

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
            <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
                <input
                    ref={inputRef}
                    placeholder="What needs to be done?"
                    autoComplete="off"
                    className="flex-1 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="submit"
                    className="rounded-lg bg-blue-500 px-5 py-2 font-medium text-white transition-colors hover:bg-blue-600"
                >
                    Add
                </button>
            </form>

            {visibleTodos.length === 0 ? (
                <p className="py-8 text-center text-gray-400">No todos in this view yet.</p>
            ) : (
                <ul className="space-y-2">
                    {visibleTodos.map((todo) => (
                        <li key={todo.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                            <button
                                onClick={() => rep?.mutate.toggleTodo({ id: todo.id })}
                                className="text-xl leading-none"
                                aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
                            >
                                {todo.done ? '\u2705' : '\u2B1C'}
                            </button>
                            <span className={`flex-1 ${todo.done ? 'text-gray-400 line-through' : ''}`}>
                                {todo.text}
                            </span>
                            <button
                                onClick={() => rep?.mutate.deleteTodo({ id: todo.id })}
                                className="text-xl leading-none text-gray-300 transition-colors hover:text-red-500"
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
