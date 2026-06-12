import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import {
	HumanMessage,
	SystemMessage,
	AIMessage as LangChainAIMessage,
	MessageContent
} from '@langchain/core/messages'
import { StructuredOutputParser } from '@langchain/core/output_parsers'
import { OpenAIEmbeddings } from '@langchain/openai'
import { injectable, inject } from 'tsyringe'
import { z } from 'zod'
import { env } from '@packages/utils/validateEnvs'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { AIEngine, AIMessage, AIModel } from '@packages/types'
import { AIInteractionService } from '@packages/services/AIInteractionService'
import { AIInteractionType } from '@packages/types/AIInteraction'
import { encoding_for_model } from '@dqbd/tiktoken'
import { GeminiDirectAPI, GeminiRole } from '@packages/clients/gemini-client'

const llamaindex = require('llamaindex')
const { Document, VectorStoreIndex } = llamaindex

/**
 * Custom retry utility for handling API rate limits and overloaded errors
 */
class RetryUtility {
	static readonly MAX_RETRIES = 5
	private static readonly BASE_DELAY = 1000 // 1 second
	private static readonly MAX_DELAY = 30000 // 30 seconds

	/**
	 * Check if an error should be retried
	 */
	static shouldRetry(error: any): boolean {
		const errorMessage = error?.message || ''
		const statusCode = this.extractStatusCode(errorMessage)

		// Retry on 529 (overloaded) and 429 (rate limited) errors
		if (statusCode === 529 || statusCode === 429) {
			return true
		}

		// Also retry on network errors and timeouts
		if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
			return true
		}

		// Check for specific overloaded error messages
		if (
			errorMessage.includes('overloaded_error') ||
			errorMessage.includes('Overloaded')
		) {
			return true
		}

		return false
	}

	/**
	 * Extract status code from error message
	 */
	private static extractStatusCode(errorMessage: string): number | null {
		const match = errorMessage.match(/(\d{3})\s*{/)
		return match ? parseInt(match[1], 10) : null
	}

	/**
	 * Calculate delay with exponential backoff and jitter
	 * For 529 errors, use longer delays
	 */
	static calculateDelay(
		attempt: number,
		isOverloaded: boolean = false
	): number {
		let baseDelay = this.BASE_DELAY

		// Use longer delays for overloaded errors
		if (isOverloaded) {
			baseDelay = 2000 // 2 seconds base for overloaded errors
		}

		const exponentialDelay = Math.min(
			baseDelay * Math.pow(2, attempt),
			this.MAX_DELAY
		)

		// Add jitter (±20%) to prevent thundering herd
		const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5)
		return Math.max(100, exponentialDelay + jitter)
	}

	/**
	 * Check if error is specifically an overloaded error
	 */
	static isOverloadedError(error: any): boolean {
		const errorMessage = error?.message || ''
		const statusCode = this.extractStatusCode(errorMessage)
		return (
			statusCode === 529 ||
			errorMessage.includes('overloaded_error') ||
			errorMessage.includes('Overloaded')
		)
	}

	/**
	 * Sleep for a given number of milliseconds
	 */
	static sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}
}

/**
 * TokenCounter utility class for more accurate token counting
 */
class TokenCounter {
	private static getEncodingForModel(model: string): any {
		try {
			// For OpenAI models
			if (model.startsWith('gpt-')) {
				if (model.includes('gpt-4')) {
					return encoding_for_model('gpt-4')
				} else if (model.includes('gpt-3.5')) {
					return encoding_for_model('gpt-3.5-turbo')
				} else {
					return encoding_for_model('gpt-3.5-turbo')
				}
			}

			// For Claude models, TikToken doesn't have direct support
			// but we can use a reasonable approximation with cl100k_base (used by GPT-4)
			return encoding_for_model('gpt-4')
		} catch (error) {
			// Fallback to a simple encoding for safety
			return encoding_for_model('gpt-3.5-turbo')
		}
	}

	/**
	 * Count tokens in a text string for a specific model
	 */
	static countTokensInText(text: string, model: string): number {
		try {
			const encoding = this.getEncodingForModel(model)
			return encoding.encode(text).length
		} catch (error) {
			// Fallback to a simple character-based approximation
			return Math.ceil(text.length / 4)
		}
	}

	/**
	 * Count tokens in AI messages and system prompt
	 */
	static countTokensInMessages(
		messages: AIMessage[],
		systemPrompt: string,
		model: string
	): {
		promptTokens: number
		baseTokensPerMessage: number
	} {
		let totalTokens = 0
		const baseTokensPerMessage = model.includes('gpt-') ? 3 : 4 // Different models have different base token counts

		try {
			const encoding = this.getEncodingForModel(model)

			// Count system prompt tokens
			if (systemPrompt) {
				const systemTokens = encoding.encode(systemPrompt).length
				totalTokens += systemTokens + baseTokensPerMessage
			}

			// Count message tokens
			for (const message of messages) {
				if (message.content) {
					const contentTokens = encoding.encode(
						message.content.toString()
					).length
					totalTokens += contentTokens
					totalTokens += baseTokensPerMessage // Add base tokens per message
				}
			}

			// Add a few extra tokens for format overhead
			totalTokens += 3

			return {
				promptTokens: totalTokens,
				baseTokensPerMessage
			}
		} catch (error) {
			// Fallback to character-based approximation
			let totalChars = systemPrompt ? systemPrompt.length : 0
			totalChars += messages.reduce(
				(sum, msg) => sum + (msg.content ? msg.content.toString().length : 0),
				0
			)

			return {
				promptTokens: Math.ceil(totalChars / 4),
				baseTokensPerMessage
			}
		}
	}
}

interface BaseAIConfig {
	maxTokens?: number
	temperature?: number
	responseFormat?: {
		type: string
		schema?: Record<string, any>
	}
	enableCaching?: boolean
	cacheControl?: {
		type: 'ephemeral'
		ttlHours?: 1 | 0.083 // 1 hour or 5 minutes (0.083 hours)
	}
	tools?: Array<any> // For function calling (Gemini/Anthropic)
}

export interface AIConfig extends BaseAIConfig {
	engine: AIEngine
	model: AIModel
}

export interface DocumentInfo {
	content: string
	metadata?: Record<string, any>
}

/**
 * Simple class to interact with Ollama API directly
 */
class OllamaAPI {
	private baseUrl: string

	constructor(baseUrl: string = 'http://localhost:11434') {
		this.baseUrl = baseUrl
	}

