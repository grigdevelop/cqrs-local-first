'use client';

import { useState } from 'react';
import { useSubscribe } from 'replicache-react';
import { useFeaturesReplicache } from '../../../replicache-context';
import type { Article } from '../model/schema';

export function ArticleModuleView() {
    const rep = useFeaturesReplicache();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');

    const articles = useSubscribe(
        rep,
        async (tx) => {
            const values = await tx.scan({ prefix: 'article/' }).toArray();
            return values as Article[];
        },
        { default: [] as Article[] },
    );

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const nextTitle = title.trim();
        const nextBody = body.trim();
        if (!rep || !nextTitle || !nextBody) return;
        rep.mutate.createArticle({ id: crypto.randomUUID(), title: nextTitle, body: nextBody });
        setTitle('');
        setBody('');
    }

    return (
        <section className="mx-auto w-full max-w-5xl">
            <header className="mb-6 rounded-box border border-base-300 bg-base-100/90 p-6 shadow-xl backdrop-blur">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="badge badge-outline mb-3">Application module</div>
                        <h1 className="text-4xl font-black tracking-tight">Articles</h1>
                        <p className="mt-2 max-w-2xl text-sm text-base-content/70">
                            Draft, publish, and sync short articles as another module in the same application.
                        </p>
                    </div>
                    <div className="stats stats-horizontal border border-base-300 bg-base-200 shadow-none">
                        <div className="stat px-5 py-4">
                            <div className="stat-title">Articles</div>
                            <div className="stat-value text-2xl">{articles.length}</div>
                        </div>
                        <div className="stat px-5 py-4">
                            <div className="stat-title">Published</div>
                            <div className="stat-value text-2xl">{articles.filter((article) => article.published).length}</div>
                        </div>
                    </div>
                </div>
            </header>

            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <form onSubmit={handleSubmit} className="card border border-base-300 bg-base-100 shadow-xl">
                    <div className="card-body gap-4">
                        <h2 className="card-title">New Article</h2>
                        <label className="form-control w-full">
                            <span className="label"><span className="label-text font-medium">Title</span></span>
                            <input
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="Article title"
                                className="input input-bordered w-full"
                                disabled={!rep}
                            />
                        </label>
                        <label className="form-control w-full">
                            <span className="label"><span className="label-text font-medium">Body</span></span>
                            <textarea
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                placeholder="Write something worth syncing"
                                className="textarea textarea-bordered min-h-40 w-full"
                                disabled={!rep}
                            />
                        </label>
                        <button type="submit" className="btn btn-primary" disabled={!rep}>Create article</button>
                    </div>
                </form>

                {articles.length === 0 ? (
                    <div className="hero rounded-box border border-dashed border-base-300 bg-base-200/60 py-12">
                        <div className="hero-content text-center">
                            <div className="max-w-sm">
                                <div className="mb-3 text-4xl">?</div>
                                <p className="text-lg font-semibold">No articles yet.</p>
                                <p className="mt-2 text-sm text-base-content/60">Create your first article draft from the form on the left.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {articles.map((article) => (
                            <article key={article.id} className="card border border-base-300 bg-base-100 shadow-xl">
                                <div className="card-body gap-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="card-title text-xl">{article.title}</h3>
                                            <p className="mt-2 whitespace-pre-wrap text-sm text-base-content/70">{article.body}</p>
                                        </div>
                                        <div className={`badge ${article.published ? 'badge-success' : 'badge-outline'}`}>
                                            {article.published ? 'Published' : 'Draft'}
                                        </div>
                                    </div>
                                    <div className="card-actions justify-end">
                                        <button
                                            type="button"
                                            onClick={() => rep?.mutate.toggleArticlePublished({ id: article.id })}
                                            className="btn btn-sm btn-outline"
                                        >
                                            {article.published ? 'Unpublish' : 'Publish'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => rep?.mutate.deleteArticle({ id: article.id })}
                                            className="btn btn-sm btn-ghost text-error"
                                        >
                                            Delete article
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </section>
    );
}


