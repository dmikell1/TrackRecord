import type { CoachingLevel, EventGroup, TrackEvent } from '@packages/enums/trackRecord'

export interface TeamSettingsInterface {
	units?: 'imperial' | 'metric'
	inviteToken?: string
	coachingLevels?: CoachingLevel[]
	focusedEventGroups?: EventGroup[]
	enabledEvents?: TrackEvent[]
}