	async generateCompletion(
		model: string,
		prompt: string,
		options: {
			temperature?: number
			maxTokens?: number
		} = {}
	): Promise<string> {
		const response = await fetch(`${this.baseUrl}/api/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model,
				prompt,
				temperature: options.temperature ?? 0.7,
				max_tokens: options.maxTokens,
				stream: false
			})
		})

		if (!response.ok) {
			const error = await response.text()
			throw new Error(`Ollama API error: ${error}`)
		}

		const data = (await response.json()) as { response: string }
		return data.response
	}
}

/**
 * Direct Anthropic API client for web search functionality
 * This bypasses LangChain since it doesn't support web search tools yet
 */
class AnthropicDirectAPI {
	private apiKey: string
	private baseUrl: string = 'https://api.anthropic.com'

	constructor(apiKey: string) {
		this.apiKey = apiKey
	}

	async createMessage({
		model,
		maxTokens,
		temperature,
		system,
		messages,
		tools,
		systemArray
	}: {
		model: string
		maxTokens: number
		temperature: number
		system?: string
		messages: Array<{
			role: 'user' | 'assistant'
			content: string
		}>
		tools?: Array<any>
		// Internal parameters for cache control
		systemArray?: Array<{
			type: 'text'
			text: string
			cache_control?: { type: 'ephemeral' }
		}>
	}): Promise<any> {
		const requestBody: any = {
			model,
			max_tokens: maxTokens,
			temperature,
			messages: messages.map((msg) => ({
				role: msg.role,
				content: msg.content
			}))
		}

		// Handle system prompt - use systemArray if provided (for caching), otherwise regular system
		if (systemArray && systemArray.length > 0) {
			requestBody.system = systemArray
		} else if (system) {
			requestBody.system = system
		}

		if (tools && tools.length > 0) {
			requestBody.tools = tools
		}

		const response = await fetch(`${this.baseUrl}/v1/messages`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify(requestBody)
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Anthropic API error: ${response.status} ${errorText}`)
		}

		return response.json()
	}
}

@injectable()
export class AIClient {
	private openAIModel: ChatOpenAI
	private anthropicModel: ChatAnthropic
	private anthropicDirectAPI: AnthropicDirectAPI
	private geminiDirectAPI: GeminiDirectAPI
	private ollamaAPI: OllamaAPI
	private embeddings: OpenAIEmbeddings

	constructor(
		@inject(ReportingService)
		private reportingService: ReportingService,
		@inject(AIInteractionService)
		private aiInteractionService: AIInteractionService
	) {
		this.openAIModel = new ChatOpenAI({
			openAIApiKey: env.OPENAI_API_KEY,
			modelName: 'gpt-4o-mini-2024-07-18',
			temperature: 0.7
		})

		this.anthropicModel = new ChatAnthropic({
			anthropicApiKey: env.ANTHROPIC_API_KEY,
			modelName: 'claude-3-5-haiku-latest',
			temperature: 0.7
		})

		this.anthropicDirectAPI = new AnthropicDirectAPI(env.ANTHROPIC_API_KEY)

		this.geminiDirectAPI = new GeminiDirectAPI(env.GEMINI_API_KEY)

		this.ollamaAPI = new OllamaAPI()

		this.embeddings = new OpenAIEmbeddings({
			openAIApiKey: env.OPENAI_API_KEY
		})
	}

	private convertToLangChainMessages(
		messages: AIMessage[],
		system?: string
	): (SystemMessage | HumanMessage | LangChainAIMessage)[] {
		const langChainMessages: (
			| SystemMessage
			| HumanMessage
			| LangChainAIMessage
		)[] = []

		if (system) {
			langChainMessages.push(
				new SystemMessage({ content: system as MessageContent })
			)
		}

		for (const message of messages) {
			if (message.role === 'user') {
				langChainMessages.push(
					new HumanMessage({ content: message.content as MessageContent })
				)
			} else if (message.role === 'assistant') {
				langChainMessages.push(
					new LangChainAIMessage({ content: message.content as MessageContent })
				)
			}
		}

		return langChainMessages
	}

	private async setupSchemaParser(schema?: Record<string, any>) {
		if (!schema) return null

		// Create the Zod schema using our helper function
		const zodSchema = this.createZodSchema(schema)

		// Return a structured output parser using the Zod schema
		return StructuredOutputParser.fromZodSchema(zodSchema)
	}

	private createZodSchema(schemaObj: Record<string, any>): z.ZodSchema {
		const createSchemaForValue = (value: any): z.ZodSchema => {
			// Handle arrays
			if (Array.isArray(value)) {
				if (value.length > 0) {
					const elementSchema = createSchemaForValue(value[0])
					return z.array(elementSchema)
				}
				return z.array(z.string())
			}

			// Handle nested objects
			if (typeof value === 'object' && value !== null) {
				return this.createZodSchema(value)
			}

			// Handle string with special format requirements
			if (typeof value === 'string') {
				// Check for ISO date requirement in the string description
				if (value.toLowerCase().includes('iso string')) {
					return z.string().refine(
						(val) => {
							const date = new Date(val)
							return !isNaN(date.getTime()) && date.toISOString() === val
						},
						{
							message: 'Must be a valid ISO date string'
						}
					)
				}

				// Handle ENUM prefix
				if (value.startsWith('ENUM --')) {
					const enumValues = value
						.replace('ENUM --', '')
						.trim()
						.split('|')
						.map((v) => v.trim())
					return z.enum(enumValues as [string, ...string[]])
				}

				// Handle regular union types
				if (value.includes('|')) {
					const options = value.split('|').map((v) => v.trim())
					return z.enum(options as [string, ...string[]])
				}
			}

			// Handle primitive types
			switch (value) {
				case 'boolean':
					return z.boolean()
				case 'string':
					return z.string()
				case 'number':
					return z.number()
				default:
					return z.string()
			}
		}

		return z.object(
			Object.entries(schemaObj).reduce(
				(acc, [key, value]) => {
					acc[key] = createSchemaForValue(value)
					return acc
				},
				{} as Record<string, z.ZodSchema>
			)
		)
	}

