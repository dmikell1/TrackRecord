import { container } from 'tsyringe'

import { TeamEventSettingsService } from '@packages/services/team/TeamEventSettingsService'
import type { TeamInterface } from '@packages/types/team'
import type { TeamSettingsInterface } from '@packages/types/teamSettings'

export const Team = {
	settings: ({ settings }: TeamInterface): TeamSettingsInterface => {
		const teamEventSettingsService = container.resolve(TeamEventSettingsService)
		return teamEventSettingsService.normalizeSettings({ settings })
	}
}
