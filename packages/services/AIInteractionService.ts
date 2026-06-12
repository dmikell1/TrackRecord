import { inject, injectable, singleton } from 'tsyringe'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { AIInteractionType } from '@packages/types/AIInteraction'
import { AIConfig } from '@packages/clients/ai-client'
import { AIMessage } from '@packages/types'

@injectable()
@singleton()
@ReportErrors()
export class AIInteractionService {
	constructor(
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	public async checkLimitsBeforeInteraction({
		companyId,
		campaignId,
		interactionType
	}: {
		companyId: string
		campaignId?: string
		interactionType: AIInteractionType
	}): Promise<{ withinLimits: boolean; reason?: string }> {
		// Stub implementation - always return within limits
		this.reportingService.log({
			message: 'Checking AI interaction limits',
			companyId,
			campaignId,
			interactionType
		})
		return { withinLimits: true }
	}

	public async logInteraction({
		companyId,
		campaignId,
		contactId,
		type,
		config: _config,
		messages: _messages,
		systemPrompt: _systemPrompt,
		response: _response,
		tokensUsed,
		documents: _documents,
		metadata: _metadata,
		webSearchRequests
	}: {
		companyId: string
		campaignId?: string
		contactId?: string
		type: AIInteractionType
		config: AIConfig
		messages: AIMessage[]
		systemPrompt: string
		response: string
		tokensUsed: {
			input: number
			output: number
		}
		documents?: string[]
		metadata?: Record<string, any>
		webSearchRequests?: number
	}): Promise<void> {
		// Stub implementation - just log the interaction
		this.reportingService.log({
			message: 'AI interaction logged',
			companyId,
			campaignId,
			contactId,
			type,
			tokensUsed,
			webSearchRequests
		})
	}
}
