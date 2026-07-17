import { isBetterResult } from './videoResultUtils'

export const pickPRVideoIdFromChronologicalAttempts = ({
	attempts,
	event
}: {
	attempts: Array<{ videoId: string; sortDate: Date; value: number }>
	event: string
}): string | null => {
	const sortedAttempts = [...attempts].sort(
		(left, right) => left.sortDate.getTime() - right.sortDate.getTime()
	)

	let bestSoFar: number | null = null
	let prVideoId: string | null = null

	for (const attempt of sortedAttempts) {
		if (
			bestSoFar === null ||
			isBetterResult({
				newValue: attempt.value,
				previousValue: bestSoFar,
				event
			})
		) {
			bestSoFar = attempt.value
			prVideoId = attempt.videoId
		}
	}

	return prVideoId
}

export const pickPRPerformanceFromChronologicalAttempts = ({
	attempts,
	event
}: {
	attempts: Array<{
		performanceId: string
		videoId: string
		sortDate: Date
		value: number
	}>
	event: string
}): { performanceId: string; videoId: string } | null => {
	const sortedAttempts = [...attempts].sort(
		(left, right) => left.sortDate.getTime() - right.sortDate.getTime()
	)

	let bestSoFar: number | null = null
	let prPerformance: { performanceId: string; videoId: string } | null = null

	for (const attempt of sortedAttempts) {
		if (
			bestSoFar === null ||
			isBetterResult({
				newValue: attempt.value,
				previousValue: bestSoFar,
				event
			})
		) {
			bestSoFar = attempt.value
			prPerformance = {
				performanceId: attempt.performanceId,
				videoId: attempt.videoId
			}
		}
	}

	return prPerformance
}