	private ensureValidResponse<T>(
		response: any,
		schema: Record<string, any>
	): T {
		const createDefaultResponse = (schemaObj: Record<string, any>) => {
			return Object.entries(schemaObj).reduce(
				(acc, [key, value]) => {
					// Handle arrays
					if (Array.isArray(value)) {
						acc[key] = []
						return acc
					}

					// Handle nested objects
					if (typeof value === 'object' && value !== null) {
						acc[key] = createDefaultResponse(value)
						return acc
					}

					// Handle strings with special format requirements
					if (typeof value === 'string') {
						if (value.toLowerCase().includes('iso string')) {
							acc[key] = new Date().toISOString() // Default to current time in ISO format
							return acc
						}
					}

					// Handle primitives
					switch (value) {
						case 'boolean':
							acc[key] = false
							break
						case 'string':
							acc[key] = ''
							break
						case 'number':
							acc[key] = 0
							break
						default:
							if (typeof value === 'string') {
								if (value.includes('|')) {
									acc[key] = value.split('|')[0].trim()
								} else if (value.startsWith('ENUM --')) {
									const firstEnum = value
										.replace('ENUM --', '')
										.trim()
										.split('|')[0]
										.trim()
									acc[key] = firstEnum
								} else {
									acc[key] = ''
								}
							} else {
								acc[key] = null
							}
					}
					return acc
				},
				{} as Record<string, any>
			)
		}

		if (!response || typeof response !== 'object') {
			return createDefaultResponse(schema) as T
		}

		const ensureFields = (obj: any, schemaObj: Record<string, any>) => {
			Object.entries(schemaObj).forEach(([key, value]) => {
				if (!(key in obj)) {
					if (Array.isArray(value)) {
						obj[key] = []
					} else if (typeof value === 'object' && value !== null) {
						obj[key] = createDefaultResponse(value)
					} else if (
						typeof value === 'string' &&
						value.toLowerCase().includes('iso string')
					) {
						obj[key] = new Date().toISOString()
					} else {
						switch (value) {
							case 'boolean':
								obj[key] = false
								break
							case 'string':
								obj[key] = ''
								break
							case 'number':
								obj[key] = 0
								break
							default:
								if (typeof value === 'string') {
									if (value.includes('|')) {
										obj[key] = value.split('|')[0].trim()
									} else if (value.startsWith('ENUM --')) {
										const firstEnum = value
											.replace('ENUM --', '')
											.trim()
											.split('|')[0]
											.trim()
										obj[key] = firstEnum
									} else {
										obj[key] = ''
									}
								} else {
									obj[key] = null
								}
						}
					}
				} else if (
					typeof value === 'string' &&
					value.toLowerCase().includes('iso string') &&
					typeof obj[key] === 'string'
				) {
					// Ensure existing date strings are in ISO format
					try {
						const date = new Date(obj[key])
						if (!isNaN(date.getTime())) {
							obj[key] = date.toISOString()
						} else {
							obj[key] = new Date().toISOString()
						}
					} catch {
						obj[key] = new Date().toISOString()
					}
				}
			})
		}

		ensureFields(response, schema)
		return response as T
	}

	private async processDocuments(documents: DocumentInfo[]): Promise<string> {
		try {
			if (!documents || documents.length === 0) {
				return ''
			}

			// Filter out empty documents
			const validDocs = documents.filter(
				(doc) => doc.content && doc.content.trim() !== ''
			)

			if (validDocs.length === 0) {
				return ''
			}

			// Create Document objects
			const docs = validDocs.map(
				(doc, index) =>
					new Document({
						text: doc.content,
						id: `doc-${index}`,
						metadata: doc.metadata || {}
					})
			)

			// Create the index
			const index = await VectorStoreIndex.fromDocuments(docs, {
				embed: false // Disable embedding since we don't need vector search here
			})

			// Use node retriever (simpler than vector store)
			const nodeRetriever = index.asRetriever()
			const nodes = await nodeRetriever.retrieve('')

			// Extract and combine text from nodes
			const texts = nodes.map((node) => node.text || '').filter(Boolean)

			return texts.join('\n\n')
		} catch (error) {
			this.reportingService.log({
				message: 'Error processing documents',
				error
			})
			// Return empty string on error instead of throwing
			return ''
		}
	}

	private createEnhancedSystemPrompt(
		baseSystem: string,
		parser: StructuredOutputParser<any> | null,
		schema: Record<string, any> | undefined
	): string {
		let enhancedSystem = baseSystem

		if (parser) {
			const formatInstructions = parser.getFormatInstructions()
			const exampleResponse = this.ensureValidResponse({}, schema || {})

			enhancedSystem = `${enhancedSystem}

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. Do not include any natural language outside the JSON structure.

Your response must follow this exact format:
\`\`\`json
${JSON.stringify(exampleResponse, null, 2)}
\`\`\`

Key requirements:
1. Output ONLY the JSON object - no other text before or after
2. Ensure all required fields are included
3. Follow the exact schema structure shown above
4. Use proper JSON syntax with double quotes for keys and string values
5. Do not include any explanatory text or markdown outside the JSON

${formatInstructions}`
		}

		return enhancedSystem
	}

