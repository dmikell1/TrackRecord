import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'

import { container, injectable, singleton } from 'tsyringe'

@ReportErrors()
@singleton()
@injectable()
export class SlackService {
	public async sendSlackMessage({
		url,
		message
	}: {
		url: string
		message: string
	}): Promise<void> {
		const reportingService = container.resolve(ReportingService)
		reportingService.log({
			message: `Slack message to ${url}`,
			url,
			messageContent: message
		})
	}
}

export default new SlackService()
