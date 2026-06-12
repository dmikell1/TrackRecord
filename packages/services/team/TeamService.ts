import crypto from 'crypto'
import { injectable, inject, singleton } from 'tsyringe'

import type { TeamFilter } from '@packages/repositories/team/TeamRepository'
import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { TeamEventSettingsService } from '@packages/services/team/TeamEventSettingsService'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { TeamInterface } from '@packages/types'
import type { TeamSettingsInterface } from '@packages/types/teamSettings'

interface CreateTeamData {
	name: string
	ownerId: string
	companyId: string
}

@injectable()
@singleton()
@ReportErrors()
export class TeamService {
	constructor(
		@inject(TeamRepository) private teamRepository: TeamRepository,
		@inject(TeamEventSettingsService)
		private teamEventSettingsService: TeamEventSettingsService,
		@inject(ReportingService)
		private reportingService: ReportingService
	) {}

	public async createTeam({
		teamData
	}: {
		teamData: CreateTeamData
	}): Promise<TeamInterface> {
		return this.teamRepository.create({
			data: {
				name: teamData.name,
				ownerId: teamData.ownerId,
				companyId: teamData.companyId
			}
		})
	}

	public async findTeam({
		filter
	}: {
		filter: TeamFilter
	}): Promise<TeamInterface | null> {
		return this.teamRepository.findOne({ filter })
	}

	public async findTeams({
		filter
	}: {
		filter: TeamFilter
	}): Promise<TeamInterface[]> {
		return this.teamRepository.find({ filter })
	}

	public async findTeamOrFail({
		filter
	}: {
		filter: TeamFilter
	}): Promise<TeamInterface> {
		const team = await this.teamRepository.findOne({ filter })
		if (!team) {
			const error = new Error(
				`No team found with filter: ${JSON.stringify(filter)}`
			)
			this.reportingService.reportError({ error })
			throw error
		}

		return team
	}

	public async updateTeam({
		filter,
		data
	}: {
		filter: TeamFilter
		data: Partial<Pick<TeamInterface, 'name' | 'settings'>>
	}): Promise<TeamInterface | null> {
		return this.teamRepository.update({ filter, data })
	}

	public async updateTeamSettings({ id, settings }: {
		id: string
		settings: Partial<TeamSettingsInterface>
	}): Promise<TeamInterface | null> {
		const team = await this.findTeam({ filter: { id } })
		if (!team) {
			return null
		}

		const merged = this.teamEventSettingsService.normalizeSettings({
			settings: {
				...team.settings,
				...settings
			}
		})

		if (settings.enabledEvents !== undefined) {
			this.teamEventSettingsService.validateEnabledEvents({
				settings: merged,
				enabledEvents: settings.enabledEvents
			})
		}

		return this.teamRepository.updateSettings({ id, settings: merged })
	}

	public async deleteTeam({
		filter
	}: {
		filter: TeamFilter
	}): Promise<boolean> {
		return this.teamRepository.delete({ filter })
	}

	public async countTeams({
		filter
	}: {
		filter: TeamFilter
	}): Promise<number> {
		return this.teamRepository.count({ filter })
	}

	public async getOrCreateInviteToken({
		teamId
	}: {
		teamId: string
	}): Promise<string> {
		const team = await this.findTeamOrFail({ filter: { id: teamId } })

		if (team.settings?.inviteToken) {
			return team.settings.inviteToken
		}

		const inviteToken = crypto.randomUUID()
		const updated = await this.updateTeamSettings({
			id: teamId,
			settings: { inviteToken }
		})

		if (!updated?.settings?.inviteToken) {
			throw new Error('Failed to create team invite link')
		}

		return updated.settings.inviteToken
	}
}
