import { injectable, inject, singleton } from 'tsyringe'

import type { TrainingSessionFilter } from '@packages/repositories/trainingSession/TrainingSessionRepository'
import { TrainingSessionRepository } from '@packages/repositories/trainingSession/TrainingSessionRepository'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import type { TrainingSessionInterface } from '@packages/types/trainingSession'

@injectable()
@singleton()
@ReportErrors()
export class TrainingSessionService {
	constructor(
		@inject(TrainingSessionRepository) private trainingSessionRepository: TrainingSessionRepository,
		@inject(ReportingService) private reportingService: ReportingService
	) {}

	public async createTrainingSession({ data }: {
		data: Pick<TrainingSessionInterface, 'teamId' | 'companyId' | 'name' | 'date' | 'type' | 'createdByUserId'>
	}): Promise<TrainingSessionInterface> {
		return this.trainingSessionRepository.create({ data })
	}

	public async findTrainingSession({ filter, loadVideos }: {
		filter: TrainingSessionFilter
		loadVideos?: boolean
	}): Promise<TrainingSessionInterface | null> {
		return this.trainingSessionRepository.findOne({ filter, loadVideos })
	}

	public async findTrainingSessionOrFail({ filter }: {
		filter: TrainingSessionFilter
	}): Promise<TrainingSessionInterface> {
		const session = await this.trainingSessionRepository.findOne({ filter })
		if (!session) {
			const error = new Error(`No training session found with filter: ${JSON.stringify(filter)}`)
			this.reportingService.reportError({ error })
			throw error
		}
		return session
	}

	public async findTrainingSessions({ filter }: {
		filter: TrainingSessionFilter
	}): Promise<TrainingSessionInterface[]> {
		return this.trainingSessionRepository.find({ filter })
	}

	public async updateTrainingSession({ filter, data }: {
		filter: TrainingSessionFilter
		data: Partial<Pick<TrainingSessionInterface, 'name' | 'date' | 'type'>>
	}): Promise<TrainingSessionInterface | null> {
		return this.trainingSessionRepository.update({ filter, data })
	}

	public async deleteTrainingSession({ filter }: {
		filter: TrainingSessionFilter
	}): Promise<boolean> {
		return this.trainingSessionRepository.delete({ filter })
	}
}
