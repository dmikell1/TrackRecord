import {
	CoachingLevel,
	EventGroup,
	ScoringDirection,
	TrackEvent
} from '@packages/enums/trackRecord'

export interface TrackEventMetadata {
	event: TrackEvent
	label: string
	shortLabel: string
	groups: EventGroup[]
	levels: CoachingLevel[]
	scoringDirection: ScoringDirection
}

const field = (
	event: TrackEvent,
	label: string,
	shortLabel: string,
	group: EventGroup,
	levels: CoachingLevel[],
	scoringDirection: ScoringDirection
): TrackEventMetadata => ({
	event,
	label,
	shortLabel,
	groups: [group],
	levels,
	scoringDirection
})

const timed = (
	event: TrackEvent,
	label: string,
	shortLabel: string,
	groups: EventGroup[],
	levels: CoachingLevel[]
): TrackEventMetadata => ({
	event,
	label,
	shortLabel,
	groups,
	levels,
	scoringDirection: ScoringDirection.Lower
})

const MS = CoachingLevel.MiddleSchool
const HS = CoachingLevel.HighSchool
const COL = CoachingLevel.College
const PRO = CoachingLevel.Professional
const CLUB = CoachingLevel.Club

const HS_AND_UP: CoachingLevel[] = [HS, COL, PRO, CLUB]
const COL_AND_UP: CoachingLevel[] = [COL, PRO, CLUB]
const ALL_LEVELS: CoachingLevel[] = [MS, HS, COL, PRO, CLUB]

export const TRACK_EVENT_CATALOG: TrackEventMetadata[] = [
	field(TrackEvent.HighJump, 'High jump', 'HJ', EventGroup.VerticalJumps, ALL_LEVELS, ScoringDirection.Higher),
	field(TrackEvent.PoleVault, 'Pole vault', 'PV', EventGroup.VerticalJumps, HS_AND_UP, ScoringDirection.Higher),
	field(TrackEvent.LongJump, 'Long jump', 'LJ', EventGroup.HorizontalJumps, ALL_LEVELS, ScoringDirection.Higher),
	field(TrackEvent.TripleJump, 'Triple jump', 'TJ', EventGroup.HorizontalJumps, HS_AND_UP, ScoringDirection.Higher),
	field(TrackEvent.ShotPut, 'Shot put', 'SP', EventGroup.Throws, ALL_LEVELS, ScoringDirection.Higher),
	field(TrackEvent.Discus, 'Discus', 'Disc', EventGroup.Throws, HS_AND_UP, ScoringDirection.Higher),
	field(TrackEvent.Javelin, 'Javelin', 'Jav', EventGroup.Throws, HS_AND_UP, ScoringDirection.Higher),
	field(TrackEvent.Hammer, 'Hammer', 'Hmr', EventGroup.Throws, HS_AND_UP, ScoringDirection.Higher),

	timed(TrackEvent.M60, '60m', '60m', [EventGroup.Sprints], HS_AND_UP),
	timed(TrackEvent.M100, '100m', '100m', [EventGroup.Sprints], ALL_LEVELS),
	timed(TrackEvent.M200, '200m', '200m', [EventGroup.Sprints], ALL_LEVELS),
	timed(TrackEvent.M300, '300m', '300m', [EventGroup.Sprints], HS_AND_UP),
	timed(TrackEvent.M400, '400m', '400m', [EventGroup.Sprints], ALL_LEVELS),
	timed(TrackEvent.M500, '500m', '500m', [EventGroup.Sprints, EventGroup.MiddleDistance], HS_AND_UP),
	timed(TrackEvent.M600, '600m', '600m', [EventGroup.Sprints, EventGroup.MiddleDistance], HS_AND_UP),

	timed(TrackEvent.M800, '800m', '800m', [EventGroup.MiddleDistance], ALL_LEVELS),
	timed(TrackEvent.M1000, '1000m', '1000m', [EventGroup.MiddleDistance], HS_AND_UP),
	timed(TrackEvent.M1500, '1500m', '1500m', [EventGroup.Distance], COL_AND_UP),
	timed(TrackEvent.M1600, '1600m', '1600m', [EventGroup.Distance], HS_AND_UP),
	timed(TrackEvent.M3000, '3000m', '3000m', [EventGroup.Distance], COL_AND_UP),
	timed(TrackEvent.M3200, '3200m', '3200m', [EventGroup.Distance], HS_AND_UP),
	timed(TrackEvent.M5000, '5000m', '5000m', [EventGroup.Distance], COL_AND_UP),
	timed(TrackEvent.M10000, '10,000m', '10k', [EventGroup.Distance], COL_AND_UP),
	timed(TrackEvent.Mile, 'Mile', 'Mile', [EventGroup.Distance], HS_AND_UP),
	timed(TrackEvent.TwoMile, '2 mile', '2 mi', [EventGroup.Distance], HS_AND_UP),

	timed(TrackEvent.M60H, '60m hurdles', '60mH', [EventGroup.Hurdles], HS_AND_UP),
	timed(TrackEvent.M100H, '100m hurdles', '100mH', [EventGroup.Hurdles], ALL_LEVELS),
	timed(TrackEvent.M110H, '110m hurdles', '110mH', [EventGroup.Hurdles], HS_AND_UP),
	timed(TrackEvent.M300H, '300m hurdles', '300mH', [EventGroup.Hurdles], HS_AND_UP),
	timed(TrackEvent.M400H, '400m hurdles', '400mH', [EventGroup.Hurdles], HS_AND_UP),
	timed(TrackEvent.M300IH, '300m intermediate hurdles', '300mIH', [EventGroup.Hurdles], HS_AND_UP),
	timed(TrackEvent.M400LH, '400m low hurdles', '400mLH', [EventGroup.Hurdles], [MS, HS]),
	timed(TrackEvent.Steeplechase, '3000m steeplechase', 'Stpl', [EventGroup.Hurdles, EventGroup.Specialty], COL_AND_UP),

	timed(TrackEvent.M4x100, '4×100m', '4×100', [EventGroup.Relays], HS_AND_UP),
	timed(TrackEvent.M4x200, '4×200m', '4×200', [EventGroup.Relays], HS_AND_UP),
	timed(TrackEvent.M4x400, '4×400m', '4×400', [EventGroup.Relays], HS_AND_UP),
	timed(TrackEvent.M4x800, '4×800m', '4×800', [EventGroup.Relays], HS_AND_UP),
	timed(TrackEvent.SprintMedley, 'Sprint medley', 'SMR', [EventGroup.Relays], COL_AND_UP),
	timed(TrackEvent.DistanceMedley, 'Distance medley', 'DMR', [EventGroup.Relays], COL_AND_UP),

	timed(TrackEvent.RaceWalk, 'Race walk', 'RW', [EventGroup.Specialty], COL_AND_UP)
]

