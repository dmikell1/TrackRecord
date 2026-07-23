import { container } from 'tsyringe'

import { COACH_LIFECYCLE_PROCESS_INTERVAL_MS } from '@packages/enums'
import { CoachLifecycleEmailService } from '@packages/services/email/CoachLifecycleEmailService'
import { ReportingService } from '@packages/services/logging/ReportingService'

let intervalHandle: ReturnType<typeof setInterval> | null = null

/**
 * Polls for due coach lifecycle emails. Used while Bull/Redis delayed jobs
 * are disabled — keeps product-aware drip sends working in-process.
 */
export const startCoachLifecycleEmailProcessor = (): void => {
	if (intervalHandle !== null) {
		return
	}

	const reportingService = container.resolve(ReportingService)
	const lifecycleService = container.resolve(CoachLifecycleEmailService)

	const tick = async (): Promise<void> => {
		try {
			const processed = await lifecycleService.processDueJobs()
			if (processed > 0) {
				reportingService.log({
					message: 'Processed coach lifecycle email jobs',
					processed
				})
			}
		} catch (error) {
			reportingService.reportError({ error: error as Error })
		}
	}

	void tick()
	intervalHandle = setInterval(() => {
		void tick()
	}, COACH_LIFECYCLE_PROCESS_INTERVAL_MS)

	reportingService.log({
		message: 'Coach lifecycle email processor started',
		intervalMs: COACH_LIFECYCLE_PROCESS_INTERVAL_MS
	})
}
