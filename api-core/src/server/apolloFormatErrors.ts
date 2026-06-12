import { ApolloServerErrorCode } from '@apollo/server/errors'
import { ReportingService } from '@packages/services/logging/ReportingService'
import { GraphQLFormattedError } from 'graphql'
import { container } from 'tsyringe'

const normalizeError = ({ err }: { err: unknown }): Error => {
	if (err instanceof Error) {
		return err
	}

	if (
		err !== null &&
		typeof err === 'object' &&
		'message' in err &&
		typeof (err as { message: unknown }).message === 'string'
	) {
		return new Error((err as { message: string }).message)
	}

	return new Error(String(err))
}

const isPostgresDriverError = (err: unknown): boolean => {
	if (err === null || typeof err !== 'object') {
		return false
	}
	const code = (err as { code?: unknown }).code
	return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)
}

export const apolloFormatErrors = (
	formattedError: GraphQLFormattedError,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	error: any
): GraphQLFormattedError => {
	const reportingService = container.resolve(ReportingService)
	if (
		formattedError?.extensions?.code ===
		ApolloServerErrorCode.GRAPHQL_VALIDATION_FAILED
	) {
		reportingService.reportError({ error: normalizeError({ err: error }) })
		return {
			...formattedError,
			message: "Your query doesn't match the schema. Try double-checking it!"
		}
	}

	const normalizedError = normalizeError({ err: error })
	const isPermissionError = normalizedError.message
		.toLowerCase()
		.includes('permission')

	if (
		formattedError?.extensions?.code ===
		ApolloServerErrorCode.INTERNAL_SERVER_ERROR
	) {
		reportingService.reportError({ error: normalizedError })
		return {
			...formattedError,
			message: isPermissionError
				? normalizedError.message
				: 'Internal server error'
		}
	}

	if (isPostgresDriverError(error)) {
		reportingService.reportError({ error: normalizeError({ err: error }) })
		return {
			...formattedError,
			message: 'Database error'
		}
	}

	reportingService.reportError({ error: normalizeError({ err: error }) })
	return formattedError
}
