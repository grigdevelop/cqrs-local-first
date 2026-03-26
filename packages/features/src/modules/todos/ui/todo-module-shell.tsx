'use client';

import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { TodoModuleView, type TodoFilter } from './todo-module-view';

const todoViews: Array<{ filter: TodoFilter; href: string; label: string }> = [
    { filter: 'all', href: '', label: 'All' },
    { filter: 'active', href: 'active', label: 'Active' },
    { filter: 'completed', href: 'completed', label: 'Completed' },
];

function TodoModuleLayout() {
    return (
        <>
            <nav className="tabs tabs-box mb-6 w-fit bg-base-100 p-1 shadow-md" aria-label="Todo views">
                {todoViews.map((view) => (
                    <NavLink
                        key={view.filter}
                        to={view.href}
                        end={view.href === ''}
                        className={({ isActive }) => `tab rounded-lg px-5 ${isActive ? 'tab-active bg-primary text-primary-content' : ''}`}
                    >
                        {view.label}
                    </NavLink>
                ))}
            </nav>
            <Outlet />
        </>
    );
}

export function TodoModuleShell() {
    return (
        <Routes>
            <Route element={<TodoModuleLayout />}>
                <Route index element={<TodoModuleView filter="all" />} />
                <Route path="active" element={<TodoModuleView filter="active" />} />
                <Route path="completed" element={<TodoModuleView filter="completed" />} />
            </Route>
            <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
    );
}
