module.exports = {
	parser: '@typescript-eslint/parser', // Specifies the ESLint parser
	plugins: ['import', 'jest'],
	extends: [
		'airbnb-base',
		'airbnb-typescript/base',
		'plugin:import/errors',
		'plugin:import/warnings',
		'plugin:import/typescript',
		'prettier',
		'plugin:jest/recommended'
	],
	env: {
		node: true // Enable Node.js global variables
	},
	parserOptions: {
		ecmaVersion: 'latest', // Allows for the parsing of modern ECMAScript features
		sourceType: 'module', // Allows for the use of imports
		project: ['./tsconfig.eslint.json']
	},
	overrides: [
		// Only uses Testing Library lint rules in test files
		{
			files: ['**/?(*.)+(test).[jt]s'],
			extends: ['plugin:jest/recommended'],
			rules: {
				'jest/no-conditional-expect': 'error',
				'jest/valid-expect': 'error',
				'jest/no-jasmine-globals': 'error'
			},
			env: {
				jest: true,
				node: true
			}
		}
	],
	rules: {
		// Imports
		'import/prefer-default-export': 'off',
		'import/no-named-as-default': 'off',
		'import/no-named-as-default-member': 'error',
		'import/namespace': 'error',
		'import/default': 'error',
		'import/no-cycle': 'off',
		'import/no-named-default': 'error',
		'import/no-dynamic-require': 'error',
		'import/order': [
			'error',
			{
				alphabetize: { order: 'asc', caseInsensitive: false },
				'newlines-between': 'always',
				groups: [
					'builtin',
					'external',
					'internal',
					['sibling', 'parent', 'index']
				]
			}
		],
		'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
		// TypeScript
		'@typescript-eslint/explicit-function-return-type': 'error',
		'@typescript-eslint/no-use-before-define': 'error',
		'@typescript-eslint/no-empty-function': 'error',
		'@typescript-eslint/no-unused-vars': 'error',
		'@typescript-eslint/no-explicit-any': 'error',
		'@typescript-eslint/no-shadow': 'error',
		'@typescript-eslint/no-throw-literal': 'error',
		'@typescript-eslint/naming-convention': 'error',
		'@typescript-eslint/no-unused-expressions': 'error',
		'@typescript-eslint/return-await': 'error',
		'@typescript-eslint/no-useless-constructor': 'error',
		'@typescript-eslint/dot-notation': 'off',
		// common
		'no-console': 'error',
		'consistent-return': 'error',
		'no-restricted-syntax': 'error',
		'no-await-in-loop': 'error',
		'no-param-reassign': 'error',
		'global-require': 'error',
		'no-async-promise-executor': 'error',
		'class-methods-use-this': 'off',
		'no-continue': 'error',
		'default-case': 'error',
		'no-underscore-dangle': 'off',
		'array-callback-return': 'error',
		'no-self-assign': 'error',
		'no-sequences': 'error',
		'prefer-destructuring': 'error',
		'no-fallthrough': 'error',
		'no-empty': 'error',
		'prefer-promise-reject-errors': 'error',
		'max-classes-per-file': 'off',
		'no-return-assign': 'error',
		'consistent-return': 'off'
		// 'import/no-cycle': ['error', { maxDepth: '∞' }]
	},
	settings: {
		'import/resolver': {
			typescript: {
				alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
				project: '.'
			}
		}
	}
}
