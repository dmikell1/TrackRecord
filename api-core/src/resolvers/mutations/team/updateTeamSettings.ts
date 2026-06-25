import type { AccountHolderType, CoachingLevel, EventGroup, TrackEvent } from '@packages/enums/trackRecord'
import type { Context } from '@packages/types'
import type { TeamInterface } from '@packages/types/team'

interface UpdateTeamSettingsArgs {
	team: string
	settings: {
		units?: string
		accountHolderType?: AccountHolderType
		coachingLevels?: CoachingLevel[]
		focusedEventGroups?: EventGroup[]
		enabledEvents?: TrackEvent[]
	}
}

export const updateTeamSettings = async (
	_parent: unknown,
	{ team, settings }: UpdateTeamSettingsArgs,
	{ teamService, reportingService }: Context
): Promise<TeamInterface> => {
	reportingService.startTrace({ op: 'updateTeamSettings', name: 'updateTeamSettings' })
	try {
		const updated = await teamService.updateTeamSettings({
			id: team,
			settings: {
				...(settings.units !== undefined && {
					units: settings.units as 'imperial' | 'metric'
				}),
				...(settings.accountHolderType !== undefined && {
					accountHolderType: settings.accountHolderType
				}),
				...(settings.coachingLevels !== undefined && {
					coachingLevels: settings.coachingLevels
				}),
				...(settings.focusedEventGroups !== undefined && {
					focusedEventGroups: settings.focusedEventGroups
				}),
				...(settings.enabledEvents !== undefined && {
					enabledEvents: settings.enabledEvents
				})
			}
		})
		if (!updated) throw new Error('Team not found')
		return updated
	} catch (e) {
		reportingService.reportError({ error: e as Error })
		throw new Error((e as Error).message)
	} finally {
		reportingService.endTrace()
	}
}
