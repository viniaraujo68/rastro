import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	{
		ignores: ['build/', '.svelte-kit/', 'node_modules/', 'playwright-report/', 'test-results/']
	},

	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,

	{
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			'no-empty': ['error', { allowEmptyCatch: true }],
			'svelte/no-navigation-without-resolve': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
			]
		}
	},

	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: { parser: ts.parser }
		}
	},

	{
		files: ['*.config.js', '*.config.ts'],
		languageOptions: { globals: globals.node }
	}
);
