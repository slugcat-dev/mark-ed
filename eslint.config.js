import tsplugin from '@typescript-eslint/eslint-plugin'
import stylistic from '@stylistic/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [{
	plugins: {
		'@typescript-eslint': tsplugin,
		'@stylistic': stylistic
	},
	languageOptions: {
		parser: tsparser
	},
	files: ['**/*.{ts,js}'],
	ignores: ['**/dist/**/*'],
	rules: {
		'@stylistic/indent': ['error', 'tab'],
		'@stylistic/semi': ['error', 'never'],
		'@stylistic/quotes': ['error', 'single'],
		'@stylistic/comma-dangle': ['error', 'never'],
		'@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
		'@stylistic/no-floating-decimal': 'off'
	}
}]
