'use client';

import { useEffect, useRef, useState } from 'react';
import { Replicache } from 'replicache';
import { useSubscribe } from 'replicache-react';
import type { Todo } from '@/db/schema';
import type { Application } from '@/todos/app';
import { createClientMutators } from 'cqrs';

const mutators = createClientMutators<Application>({
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

export function TodoApp() {
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
        return () => { r.close(); };
    }, []);

    const todos = useSubscribe(
        rep,
        async (tx) => {
            const values = await tx.scan({ prefix: 'todo/' }).toArray();
            return values as Todo[];
        },
        { default: [] as Todo[] }
    );

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const text = inputRef.current?.value.trim();
        if (!text || !rep) return;
        rep.mutate.createTodo({ id: crypto.randomUUID(), text });
        if (inputRef.current) inputRef.current.value = '';
    }

    return (
        <main className="max-w-lg mx-auto mt-16 px-4">
            <h1 className="text-3xl font-bold mb-8">Todos</h1>

            <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
                <input
                    ref={inputRef}
                    placeholder="What needs to be done?"
                    autoComplete="off"
                    className="flex-1 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="submit"
                    className="rounded-lg bg-blue-500 px-5 py-2 text-white font-medium hover:bg-blue-600 transition-colors"
                >
                    Add
                </button>
            </form>

            {todos.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No todos yet. Add one above!</p>
            ) : (
                <ul className="space-y-2">
                    {todos.map((todo) => (
                        <li key={todo.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                            <button
                                onClick={() => rep?.mutate.toggleTodo({ id: todo.id })}
                                className="text-xl leading-none"
                                aria-label={todo.done ? 'Mark incomplete' : 'Mark complete'}
                            >
                                {todo.done ? '✅' : '⬜'}
                            </button>
                            <span className={`flex-1 ${todo.done ? 'line-through text-gray-400' : ''}`}>
                                {todo.text}
                            </span>
                            <button
                                onClick={() => rep?.mutate.deleteTodo({ id: todo.id })}
                                className="text-gray-300 hover:text-red-500 text-xl leading-none transition-colors"
                                aria-label="Delete todo"
                            >
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
