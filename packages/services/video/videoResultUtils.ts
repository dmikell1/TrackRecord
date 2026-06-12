import { ScoringDirection } from '@packages/enums/trackRecord'
import { getEventMetadata } from '@packages/constants/trackEventCatalog'
import type { VideoResult } from '@packages/types/video'

export const getComparableResultValue = ({
	result
}: {
	result: VideoResult | null | undefined
}): number | null => {
	if (!result) {
		return null
	}

	if (result.type === 'Foul' || result.type === 'DNF' || result.type === 'DQ') {
		return null
	}

	if (result.type === 'Mark') {
		if (result.cleared === false) {
			return null
		}
		return result.value
	}

	if (result.type === 'Time') {
		return result.value
	}

	if (result.type === 'VerticalHeights') {
		const cleared = result.heights
			.filter(height => height.cleared)
			.map(height => height.height)
		return cleared.length > 0 ? Math.max(...cleared) : null
	}

	return null
}

export const getScoringDirectionForEvent = ({
	event
}: {
	event: string
}): ScoringDirection => {
	const metadata = getEventMetadata({ event })
	return metadata?.scoringDirection ?? ScoringDirection.Higher
}

export const isBetterResult = ({
	newValue,
	previousValue,
	event
}: {
	newValue: number
	previousValue: number
	event: string
}): boolean => {
	const direction = getScoringDirectionForEvent({ event })
	if (direction === ScoringDirection.Lower) {
		return newValue < previousValue
	}

	return newValue > previousValue
}

export const getBestComparableValue = ({
	values,
	event
}: {
	values: number[]
	event: string
}): number | null => {
	if (values.length === 0) {
		return null
	}

	const direction = getScoringDirectionForEvent({ event })
	if (direction === ScoringDirection.Lower) {
		return Math.min(...values)
	}

	return Math.max(...values)
}
