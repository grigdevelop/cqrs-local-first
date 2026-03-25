import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        root: './',
        environment: 'node',
        exclude: ['e2e/**', '**/node_modules/**'],
    },
    plugins: [
        tsconfigPaths(),
        swc.vite({
            jsc: {
                parser: {
                    syntax: 'typescript',
                    decorators: true,
                },
                transform: {
                    decoratorMetadata: true,
                },
            },
        }),
    ],
});
