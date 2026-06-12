import { Request, Response, NextFunction } from 'express'
import pino from 'pino'

import { isDevelopment } from '@packages/utils/isDevelopment'
import { captureException } from '@packages/utils/sentry'
import { getRequestId } from '@packages/utils/tracing'

const logger = isDevelopment
	? pino({
			transport: {
				target: 'pino-pretty',
				options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' }
			}
		})
	: pino()

export class AppError extends Error {
	public readonly statusCode: number
	public readonly isOperational: boolean

	constructor({
		message,
		statusCode = 500,
		isOperational = true
	}: {
		message: string
		statusCode?: number
		isOperational?: boolean
	}) {
		super(message)
		this.statusCode = statusCode
		this.isOperational = isOperational
		Error.captureStackTrace(this, this.constructor)
	}
}

export const errorHandler = (
	err: Error | AppError,
	req: Request,
	res: Response,
	_next: NextFunction
): void => {
	const requestId = getRequestId()

	if (err instanceof AppError) {
		const errorResponse = {
			error: {
				message: err.message,
				statusCode: err.statusCode,
				requestId
			},
			...(isDevelopment && { stack: err.stack })
		}

		res.status(err.statusCode).json(errorResponse)

		logger.warn(
			{
				err,
				statusCode: err.statusCode,
				requestId,
				url: req.url,
				method: req.method
			},
			'Operational error'
		)
	} else {
		const errorResponse = {
			error: {
				message: isDevelopment ? err.message : 'Internal server error',
				statusCode: 500,
				requestId
			},
			...(isDevelopment && { stack: err.stack })
		}

		res.status(500).json(errorResponse)

		captureException({
			error: err,
			context: {
				requestId,
				url: req.url,
				method: req.method,
				headers: req.headers,
				body: req.body as unknown
			}
		})

		logger.error(
			{
				err,
				requestId,
				url: req.url,
				method: req.method
			},
			'Unexpected server error'
		)
	}
}

export const asyncHandler = (
	fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		Promise.resolve(fn(req, res, next)).catch(next)
	}
}
