export type AIEngine = 'openai' | 'anthropic' | 'gemini' | 'ollama'

export type AIModel =
	| 'gpt-4o-mini-2024-07-18'
	| 'gpt-3.5-turbo'
	| 'gpt-4'
	| 'claude-3-5-sonnet-latest'
	| 'claude-3-5-haiku-latest'
	| 'claude-3-7-sonnet-20250219'
	| 'claude-opus-4-20250514'
	| 'claude-sonnet-4-20250514'
	| 'claude-3-5-haiku-20241022'
	| 'gemini-2.0-flash'
	| string

export interface AIMessage {
	role: 'user' | 'assistant' | 'system'
	content: string | any
}
