import pino from 'pino'
import { container } from 'tsyringe'

import { ReportingService } from '@packages/services/logging/ReportingService'

const fallbackLogger = pino()

// Symbol to mark methods that should not be traced
const NO_TRACE = Symbol('NO_TRACE')

// Decorator to mark methods that should not be traced
export function NoTrace() {
	return function (
		_target: any,
		_propertyKey: string,
		descriptor: PropertyDescriptor
	) {
		descriptor.value[NO_TRACE] = true
		return descriptor
	}
}

// Helper function to check if a method is async
function isAsyncMethod(method: Function): boolean {
	return method.constructor.name === 'AsyncFunction'
}

// Helper function to check if a method name indicates it's private
function isPrivateMethod(methodName: string): boolean {
	return methodName.startsWith('_')
}

// Main error reporting decorator
function ReportErrors() {
	return function (target: any) {
		const methods = Object.getOwnPropertyNames(target.prototype)
		methods.forEach((method) => {
			if (method !== 'constructor') {
				const descriptor = Object.getOwnPropertyDescriptor(
					target.prototype,
					method
				)
				// Skip if not a method or if it's a getter/setter
				if (
					!descriptor ||
					!descriptor.value ||
					typeof descriptor.value !== 'function'
				) {
					return
				}

				// Skip if method is marked with @NoTrace
				if (descriptor.value[NO_TRACE]) {
					return
				}

				// Skip private methods (starting with underscore)
				if (isPrivateMethod(method)) {
					return
				}

				// Skip non-async methods
				if (!isAsyncMethod(descriptor.value)) {
					return
				}

				const originalMethod = descriptor.value
				descriptor.value = async function (...args: any[]) {
					let reportingService = (this as any)
						.reportingService as ReportingService

					if (!reportingService) {
						try {
							reportingService = container.resolve(ReportingService)
						} catch (error) {
							fallbackLogger.warn({ err: error }, 'Unable to resolve ReportingService')
							return originalMethod.apply(this, args)
						}
					}

					return reportingService.withTrace({
						op: target.name,
						name: method,
						fn: async () => {
							try {
								return await originalMethod.apply(this, args)
							} catch (error) {
								;(error as Error).message = `[${target.name}.${method}] ${
									(error as Error).message
								}`
								reportingService.reportError({ error: error as Error })
								throw error
							}
						}
					})
				}
				Object.defineProperty(target.prototype, method, descriptor)
			}
		})
		return target
	}
}

export default ReportErrors
