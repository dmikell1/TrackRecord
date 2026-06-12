import { GeminiRole } from '@packages/enums/gemini'

export { GeminiRole }

export interface GeminiToolDeclaration {
	functionDeclarations?: Array<{
		name: string
		description?: string
		parameters?: Record<string, unknown>
	}>
}

export interface GeminiMessage {
	role: GeminiRole
	parts: Array<{ text: string }>
}

export interface GeminiGenerateContentParams {
	model: string
	maxTokens?: number
	temperature?: number
	systemInstruction?: string
	messages: GeminiMessage[]
	tools?: GeminiToolDeclaration[]
}

export interface GeminiUsageMetadata {
	promptTokenCount?: number
	candidatesTokenCount?: number
	totalTokenCount?: number
}

export interface GeminiCandidate {
	content?: {
		parts?: Array<{ text?: string }>
	}
}

export interface GeminiGenerateContentResponse {
	candidates?: GeminiCandidate[]
	usageMetadata?: GeminiUsageMetadata
}

export class GeminiDirectAPI {
	private apiKey: string
	private baseUrl: string = 'https://generativelanguage.googleapis.com'

	constructor(apiKey: string) {
		this.apiKey = apiKey
	}

	public async generateContent({
		model,
		maxTokens,
		temperature,
		systemInstruction,
		messages,
		tools
	}: GeminiGenerateContentParams): Promise<GeminiGenerateContentResponse> {
		const response = await fetch(
			`${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					contents: messages,
					...(systemInstruction && { systemInstruction }),
					generationConfig: {
						maxOutputTokens: maxTokens,
						temperature
					},
					...(tools && tools.length > 0 && { tools })
				})
			}
		)

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Gemini API error: ${response.status} ${errorText}`)
		}

		return response.json() as Promise<GeminiGenerateContentResponse>
	}
}
