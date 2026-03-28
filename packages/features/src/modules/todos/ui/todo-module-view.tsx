'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSubscribe } from 'replicache-react';
import { z } from 'zod';
import { useApplicationReplicache } from '../../../application/replicache-provider';
import type { Todo } from '../model/schema';

export type TodoFilter = 'all' | 'active' | 'completed';

const CreateTodoSchema = z.object({
    text: z.string().min(1, 'Todo text is required'),
});

type CreateTodoForm = z.infer<typeof CreateTodoSchema>;

type TodoModuleViewProps = {
    filter?: TodoFilter;
};

function matchesFilter(todo: Todo, filter: TodoFilter) {
    if (filter === 'active') return !todo.done;
    if (filter === 'completed') return todo.done;
    return true;
}

export function TodoModuleView({ filter = 'all' }: TodoModuleViewProps) {
    const rep = useApplicationReplicache();

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CreateTodoForm>({
        resolver: zodResolver(CreateTodoSchema),
        defaultValues: {
            text: '',
        },
    });

    const todos = useSubscribe(
        rep,
        async (tx) => {
            const values = await tx.scan({ prefix: 'todo/' }).toArray();
            return values as Todo[];
        },
        { default: [] as Todo[] }
    );
    const visibleTodos = todos.filter((todo) => matchesFilter(todo, filter));

    function onSubmit(data: CreateTodoForm) {
        if (!rep) return;
        rep.mutate.createTodo({ id: crypto.randomUUID(), text: data.text });
        reset();
    }

    return (
        <>
            <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="mb-6 flex flex-col gap-3 md:flex-row">
                <label className="form-control md:flex-1">
                    <div className="input input-bordered input-lg flex w-full items-center gap-3">
                        <span className="text-base-content/40">+</span>
                        <input
                            {...register('text')}
                            placeholder="What needs to be done?"
                            autoComplete="off"
                            className="grow"
                            disabled={!rep || isSubmitting}
                        />
                    </div>
                    {errors.text ? <span className="label-text-alt mt-1 text-error">{errors.text.message}</span> : null}
                </label>
                <button type="submit" className="btn btn-primary btn-lg md:w-auto" disabled={!rep || isSubmitting}>
                    {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : null}
                    {isSubmitting ? 'Adding...' : 'Add'}
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
                                <span className="text-xs text-base-content/50">{todo.done ? 'Completed task' : 'Active task'}</span>
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
