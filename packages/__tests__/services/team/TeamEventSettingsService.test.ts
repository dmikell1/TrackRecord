import { AccountHolderType, CoachingLevel, EventGroup } from '@packages/enums/trackRecord'
import { TeamEventSettingsService } from '@packages/services/team/TeamEventSettingsService'

describe('TeamEventSettingsService', () => {
	const service = new TeamEventSettingsService()

	describe('normalizeSettings', () => {
		it('should preserve accountHolderType when provided', () => {
			const result = service.normalizeSettings({
				settings: {
					accountHolderType: AccountHolderType.Parent,
					coachingLevels: [CoachingLevel.HighSchool],
					focusedEventGroups: [EventGroup.Throws],
					enabledEvents: []
				}
			})

			expect(result.accountHolderType).toBe(AccountHolderType.Parent)
		})
	})
})
