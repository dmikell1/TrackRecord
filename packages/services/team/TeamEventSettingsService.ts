import { injectable, singleton } from 'tsyringe'

import {
	getDefaultEnabledEvents,
	getEventCatalog,
	getLegacyFieldEvents
} from '@packages/constants/trackEventCatalog'
import {
	CoachingLevel,
	EventGroup,
	TrackEvent
} from '@packages/enums/trackRecord'
import ReportErrors from '@packages/services/logging/decorators/reportErrors'
import type { TeamSettingsInterface } from '@packages/types/teamSettings'

@injectable()
@singleton()
@ReportErrors()
export class TeamEventSettingsService {
	public normalizeSettings({
		settings
	}: {
		settings: TeamSettingsInterface | null | undefined
	}): TeamSettingsInterface {
		const coachingLevels = settings?.coachingLevels ?? []
		const focusedEventGroups = settings?.focusedEventGroups ?? []
		const enabledEvents =
			settings?.enabledEvents && settings.enabledEvents.length > 0
				? settings.enabledEvents
				: getLegacyFieldEvents()

		return {
			...(settings?.units !== undefined && { units: settings.units }),
			...(settings?.inviteToken !== undefined && {
				inviteToken: settings.inviteToken
			}),
			...(settings?.accountHolderType !== undefined && {
				accountHolderType: settings.accountHolderType
			}),
			coachingLevels,
			focusedEventGroups,
			enabledEvents
		}
	}

	public buildOnboardingSettings({
		coachingLevels,
		focusedEventGroups,
		units
	}: {
		coachingLevels: CoachingLevel[]
		focusedEventGroups: EventGroup[]
		units?: 'imperial' | 'metric'
	}): TeamSettingsInterface {
		if (coachingLevels.length === 0) {
			throw new Error('Select at least one coaching level')
		}

		if (focusedEventGroups.length === 0) {
			throw new Error('Select at least one event focus area')
		}

		const enabledEvents = getDefaultEnabledEvents({
			levels: coachingLevels,
			focusedGroups: focusedEventGroups
		})

		if (enabledEvents.length === 0) {
			throw new Error('No events match the selected level and focus areas')
		}

		return {
			...(units !== undefined && { units }),
			coachingLevels,
			focusedEventGroups,
			enabledEvents
		}
	}

	public getAvailableEvents({
		settings
	}: {
		settings: TeamSettingsInterface
	}): TrackEvent[] {
		const levels = settings.coachingLevels ?? []
		if (levels.length === 0) {
			return getLegacyFieldEvents()
		}

		return getEventCatalog({ levels })
	}

	public validateSettingsUpdate({
		settings
	}: {
		settings: TeamSettingsInterface
	}): void {
		const coachingLevels = settings.coachingLevels ?? []
		const focusedEventGroups = settings.focusedEventGroups ?? []
		const enabledEvents = settings.enabledEvents ?? []

		if (coachingLevels.length === 0) {
			throw new Error('Select at least one coaching level')
		}

		if (focusedEventGroups.length === 0) {
			throw new Error('Select at least one event focus area')
		}

		this.validateEnabledEvents({
			settings,
			enabledEvents
		})
	}

	public validateEnabledEvents({
		settings,
		enabledEvents
	}: {
		settings: TeamSettingsInterface
		enabledEvents: TrackEvent[]
	}): void {
		if (enabledEvents.length === 0) {
			throw new Error('Enable at least one event')
		}

		const available = new Set(this.getAvailableEvents({ settings }))
		const invalid = enabledEvents.filter(event => !available.has(event))
		if (invalid.length > 0) {
			throw new Error(`Events are not available for this team: ${invalid.join(', ')}`)
		}
	}

	public isEventEnabled({
		settings,
		event
	}: {
		settings: TeamSettingsInterface
		event: TrackEvent | string
	}): boolean {
		const normalized = this.normalizeSettings({ settings })
		return normalized.enabledEvents?.includes(event as TrackEvent) ?? false
	}
}
