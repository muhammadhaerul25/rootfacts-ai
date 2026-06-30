export default [
	{
		files: ['**/*.js'],
		ignores: ['node_modules/**', 'dist/**'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				// Browser globals
				window: 'readonly',
				document: 'readonly',
				navigator: 'readonly',
				console: 'readonly',
				fetch: 'readonly',
				requestAnimationFrame: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				caches: 'readonly',
				self: 'readonly',
				// Web APIs
				AbortController: 'readonly',
				Promise: 'readonly',
				URL: 'readonly',
				Event: 'readonly',
				CustomEvent: 'readonly',
				FormData: 'readonly',
				Headers: 'readonly',
				Request: 'readonly',
				Response: 'readonly',
				// TensorFlow.js global
				tf: 'readonly',
				// Lucide icons global
				lucide: 'readonly',
				// Workbox globals for sw.js
				workbox: 'readonly',
				importScripts: 'readonly',
			},
		},
		rules: {
			// Possible errors
			'no-console': 'off',
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_|^app$' }],
			'no-undef': 'error',

			// Best practices
			'eqeqeq': ['error', 'always'],
			'no-var': 'error',
			'prefer-const': 'error',
			'prefer-arrow-callback': 'error',
			'no-duplicate-imports': 'error',

			// Style
			'indent': ['error', 'tab'],
			'quotes': ['error', 'single'],
			'semi': ['error', 'always'],
			'comma-dangle': ['error', 'never'],
			'object-curly-spacing': ['error', 'always'],
			'arrow-spacing': ['error', { before: true, after: true }],
			'space-before-function-paren': ['error', 'never'],
			'keyword-spacing': ['error', { before: true, after: true }],

			// ES6+
			'prefer-template': 'error',
			'no-useless-concat': 'error',
		},
	},
];