	async conversation<T>({
		system = '',
		messages,
		documents,
		config = {
			engine: 'openai',
			model: 'gpt-4o-mini-2024-07-18',
			maxTokens: 4000,
			temperature: 0.7,
			responseFormat: {
				type: 'json_object',
				schema: {
					answer: 'string'
				}
			}
		},
		companyId,
		campaignId,
		contactId,
		interactionType = AIInteractionType.GENERAL,
		metadata = {},
		enforceLimits = false
	}: {
		system?: string
		messages: AIMessage[]
		documents?: DocumentInfo[]
		config: AIConfig
		companyId?: string
		campaignId?: string
		contactId?: string
		interactionType?: AIInteractionType
		metadata?: Record<string, any>
		enforceLimits?: boolean
	}): Promise<T> {
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= RetryUtility.MAX_RETRIES; attempt++) {
			try {
				// Check limits before making the API call if enforcement is enabled
				if (enforceLimits && companyId) {
					this.reportingService.log({
						message: 'Checking AI interaction limits',
						companyId,
						campaignId,
						enforcing: true
					})

					const limitsCheck =
						await this.aiInteractionService.checkLimitsBeforeInteraction({
							companyId,
							campaignId,
							interactionType
						})

					if (!limitsCheck.withinLimits) {
						this.reportingService.log({
							message: 'AI interaction limit exceeded',
							companyId,
							campaignId,
							reason: limitsCheck.reason
						})
						throw new Error(`AI limit exceeded: ${limitsCheck.reason}`)
					}
				} else {
					this.reportingService.log({
						message: 'Skipping AI interaction limits check (not enforcing)',
						companyId,
						campaignId
					})
				}

				const finalConfig = {
					...config,
					temperature: config.temperature ?? 0.7,
					responseFormat: config.responseFormat ?? {
						type: 'json_object',
						schema: { answer: 'string' }
					}
				}

				this.reportingService.log({
					message: 'finalConfig',
					finalConfig
				})
				const parser = await this.setupSchemaParser(
					finalConfig.responseFormat?.schema
				)
				let enhancedSystem = system

				if (documents?.length) {
					try {
						const documentContext = await this.processDocuments(documents)
						if (documentContext) {
							enhancedSystem = `${system}\n\nContext from provided documents:\n${documentContext}`
						}
					} catch (error) {
						this.reportingService.log({
							message: 'Warning: Error processing documents',
							error
						})
						// Continue without document context rather than failing
					}
				}

				if (parser && finalConfig.responseFormat?.schema) {
					enhancedSystem = this.createEnhancedSystemPrompt(
						enhancedSystem,
						parser,
						finalConfig.responseFormat.schema
					)
				}

				const processResponse = async (content: string): Promise<T> => {
					this.reportingService.log({
						message: 'processResponse',
						content
					})
					if (!parser || !finalConfig.responseFormat?.schema) {
						return content as T
					}

					try {
						const parsedContent = await parser.parse(content)
						return this.ensureValidResponse(
							parsedContent,
							finalConfig.responseFormat.schema
						)
					} catch (error) {
						this.reportingService.log({
							message: 'Parser error, attempting cleanup',
							error
						})
						const cleanedResponse = await this.parseAndCleanResponse(
							content,
							finalConfig.responseFormat.schema
						)
						return this.ensureValidResponse(
							cleanedResponse,
							finalConfig.responseFormat.schema
						)
					}
				}

				let response
				let result
				let tokenUsage = {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0
				}

			if (finalConfig.engine === 'openai') {
				this.openAIModel.model = finalConfig.model as string
				this.openAIModel.maxTokens = finalConfig.maxTokens
				this.openAIModel.temperature = finalConfig.temperature

					const langChainMessages = this.convertToLangChainMessages(
						messages,
						enhancedSystem
					)
					response = await this.openAIModel.invoke(langChainMessages)
					result = await processResponse(response.content?.toString() || '')

					// Get token count from OpenAI response
					if ((response as any).llmOutput?.tokenUsage) {
						tokenUsage = (response as any).llmOutput.tokenUsage
					} else if ((response as any)._raw?.usage) {
						const usage = (response as any)._raw.usage
						tokenUsage = {
							promptTokens: usage.prompt_tokens || 0,
							completionTokens: usage.completion_tokens || 0,
							totalTokens: usage.total_tokens || 0
						}
					} else if ((response as any).usage) {
						// Direct access to usage field (for backward compatibility)
						const usage = (response as any).usage
						tokenUsage = {
							promptTokens: usage.prompt_tokens || 0,
							completionTokens: usage.completion_tokens || 0,
							totalTokens: usage.total_tokens || 0
						}
					} else {
						// If we still can't find usage data, use the TokenCounter
						this.reportingService.log({
							message: 'Warning: Could not find token usage in OpenAI response',
							responseKeys: Object.keys(response || {}),
							modelName: finalConfig.model
						})

						// Use TokenCounter for more accurate token estimation
						const { promptTokens } = TokenCounter.countTokensInMessages(
							messages,
							enhancedSystem,
							finalConfig.model as string
						)

						const responseText = response.content?.toString() || ''
						const completionTokens = TokenCounter.countTokensInText(
							responseText,
							finalConfig.model as string
						)

						tokenUsage = {
							promptTokens,
							completionTokens,
							totalTokens: promptTokens + completionTokens
						}
					}
				} else if (finalConfig.engine === 'anthropic') {
					const langChainMessages = this.convertToLangChainMessages(
						messages,
						enhancedSystem
					)
					this.anthropicModel.temperature = finalConfig.temperature
					response = await this.anthropicModel.invoke(langChainMessages)
					result = await processResponse(response.content?.toString() || '')

					// Get token count from Anthropic response
					if ((response as any)._raw?.usage) {
						const usage = (response as any)._raw.usage
						tokenUsage = {
							promptTokens: usage.input_tokens || 0,
							completionTokens: usage.output_tokens || 0,
							totalTokens:
								(usage.input_tokens || 0) + (usage.output_tokens || 0)
						}
					} else if ((response as any).usage) {
						// Direct access to usage field (for backward compatibility)
						const usage = (response as any).usage
						tokenUsage = {
							promptTokens: usage.input_tokens || 0,
							completionTokens: usage.output_tokens || 0,
							totalTokens:
								(usage.input_tokens || 0) + (usage.output_tokens || 0)
						}
					} else {
						// If we still can't find usage data, use the TokenCounter
						this.reportingService.log({
							message:
								'Warning: Could not find token usage in Anthropic response',
							responseKeys: Object.keys(response || {}),
							modelName: finalConfig.model
						})

						// Use TokenCounter for more accurate token estimation
						const { promptTokens } = TokenCounter.countTokensInMessages(
							messages,
							enhancedSystem,
							finalConfig.model as string
						)

						const responseText = response.content?.toString() || ''
						const completionTokens = TokenCounter.countTokensInText(
							responseText,
							finalConfig.model as string
						)

						tokenUsage = {
							promptTokens,
							completionTokens,
							totalTokens: promptTokens + completionTokens
						}
					}
				} else if (finalConfig.engine === 'gemini') {
					// Convert messages to Gemini format
				const geminiMessages = messages.map((msg) => ({
					role: msg.role === 'user' ? GeminiRole.User : GeminiRole.Model,
					parts: [{ text: msg.content.toString() }]
				}))

					// Call Gemini API directly
					const geminiResponse = await this.geminiDirectAPI.generateContent({
						model: finalConfig.model as string,
						maxTokens: finalConfig.maxTokens || 4000,
						temperature: finalConfig.temperature,
						systemInstruction: enhancedSystem,
						messages: geminiMessages,
						tools: finalConfig.tools // Pass tools for function calling
					})

					// Extract response text from Gemini response
					const responseText =
						geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text || ''
					result = await processResponse(responseText)

					// Get token usage from Gemini response
					if (geminiResponse.usageMetadata) {
						tokenUsage = {
							promptTokens: geminiResponse.usageMetadata.promptTokenCount || 0,
							completionTokens:
								geminiResponse.usageMetadata.candidatesTokenCount || 0,
							totalTokens: geminiResponse.usageMetadata.totalTokenCount || 0
						}
					} else {
						// Fallback to TokenCounter if usage data is not available
						const { promptTokens } = TokenCounter.countTokensInMessages(
							messages,
							enhancedSystem,
							finalConfig.model as string
						)

						const completionTokens = TokenCounter.countTokensInText(
							responseText,
							finalConfig.model as string
						)

						tokenUsage = {
							promptTokens,
							completionTokens,
							totalTokens: promptTokens + completionTokens
						}
					}
				} else if (finalConfig.engine === 'ollama') {
					// Format the prompt for Ollama by combining system and messages
					let formattedPrompt = enhancedSystem ? `${enhancedSystem}\n\n` : ''

					// Format all messages in a conversational format
					formattedPrompt += messages
						.map((msg) => {
							const role = msg.role === 'user' ? 'Human' : 'Assistant'
							return `${role}: ${msg.content}`
						})
						.join('\n\n')

					// Call Ollama API directly
					const responseText = await this.ollamaAPI.generateCompletion(
						finalConfig.model as string,
						formattedPrompt,
						{
							temperature: finalConfig.temperature,
							maxTokens: finalConfig.maxTokens
						}
					)

					// Process the response
					result = await processResponse(responseText)

					// Estimate token usage since Ollama doesn't provide this information
					const { promptTokens } = TokenCounter.countTokensInMessages(
						messages,
						enhancedSystem,
						finalConfig.model as string
					)

					const completionTokens = TokenCounter.countTokensInText(
						responseText,
						finalConfig.model as string
					)

					tokenUsage = {
						promptTokens,
						completionTokens,
						totalTokens: promptTokens + completionTokens
					}
				} else {
					throw new Error(`Unsupported engine: ${finalConfig.engine}`)
				}

				// Debug log the token usage
				this.reportingService.log({
					message: 'Token usage for AI interaction',
					engine: finalConfig.engine,
					model: finalConfig.model,
					tokenUsage,
					companyId,
					campaignId
				})

				// Always log the interaction and track usage after the API call,
				// regardless of whether any limits were exceeded
				if (companyId) {
					await this.aiInteractionService.logInteraction({
						companyId,
						campaignId,
						type: interactionType,
						config,
						messages,
						systemPrompt: system,
						response: JSON.stringify(result),
						tokensUsed: {
							input: tokenUsage.promptTokens,
							output: tokenUsage.completionTokens
						},
						documents: documents?.map((doc) => doc.content),
						metadata,
						contactId
					})
				}
				return result
			} catch (error: unknown) {
				const errorObj = error as Error
				lastError = errorObj

				// Check if we should retry this error
				if (
					attempt < RetryUtility.MAX_RETRIES &&
					RetryUtility.shouldRetry(error)
				) {
					const isOverloaded = RetryUtility.isOverloadedError(error)
					const delay = RetryUtility.calculateDelay(attempt, isOverloaded)

					this.reportingService.log({
						message: `Retrying AI request due to ${isOverloaded ? 'overloaded' : 'retryable'} error`,
						attempt: attempt + 1,
						maxRetries: RetryUtility.MAX_RETRIES,
						delay,
						error: errorObj.message,
						isOverloaded,
						companyId,
						campaignId
					})

					// Wait before retrying
					await RetryUtility.sleep(delay)
					continue
				}

				// If we shouldn't retry or have exhausted retries, throw the error
				this.reportingService.log({
					message: 'AI Client error (final)',
					attempt: attempt + 1,
					maxRetries: RetryUtility.MAX_RETRIES,
					error: errorObj.message,
					companyId,
					campaignId
				})
				throw new Error(`AI Client error: ${errorObj.message}`)
			}
		}

