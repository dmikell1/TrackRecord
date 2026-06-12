import { randomUUID } from 'crypto'
import Chance from 'chance'

import { TeamRepository } from '@packages/repositories/team/TeamRepository'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { TeamService } from '@packages/services/team/TeamService'
import { TeamInterface } from '@packages/types'

const chance = new Chance(String(process.env.CHANCE_SEED))

export const buildMockTeam = (
	overrides: Partial<TeamInterface> = {}
): TeamInterface => ({
	id: randomUUID(),
	name: chance.company(),
	companyId: randomUUID(),
	ownerId: randomUUID(),
	settings: {
		units: 'imperial',
		coachingLevels: [],
		focusedEventGroups: [],
		enabledEvents: []
	},
	createdAt: new Date(),
	updatedAt: new Date(),
	...overrides
})

export const createMockTeamData = (
	overrides: Partial<TeamInterface> = {}
): Pick<TeamInterface, 'name' | 'ownerId' | 'companyId'> => ({
	name: chance.company(),
	ownerId: overrides.ownerId ?? '',
	companyId: overrides.companyId ?? '',
	...overrides
})

export const createMockTeamRepository = (): jest.Mocked<TeamRepository> =>
	({
		create: jest.fn(),
		findOne: jest.fn(),
		find: jest.fn(),
		update: jest.fn(),
		delete: jest.fn(),
		count: jest.fn()
	}) as unknown as jest.Mocked<TeamRepository>

export const createMockTeamService = (): jest.Mocked<TeamService> =>
	({
		createTeam: jest.fn(),
		findTeam: jest.fn(),
		findTeams: jest.fn(),
		findTeamOrFail: jest.fn(),
		updateTeam: jest.fn(),
		deleteTeam: jest.fn(),
		countTeams: jest.fn()
	}) as unknown as jest.Mocked<TeamService>

const createMockReportingService = (): jest.Mocked<ReportingService> =>
	({
		reportError: jest.fn()
	}) as unknown as jest.Mocked<ReportingService>

export const createTestTeamService = (): TeamService => {
	const mockTeamRepository = createMockTeamRepository()
	return new TeamService(mockTeamRepository, createMockReportingService())
}

export const setupTestTeam = async ({
	teamRepository,
	overrides = {}
}: {
	teamRepository: TeamRepository
	overrides?: Partial<Pick<TeamInterface, 'name' | 'ownerId' | 'companyId'>>
}): Promise<TeamInterface> => {
	const data = createMockTeamData(overrides)
	if (!data.ownerId || !data.companyId) {
		throw new Error('setupTestTeam requires ownerId and companyId')
	}
	return teamRepository.create({
		data: {
			name: data.name,
			ownerId: data.ownerId,
			companyId: data.companyId
		}
	})
}
