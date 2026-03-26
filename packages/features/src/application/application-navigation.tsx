import { NavLink } from 'react-router-dom';

export type NavigationItem = {
    id: string;
    href: string;
    label: string;
};

const primaryNavigationItems: NavigationItem[] = [
    { id: 'todos', href: '/todos', label: 'Todos' },
    { id: 'articles', href: '/articles', label: 'Articles' },
    { id: 'profile', href: '/profile', label: 'Profile' },
];

type ApplicationNavigationProps = {
    useRouterLinks?: boolean;
    activeItem?: string;
};

export function ApplicationNavigation({ useRouterLinks = true, activeItem = 'todos' }: ApplicationNavigationProps) {
    return (
        <nav className="tabs tabs-box mb-6 w-fit bg-base-100 p-1 shadow-md" aria-label="Application modules">
            {primaryNavigationItems.map((module) => (
                useRouterLinks ? (
                    <NavLink
                        key={module.id}
                        to={module.href}
                        className={({ isActive }) => `tab rounded-lg px-5 ${isActive ? 'tab-active bg-primary text-primary-content' : ''}`}
                    >
                        {module.label}
                    </NavLink>
                ) : (
                    <span
                        key={module.id}
                        className={`tab rounded-lg px-5 ${module.id === activeItem ? 'tab-active bg-primary text-primary-content' : ''}`}
                    >
                        {module.label}
                    </span>
                )
            ))}
        </nav>
    );
}

export { primaryNavigationItems };