const CATALOG_BY_EVENT = new Map(
	TRACK_EVENT_CATALOG.map(entry => [entry.event, entry])
)

const LEGACY_FIELD_EVENTS: TrackEvent[] = [
	TrackEvent.HighJump,
	TrackEvent.PoleVault,
	TrackEvent.LongJump,
	TrackEvent.TripleJump,
	TrackEvent.ShotPut,
	TrackEvent.Discus,
	TrackEvent.Javelin,
	TrackEvent.Hammer
]

export const getEventMetadata = ({
	event
}: {
	event: TrackEvent | string
}): TrackEventMetadata | null => {
	return CATALOG_BY_EVENT.get(event as TrackEvent) ?? null
}

export const isTimedEvent = ({ event }: { event: TrackEvent | string }): boolean => {
	const metadata = getEventMetadata({ event })
	return metadata?.scoringDirection === ScoringDirection.Lower
}

export const isFieldEvent = ({ event }: { event: TrackEvent | string }): boolean => {
	return !isTimedEvent({ event })
}

export const resolveCoachingLevels = ({
	levels
}: {
	levels: CoachingLevel[]
}): CoachingLevel[] => {
	const resolved = new Set<CoachingLevel>(levels)
	if (resolved.has(CoachingLevel.Club)) {
		resolved.add(CoachingLevel.HighSchool)
		resolved.add(CoachingLevel.College)
	}
	return [...resolved]
}

export const getEventCatalog = ({
	levels
}: {
	levels: CoachingLevel[]
}): TrackEvent[] => {
	const resolvedLevels = resolveCoachingLevels({ levels })
	if (resolvedLevels.length === 0) {
		return [...LEGACY_FIELD_EVENTS]
	}

	return TRACK_EVENT_CATALOG.filter(entry =>
		entry.levels.some(level => resolvedLevels.includes(level))
	).map(entry => entry.event)
}

export const getDefaultEnabledEvents = ({
	levels,
	focusedGroups
}: {
	levels: CoachingLevel[]
	focusedGroups: EventGroup[]
}): TrackEvent[] => {
	const catalog = getEventCatalog({ levels })
	if (focusedGroups.length === 0) {
		return catalog.filter(event => LEGACY_FIELD_EVENTS.includes(event))
	}

	return TRACK_EVENT_CATALOG.filter(entry => {
		if (!catalog.includes(entry.event)) {
			return false
		}
		return entry.groups.some(group => focusedGroups.includes(group))
	}).map(entry => entry.event)
}

export const getLegacyFieldEvents = (): TrackEvent[] => [...LEGACY_FIELD_EVENTS]

export const formatEventDisplayLabel = ({
	event
}: {
	event: TrackEvent | string
}): string => {
	const metadata = getEventMetadata({ event })
	if (metadata) {
		return metadata.label
	}

	return String(event).replace(/([A-Z])/g, ' $1').trim()
}

export const getEventShortLabel = ({
	event
}: {
	event: TrackEvent | string
}): string => {
	const metadata = getEventMetadata({ event })
	if (metadata) {
		return metadata.shortLabel
	}

	return formatEventDisplayLabel({ event })
}