		// This should never be reached, but TypeScript requires it
		throw lastError || new Error('AI Client error: Unknown error occurred')
	}

	private async parseAndCleanResponse(
		content: string,
		schema: Record<string, any>
	) {
		const tryParseJson = (str: string) => {
			try {
				return JSON.parse(str)
			} catch {
				return null
			}
		}

		const stripMarkdown = (str: string) => {
			return str.replace(/```json\n?|\n?```/g, '').trim()
		}

		// Try to parse content after stripping any markdown
		const initialParsed = tryParseJson(stripMarkdown(content))
		if (!initialParsed) {
			// If parsing fails, create a default response based on schema
			return this.ensureValidResponse({}, schema)
		}

		// Check each string value in the parsed object for nested JSON
		const processNestedJson = (obj: any): any => {
			if (!obj || typeof obj !== 'object') return obj

			return Object.entries(obj).reduce(
				(acc: any, [key, value]) => {
					if (typeof value === 'string') {
						const parsedValue = tryParseJson(stripMarkdown(value))
						acc[key] = parsedValue || value
					} else if (Array.isArray(value)) {
						acc[key] = value.map((item) => processNestedJson(item))
					} else if (typeof value === 'object') {
						acc[key] = processNestedJson(value)
					} else {
						acc[key] = value
					}
					return acc
				},
				Array.isArray(obj) ? [] : {}
			)
		}

		// Process any nested JSON and ensure the response matches the schema
		const processedResponse = processNestedJson(initialParsed)
		return this.ensureValidResponse(processedResponse, schema)
	}

	async generateEmbedding(text: string) {
		try {
			// Approximate the token count as roughly 4 characters per token
			const approxTokenCount = Math.ceil(text.length / 4)

			// If text is likely to be under the token limit, process normally
			if (approxTokenCount <= 8000) {
				return this.embeddings.embedQuery(text)
			}

			// Otherwise, chunk the text and process the first chunk
			// This is a simple approach - for a more sophisticated implementation,
			// consider splitting by paragraphs or semantically meaningful sections
			const chunkSize = 7500 * 4 // Target ~7500 tokens to leave margin
			const truncatedText = text.substring(0, chunkSize)

			this.reportingService.log({
				message: 'Text truncated for embedding generation',
				originalLength: text.length,
				truncatedLength: truncatedText.length,
				approxOriginalTokens: approxTokenCount
			})

			return this.embeddings.embedQuery(truncatedText)
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			// Return a zero vector of appropriate size in case of error to avoid breaking the flow
			// Typical embedding size for OpenAI is 1536 dimensions
			return Array(1536).fill(0)
		}
	}

	/**
	 * Perform web search using AI with structured output
	 * Currently supports Anthropic models with web search capability
	 *
	 * @example
	 * ```typescript
	 * // Basic web search with default schema
	 * const result = await aiClient.webSearch({
	 *   query: "Latest TypeScript 5.5 features",
	 *   companyId: "company123",
	 *   enforceLimits: true
	 * });
	 *
	 * // Web search with custom schema
	 * const result = await aiClient.webSearch<{
	 *   summary: string;
	 *   keyFeatures: string[];
	 *   sources: string[];
	 * }>({
	 *   query: "TypeScript 5.5 new features",
	 *   system: "You are a technical research assistant. Provide detailed summaries of programming language features.",
	 *   config: {
	 *     engine: 'anthropic',
	 *     model: 'claude-3-5-sonnet-latest',
	 *     responseFormat: {
	 *       type: 'json_object',
	 *       schema: {
	 *         summary: 'string',
	 *         keyFeatures: ['string'],
	 *         sources: ['string']
	 *       }
	 *     }
	 *   },
	 *   webSearchOptions: {
	 *     maxUses: 3,
	 *     allowedDomains: ['typescriptlang.org', 'github.com']
	 *   },
	 *   companyId: "company123",
	 *   campaignId: "campaign456",
	 *   enforceLimits: true
	 * });
	 * ```
	 */
	async webSearch<T>({
		query,
		system = '',
		documents,
		config = {
			engine: 'anthropic',
			model: 'claude-3-5-sonnet-latest',
			maxTokens: 4000,
			temperature: 0.7,
			responseFormat: {
				type: 'json_object',
				schema: {
					answer: 'string',
					sources: ['string']
				}
			}
		},
		webSearchOptions = {
			maxUses: 3
		},
		companyId,
		campaignId,
		contactId,
		metadata = {},
		enforceLimits = false
	}: {
		query: string
		system?: string
		documents?: DocumentInfo[]
		config: AIConfig
		webSearchOptions?: {
			maxUses?: number
			allowedDomains?: string[]
			blockedDomains?: string[]
			userLocation?: {
				type: 'approximate'
				city: string
				region: string
				country: string
				timezone: string
			}
		}
		companyId: string
		campaignId?: string
		contactId?: string
		metadata?: Record<string, any>
		enforceLimits?: boolean
	}): Promise<T> {
		let lastError: Error | null = null

		for (let attempt = 0; attempt <= RetryUtility.MAX_RETRIES; attempt++) {
			try {
				// Validate that the engine and model support web search
				if (config.engine !== 'anthropic' && config.engine !== 'gemini') {
					throw new Error(
						'Web search is currently only supported with Anthropic and Gemini models'
					)
				}

				const anthropicWebSearchSupportedModels = [
					'claude-opus-4-20250514',
					'claude-sonnet-4-20250514',
					'claude-3-7-sonnet-20250219',
					'claude-3-5-sonnet-latest',
					'claude-3-5-haiku-latest'
				]

				const geminiWebSearchSupportedModels = ['gemini-2.0-flash']

				if (
					config.engine === 'anthropic' &&
					!anthropicWebSearchSupportedModels.includes(config.model as string)
				) {
					throw new Error(
						`Web search is not supported for Anthropic model: ${config.model}. Supported models: ${anthropicWebSearchSupportedModels.join(', ')}`
					)
				}

				if (
					config.engine === 'gemini' &&
					!geminiWebSearchSupportedModels.includes(config.model as string)
				) {
					throw new Error(
						`Web search is not supported for Gemini model: ${config.model}. Supported models: ${geminiWebSearchSupportedModels.join(', ')}`
					)
				}

				// Check limits before making the API call if enforcement is enabled
				if (enforceLimits) {
					this.reportingService.log({
						message: 'Checking AI interaction limits for web search',
						companyId,
						campaignId,
						enforcing: true
					})

					const limitsCheck =
						await this.aiInteractionService.checkLimitsBeforeInteraction({
							companyId,
							campaignId,
							interactionType: AIInteractionType.WEB_SEARCH
						})

					if (!limitsCheck.withinLimits) {
						this.reportingService.log({
							message: 'AI interaction limit exceeded for web search',
							companyId,
							campaignId,
							reason: limitsCheck.reason
						})
						throw new Error(`AI limit exceeded: ${limitsCheck.reason}`)
					}
				} else {
					this.reportingService.log({
						message:
							'Skipping AI interaction limits check for web search (not enforcing)',
						companyId,
						campaignId
					})
				}

				const finalConfig = {
					...config,
					temperature: config.temperature ?? 0.7,
					responseFormat: config.responseFormat ?? {
						type: 'json_object',
						schema: { answer: 'string', sources: ['string'] }
					}
				}

				// Setup schema parser for structured output
				const parser = await this.setupSchemaParser(
					finalConfig.responseFormat?.schema
				)

				let enhancedSystem = system

				// Process documents if provided
				if (documents?.length) {
					try {
						const documentContext = await this.processDocuments(documents)
						if (documentContext) {
							enhancedSystem = `${system}\n\nContext from provided documents:\n${documentContext}`
						}
					} catch (error) {
						this.reportingService.log({
							message: 'Warning: Error processing documents for web search',
							error
						})
						// Continue without document context rather than failing
					}
				}

				// Enhance system prompt for structured output
				if (parser && finalConfig.responseFormat?.schema) {
					enhancedSystem = this.createEnhancedSystemPrompt(
						enhancedSystem,
						parser,
						finalConfig.responseFormat.schema
					)
				}

				// Configure the Anthropic model for web search
				this.anthropicModel.temperature = finalConfig.temperature

				// Prepare the web search tool configuration
				const webSearchTool: any = {
					type: 'web_search_20250305',
					name: 'web_search',
					max_uses: webSearchOptions.maxUses || 5
				}

				// Add domain filtering if provided
				if (
					webSearchOptions.allowedDomains &&
					webSearchOptions.allowedDomains.length > 0
				) {
					// Clean and validate domains
					const cleanDomains = webSearchOptions.allowedDomains
						.filter((domain) => domain && typeof domain === 'string')
						.map((domain) => {
							// Remove protocol and trailing slashes
							return domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
						})
						.filter((domain) => domain.length > 0)

					if (cleanDomains.length > 0) {
						webSearchTool.allowed_domains = cleanDomains
					}
				}

				if (
					webSearchOptions.blockedDomains &&
					webSearchOptions.blockedDomains.length > 0
				) {
					// Clean and validate domains
					const cleanDomains = webSearchOptions.blockedDomains
						.filter((domain) => domain && typeof domain === 'string')
						.map((domain) => {
							// Remove protocol and trailing slashes
							return domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
						})
						.filter((domain) => domain.length > 0)

					if (cleanDomains.length > 0) {
						webSearchTool.blocked_domains = cleanDomains
					}
				}

				if (webSearchOptions.userLocation) {
					webSearchTool.user_location = webSearchOptions.userLocation
				}

				// Create messages array with the query
				const messages = [
					{
						role: 'user' as const,
						content: query
					}
				]

				// Make the API call with web search tool
				let response
				try {
					if (config.engine === 'anthropic') {
						response = await this.anthropicDirectAPI.createMessage({
							model: finalConfig.model as string,
							maxTokens: finalConfig.maxTokens || 4000,
							temperature: finalConfig.temperature,
							system: enhancedSystem,
							messages,
							tools: [webSearchTool]
						})
					} else if (config.engine === 'gemini') {
						// Configure Google Search grounding for Gemini
					// google_search is a Gemini-native grounding tool — typed as unknown to satisfy GeminiToolDeclaration
					const googleSearchTool = { google_search: {} } as unknown as import('@packages/clients/gemini-client').GeminiToolDeclaration

					const geminiMessages = messages.map((msg) => ({
						role: msg.role === 'user' ? GeminiRole.User : GeminiRole.Model,
						parts: [{ text: msg.content }]
					}))

						response = await this.geminiDirectAPI.generateContent({
							model: finalConfig.model as string,
							maxTokens: finalConfig.maxTokens || 4000,
							temperature: finalConfig.temperature,
							systemInstruction: enhancedSystem,
							messages: geminiMessages,
							tools: [googleSearchTool]
						})
					} else {
						throw new Error(
							`Unsupported engine for web search: ${config.engine}`
						)
					}
				} catch (error) {
					// Check if this is a domain blocking error
					if (
						(error as Error).message.includes(
							'not accessible to our user agent'
						)
					) {
						this.reportingService.log({
							message:
								'Some domains are blocked, retrying without domain restrictions',
							originalError: (error as Error).message,
							allowedDomains: webSearchTool.allowed_domains
						})

						// Retry without domain restrictions
						const fallbackTool: any = {
							type: 'web_search_20250305',
							name: 'web_search',
							max_uses: webSearchOptions.maxUses || 5
						}

						// Add other options except domain filtering
						if (webSearchOptions.userLocation) {
							fallbackTool.user_location = webSearchOptions.userLocation
						}

						try {
							response = await this.anthropicDirectAPI.createMessage({
								model: finalConfig.model as string,
								maxTokens: finalConfig.maxTokens || 4000,
								temperature: finalConfig.temperature,
								system: enhancedSystem,
								messages,
								tools: [fallbackTool]
							})
						} catch (fallbackError) {
							this.reportingService.log({
								message: 'Web search fallback also failed',
								error: fallbackError
							})
							throw fallbackError
						}
					} else {
						// Re-throw non-domain-blocking errors
						throw error
					}
				}

				// Process the response
				const processResponse = async (content: string): Promise<T> => {
					this.reportingService.log({
						message: 'Processing web search response',
						content
					})
					if (!parser || !finalConfig.responseFormat?.schema) {
						return content as T
					}

					try {
						const parsedContent = await parser.parse(content)
						return this.ensureValidResponse(
							parsedContent,
							finalConfig.responseFormat.schema
						)
					} catch (error) {
						this.reportingService.log({
							message: 'Parser error in web search, attempting cleanup',
							error
						})
						const cleanedResponse = await this.parseAndCleanResponse(
							content,
							finalConfig.responseFormat.schema
						)
						return this.ensureValidResponse(
							cleanedResponse,
							finalConfig.responseFormat.schema
						)
					}
				}

				// Extract the text content from the API response
				let responseText = ''
				if (config.engine === 'anthropic') {
					if (response.content && Array.isArray(response.content)) {
						// Find text content blocks and concatenate them
						const textBlocks = response.content.filter(
							(block: any) => block.type === 'text'
						)
						responseText = textBlocks.map((block: any) => block.text).join(' ')
					} else if (typeof response.content === 'string') {
						responseText = response.content
					}
				} else if (config.engine === 'gemini') {
					// Extract text from Gemini response
					responseText =
						response.candidates?.[0]?.content?.parts?.[0]?.text || ''
				}

				const result = await processResponse(responseText)

				// Extract token usage and web search requests from the response
				let tokenUsage = {
					promptTokens: 0,
					completionTokens: 0,
					totalTokens: 0
				}
				let webSearchRequests = 0

				// Get token count from API response
				if (config.engine === 'anthropic' && response.usage) {
					const usage = response.usage
					tokenUsage = {
						promptTokens: usage.input_tokens || 0,
						completionTokens: usage.output_tokens || 0,
						totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0)
					}

					// Extract web search requests from server_tool_use
					if (usage.server_tool_use?.web_search_requests) {
						webSearchRequests = usage.server_tool_use.web_search_requests
					}
				} else if (config.engine === 'gemini' && response.usageMetadata) {
					const usage = response.usageMetadata
					tokenUsage = {
						promptTokens: usage.promptTokenCount || 0,
						completionTokens: usage.candidatesTokenCount || 0,
						totalTokens: usage.totalTokenCount || 0
					}

					// For Gemini, grounding requests are typically 1 per query
					webSearchRequests = 1
				} else {
					// Fallback to TokenCounter if usage data is not available
					this.reportingService.log({
						message:
							'Warning: Could not find token usage in web search response',
						responseKeys: Object.keys(response || {}),
						modelName: finalConfig.model,
						engine: config.engine
					})

					const { promptTokens } = TokenCounter.countTokensInMessages(
						messages.map((msg) => ({ role: msg.role, content: msg.content })),
						enhancedSystem,
						finalConfig.model as string
					)

					const completionTokens = TokenCounter.countTokensInText(
						responseText,
						finalConfig.model as string
					)

					tokenUsage = {
						promptTokens,
						completionTokens,
						totalTokens: promptTokens + completionTokens
					}

					// Estimate web search requests (minimum 1 if we made it this far)
					webSearchRequests = 1
				}

				// Debug log the token usage and web search requests
				this.reportingService.log({
					message: 'Token usage and web search requests',
					engine: finalConfig.engine,
					model: finalConfig.model,
					tokenUsage,
					webSearchRequests,
					companyId,
					campaignId
				})

				// Always log the interaction and track usage after the API call
				await this.aiInteractionService.logInteraction({
					companyId,
					campaignId,
					type: AIInteractionType.WEB_SEARCH,
					config: finalConfig,
					messages: messages.map((msg) => ({
						role: msg.role,
						content: msg.content
					})),
					systemPrompt: system,
					response: JSON.stringify(result),
					tokensUsed: {
						input: tokenUsage.promptTokens,
						output: tokenUsage.completionTokens
					},
					documents: documents?.map((doc) => doc.content),
					metadata: {
						...metadata,
						query,
						webSearchOptions
					},
					contactId,
					webSearchRequests
				})

				return result
			} catch (error: unknown) {
				const errorObj = error as Error
				lastError = errorObj

				// Check if we should retry this error
				if (
					attempt < RetryUtility.MAX_RETRIES &&
					RetryUtility.shouldRetry(error)
				) {
					const isOverloaded = RetryUtility.isOverloadedError(error)
					const delay = RetryUtility.calculateDelay(attempt, isOverloaded)

					this.reportingService.log({
						message: `Retrying web search due to ${isOverloaded ? 'overloaded' : 'retryable'} error`,
						attempt: attempt + 1,
						maxRetries: RetryUtility.MAX_RETRIES,
						delay,
						error: errorObj.message,
						isOverloaded,
						companyId,
						campaignId
					})

					// Wait before retrying
					await RetryUtility.sleep(delay)
					continue
				}

				// If we shouldn't retry or have exhausted retries, throw the error
				this.reportingService.log({
					message: 'AI Client web search error (final)',
					attempt: attempt + 1,
					maxRetries: RetryUtility.MAX_RETRIES,
					error: errorObj.message,
					companyId,
					campaignId
				})
				throw new Error(`AI Client web search error: ${errorObj.message}`)
			}
		}

		// This should never be reached, but TypeScript requires it
		throw (
			lastError ||
			new Error('AI Client web search error: Unknown error occurred')
		)
	}

	/**
	 * Cached conversation method optimized for Anthropic prompt caching
	 * Structures prompts to maximize cache hits for static content
	 */
	async cachedConversation<T>({
		staticSystem,
		dynamicSystem,
		staticContent,
		dynamicMessages,
		config = {
			engine: 'anthropic',
			model: 'claude-3-5-sonnet-latest',
			maxTokens: 4000,
			temperature: 0.7,
			enableCaching: true,
			cacheControl: {
				type: 'ephemeral',
				ttlHours: 1
			}
		},
		companyId,
		campaignId,
		contactId,
		interactionType = AIInteractionType.GENERAL,
		metadata = {},
		enforceLimits = false
	}: {
		staticSystem?: string // Static system instructions (cached)
		dynamicSystem?: string // Dynamic system instructions (not cached)
		staticContent?: string // Static content to cache (e.g., learning insights)
		dynamicMessages: AIMessage[] // Dynamic user content
		config: AIConfig & { enableCaching?: boolean }
		companyId: string
		campaignId?: string
		contactId?: string
		interactionType?: AIInteractionType
		metadata?: Record<string, any>
		enforceLimits?: boolean
	}): Promise<T> {
		// Only use caching with Anthropic engine
		if (config.engine !== 'anthropic' || !config.enableCaching) {
			// Fallback to regular conversation method
			const combinedSystem = [staticSystem, dynamicSystem]
				.filter(Boolean)
				.join('\n\n')
			const allMessages = [
				...(staticContent
					? [{ role: 'system' as const, content: staticContent }]
					: []),
				...dynamicMessages
			]

			return this.conversation({
				system: combinedSystem,
				messages: allMessages,
				config,
				companyId,
				campaignId,
				contactId,
				interactionType,
				metadata,
				enforceLimits
			})
		}

		try {
			// Check limits if enforcement is enabled
			if (enforceLimits) {
				const limitsCheck =
					await this.aiInteractionService.checkLimitsBeforeInteraction({
						companyId,
						campaignId,
						interactionType
					})

				if (!limitsCheck.withinLimits) {
					throw new Error(`AI limit exceeded: ${limitsCheck.reason}`)
				}
			}

			// Build system prompt array with cache control for static content
			const systemArray: Array<{
				type: 'text'
				text: string
				cache_control?: { type: 'ephemeral' }
			}> = []

			if (staticSystem) {
				systemArray.push({
					type: 'text',
					text: staticSystem,
					cache_control: { type: 'ephemeral' } // Cache static system instructions
				})
			}

			if (staticContent) {
				systemArray.push({
					type: 'text',
					text: staticContent,
					cache_control: { type: 'ephemeral' } // Cache static content like learning insights
				})
			}

			if (dynamicSystem) {
				systemArray.push({
					type: 'text',
					text: dynamicSystem
					// No cache control for dynamic content
				})
			}

			const response = await this.anthropicDirectAPI.createMessage({
				model: config.model as string,
				maxTokens: config.maxTokens || 4000,
				temperature: config.temperature || 0.7,
				messages: dynamicMessages
					.filter((msg) => msg.role !== 'system')
					.map((msg) => ({
						role: msg.role as 'user' | 'assistant',
						content: msg.content
					})),
				systemArray: systemArray.length > 0 ? systemArray : undefined
			})

			// Log cache performance metrics
			const usage = response.usage || {}
			this.reportingService.log({
				message: 'Anthropic cache performance',
				model: config.model,
				cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
				cache_read_input_tokens: usage.cache_read_input_tokens || 0,
				input_tokens: usage.input_tokens || 0,
				output_tokens: usage.output_tokens || 0,
				total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
				cache_hit_rate:
					usage.cache_read_input_tokens > 0
						? (usage.cache_read_input_tokens /
								(usage.cache_read_input_tokens +
									(usage.cache_creation_input_tokens || 0))) *
							100
						: 0,
				estimated_cost_savings_percent:
					usage.cache_read_input_tokens > 0 ? 90 : 0, // 90% savings on cached tokens
				companyId,
				campaignId,
				interactionType
			})

			// Record AI interaction for tracking
			await this.aiInteractionService.logInteraction({
				companyId,
				campaignId,
				contactId,
				type: interactionType,
				config,
				messages: dynamicMessages,
				systemPrompt: systemArray.map((s) => s.text).join('\n'),
				response: response.content?.[0]?.text || '',
				tokensUsed: {
					input: usage.input_tokens || 0,
					output: usage.output_tokens || 0
				},
				metadata: {
					...metadata,
					cachePerformance: {
						cacheHitTokens: usage.cache_read_input_tokens || 0,
						cacheCreationTokens: usage.cache_creation_input_tokens || 0,
						cacheHitRate:
							usage.cache_read_input_tokens > 0
								? (usage.cache_read_input_tokens /
										(usage.cache_read_input_tokens +
											(usage.cache_creation_input_tokens || 0))) *
									100
								: 0,
						estimatedCostSavingsPercent:
							(response as any).usage?.estimated_cost_savings_percent || 0
					}
				}
			})

			// Process response
			const content = response.content?.[0]?.text || ''

			if (config.responseFormat?.schema) {
				try {
					const parser = await this.setupSchemaParser(
						config.responseFormat.schema
					)
					if (parser) {
						const parsedContent = await parser.parse(content)
						return this.ensureValidResponse(
							parsedContent,
							config.responseFormat.schema
						)
					}
				} catch (error) {
					this.reportingService.log({
						message: 'Parser error, attempting cleanup',
						error
					})
					const cleanedResponse = await this.parseAndCleanResponse(
						content,
						config.responseFormat.schema
					)
					return this.ensureValidResponse(
						cleanedResponse,
						config.responseFormat.schema
					)
				}
			}

			return content as T
		} catch (error) {
			this.reportingService.reportError({ error: error as Error })
			this.reportingService.log({
				message: 'Error in cachedConversation',
				tags: { context: 'cachedConversation.anthropic' },
				model: config.model,
				companyId,
				campaignId,
				contactId,
				enableCaching: config.enableCaching
			})
			throw error
		}
	}
}
