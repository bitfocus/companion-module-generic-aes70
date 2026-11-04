import { DEFAULT_PORT, ModuleConfig } from './config.js'
import { createModuleLogger } from '@companion-module/base'
import type { DropdownChoice, JsonValue, JsonObject } from '@companion-module/base'
import type { PropertyDescription } from './OcaHelper.js'
import { isAes70Enum } from './enums.js'
import { inspect } from 'node:util'
import { RemoteError } from 'aes70/src/controller/remote_error.js'
import { OcaStatus } from 'aes70/src/types/OcaStatus.js'

const utilsLogger = createModuleLogger('Generic OCA Utils')

export function handleBonjourHost(config: ModuleConfig): ModuleConfig {
	if (config.bonjourHost) {
		config.host = config.bonjourHost.split(':')[0]
		config.port = Number.parseInt(config.bonjourHost.split(':')[1]) || DEFAULT_PORT
		config.protocol = 'tcp' // Bonjour only supports TCP
		utilsLogger.info(`Bonjour device selected: ${config.host}:${config.port}`)
	}
	return config
}

/**
 * Strip leading 'Oca', insert white space prior to captical letters.
 * 'OcaLevelSensor' becomes 'Level Sensor'
 * @param className
 * @returns
 */

export function ocaClassNameToLabel(className: string): string {
	return (
		className
			.replace(/^Oca/, '')
			// 1. Space between lowercase/number and an uppercase letter (e.g., 'FilterFIR' -> 'Filter FIR')
			.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
			// 2. Space before the last uppercase letter in a block *only* if followed by a lowercase letter (e.g., 'IDReader' -> 'ID Reader')
			.replace(/([A-Z]+)(?=[A-Z][a-z])/g, '$1 ')
			.trim()
	)
}

export interface MakeSafeJsonOptions {
	/**
	 * If true, Promise values will be awaited and their resolved values
	 * serialized recursively.
	 *
	 * If false (default), Promise values are omitted from objects and become
	 * null in arrays/root.
	 */
	awaitPromises?: boolean

	/**
	 * Optional hook that can intercept serialization.
	 */
	visitor?: MakeSafeJsonVisitor
}

export type MakeSafeJsonVisitorResult =
	{ action: 'continue' } | { action: 'omit' } | { action: 'replace'; value: JsonValue }

export type MakeSafeJsonVisitor = (
	path: readonly (string | number)[],
	value: unknown,
) => MakeSafeJsonVisitorResult | Promise<MakeSafeJsonVisitorResult>

const OMIT = Symbol('makeSafeJson.omit')

export async function makeSafeJsonValue(data: unknown, options: MakeSafeJsonOptions = {}): Promise<JsonValue> {
	const { awaitPromises = false, visitor } = options

	const seen = new WeakSet<object>()

	async function visit(
		value: unknown,
		path: readonly (string | number)[],
		location: 'root' | 'object' | 'array',
	): Promise<JsonValue | typeof OMIT> {
		if (visitor) {
			const result = await visitor(path, value)

			switch (result.action) {
				case 'replace':
					return result.value

				case 'omit':
					return location === 'array' || location === 'root' ? null : OMIT

				case 'continue':
					break

				default: {
					const exhaustive: never = result
					return exhaustive
				}
			}
		}

		// null / undefined
		if (value == null) {
			return null
		}

		// primitives
		switch (typeof value) {
			case 'string':
			case 'number':
			case 'boolean':
				return value

			case 'bigint':
				return value.toString()

			case 'function':
			case 'symbol':
				return location === 'array' || location === 'root' ? null : OMIT
		}

		// Promise
		if (value instanceof Promise) {
			if (!awaitPromises) {
				return location === 'array' || location === 'root' ? null : OMIT
			}

			try {
				const resolved = await value

				return visit(resolved, path, location)
			} catch {
				return null
			}
		}

		// Boxed primitives
		if (value instanceof Number || value instanceof String || value instanceof Boolean) {
			return visit(value.valueOf(), path, location)
		}

		// Date
		if (value instanceof Date) {
			return value.toISOString()
		}

		// Error
		if (value instanceof Error) {
			const out: JsonObject = {
				name: value.name,
				message: value.message,
			}

			if (typeof value.stack === 'string') {
				out.stack = value.stack
			}

			return out
		}

		// Buffer (Node.js)
		if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
			return [...value]
		}

		// ArrayBuffer
		if (value instanceof ArrayBuffer) {
			return [...new Uint8Array(value)]
		}

		// A DataView has no element type, so its bytes
		if (value instanceof DataView) {
			return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
		}

		// Typed arrays: their elements, so a Float32Array reads as numbers rather than raw bytes.
		// BigInt64Array and BigUint64Array elements become strings, like any other bigint.
		if (ArrayBuffer.isView(value)) {
			return Array.from(value as unknown as ArrayLike<number | bigint>, (element) =>
				typeof element === 'bigint' ? element.toString() : element,
			)
		}

		// Set
		if (value instanceof Set) {
			const out: JsonValue[] = []

			let index = 0

			for (const item of value) {
				const converted = await visit(item, [...path, index], 'array')

				out.push(converted === OMIT ? null : converted)

				index++
			}

			return out
		}

		// Map
		if (value instanceof Map) {
			// A struct key, such as a PortClockMap's OcaPortID, stringifies to "[object Object]" like any
			// other struct, so a Map keyed by one is written as its entries rather than as an object
			if ([...value.keys()].some((key) => typeof key === 'object' && key !== null)) {
				const out: JsonValue[] = []

				let index = 0

				for (const [key, mapValue] of value) {
					const convertedKey = await visit(key, [...path, index, 0], 'array')
					const convertedValue = await visit(mapValue, [...path, index, 1], 'array')

					out.push([convertedKey === OMIT ? null : convertedKey, convertedValue === OMIT ? null : convertedValue])

					index++
				}

				return out
			}

			const out: JsonObject = {}

			for (const [key, mapValue] of value) {
				const converted = await visit(mapValue, [...path, String(key)], 'object')

				if (converted !== OMIT) {
					out[String(key)] = converted
				}
			}

			return out
		}

		// Array
		if (Array.isArray(value)) {
			const out: JsonValue[] = []

			for (let i = 0; i < value.length; i++) {
				const converted = await visit(value[i], [...path, i], 'array')

				out.push(converted === OMIT ? null : converted)
			}

			return out
		}

		// Object / class instance
		if (typeof value === 'object') {
			if (seen.has(value)) {
				return null
			}

			seen.add(value)

			const out: JsonObject = {}

			for (const key of Reflect.ownKeys(value)) {
				if (typeof key !== 'string') {
					continue
				}

				const descriptor = Object.getOwnPropertyDescriptor(value, key)

				if (!descriptor) {
					continue
				}

				let propertyValue: unknown

				try {
					if ('get' in descriptor && descriptor.get) {
						propertyValue = descriptor.get.call(value)
					} else {
						propertyValue = (value as Record<string, unknown>)[key]
					}
				} catch {
					continue
				}

				const converted = await visit(propertyValue, [...path, key], 'object')

				if (converted !== OMIT) {
					out[key] = converted
				}
			}

			// Only an object still being visited makes a cycle. aes70 enum members are singletons, so the
			// same one turns up again in sibling structs, such as the Direction of every input port
			seen.delete(value)

			return out
		}

		// Fallback for anything exotic
		return null
	}

	const result = await visit(data, [], 'root')

	return result === OMIT ? null : result
}

export function unwrapValue(obj: JsonValue): JsonValue {
	if (
		typeof obj === 'object' &&
		obj !== null &&
		!Array.isArray(obj) &&
		Object.keys(obj).length === 1 &&
		Object.prototype.hasOwnProperty.call(obj, 'value')
	) {
		return (obj as { value: JsonValue }).value
	} else if (
		typeof obj === 'object' &&
		obj !== null &&
		!Array.isArray(obj) &&
		Object.keys(obj).length === 1 &&
		Object.prototype.hasOwnProperty.call(obj, 'values')
	) {
		return (obj as { values: JsonValue }).values
	}
	return obj
}

/** Longest a value is logged at. A block's member or signal path lists can run long. */
const LOG_VALUE_MAX_LENGTH = 1000

/**
 * `value` as one line for a log message. aes70 hands back structs, Maps and enums, which a
 * template string prints as `[object Object]` and `[object Map]`, so those are written as JSON
 * with each nested enum as its member name. Strings are quoted, so an empty one still shows and
 * a control character is escaped instead of breaking the line. Other primitives print as usual.
 */
export function formatLogValue(value: unknown): string {
	let text: string
	if (typeof value === 'string') {
		text = JSON.stringify(value)
	} else if (typeof value !== 'object' || value === null) {
		text = String(value)
	} else if (isAes70Enum(value)) {
		text = value.name ?? String(value.valueOf())
	} else {
		try {
			text = JSON.stringify(value, logValueReplacer) ?? inspect(value, { breakLength: Infinity })
		} catch {
			// A cycle, or a getter that throws
			text = inspect(value, { breakLength: Infinity })
		}
	}
	return text.length > LOG_VALUE_MAX_LENGTH
		? `${text.slice(0, LOG_VALUE_MAX_LENGTH)}… (${text.length} characters)`
		: text
}

function logValueReplacer(_key: string, value: unknown): unknown {
	if (typeof value === 'bigint') return value.toString()
	// JSON has no Infinity or NaN and would write null, which reads as a missing value
	if (typeof value === 'number' && !Number.isFinite(value)) return String(value)
	if (isAes70Enum(value)) return value.name ?? value.valueOf()
	if (value instanceof Map) {
		const entries = [...value] as [unknown, unknown][]
		// A Map keyed by struct, such as a PortClockMap keyed by OcaPortID, has no object key to use
		return entries.every(([key]) => typeof key === 'string' || typeof key === 'number')
			? Object.fromEntries(entries as [PropertyKey, unknown][])
			: entries
	}
	if (value instanceof Set) return [...value]
	// Blobs decode to a Uint8Array, which JSON would write as an object keyed by index
	if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
		return Array.from(value as unknown as ArrayLike<number | bigint>)
	}
	return value
}

export function excitementEmoji(level: number): string {
	if (level < 1) return '😭'
	if (level < 10) return '😐'
	if (level < 20) return '🙂'
	if (level < 30) return '😊'
	if (level < 40) return '😄'
	if (level < 50) return '😃'
	if (level < 60) return '😁'
	if (level < 70) return '🤩'
	if (level < 80) return '🥳'
	if (level < 90) return '🤯'
	return '🚀'
}

export function makePropChoices(props: PropertyDescription[]): DropdownChoice<string>[] {
	const propertyChoices: DropdownChoice<string>[] = []
	props.forEach((prop) => {
		propertyChoices.push({ id: prop.name, label: ocaClassNameToLabel(prop.name) })
	})
	return propertyChoices
}

/**
 * The property to select by default: the first of those declared deepest in the class
 * hierarchy, so a class's own properties (a gain's Gain, a filter's Frequency) win over
 * inherited framework ones such as ClassVersion, Role or Lockable. When the sampled
 * object implements none of its class's own properties, the next level up is used.
 */
/**
 * Settles as `promise` does, or rejects with `signal`'s reason as soon as it aborts,
 * whichever comes first. It only stops the wait: whatever `promise` stands for carries on.
 *
 * Races against the signal with an abort listener rather than by reading `.aborted`
 * later, which also keeps it clear of Node 26's lazily evaluated AbortSignal.any().
 */
export async function abortable<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
	if (!signal) return promise
	if (signal.aborted) {
		// The abandoned promise may still reject; nothing is waiting on it any more
		promise.catch(() => undefined)
		throw signal.reason
	}

	let onAbort: (() => void) | undefined
	const aborted = new Promise<never>((_, reject) => {
		onAbort = () => reject(signal.reason as Error)
		signal.addEventListener('abort', onAbort, { once: true })
	})
	try {
		return await Promise.race([promise, aborted])
	} finally {
		if (onAbort) signal.removeEventListener('abort', onAbort)
	}
}

export function defaultPropertyName(props: readonly PropertyDescription[]): string | undefined {
	let deepest: PropertyDescription | undefined
	for (const prop of props) {
		if (deepest === undefined || prop.level > deepest.level) deepest = prop
	}
	return deepest?.name
}

/** True when `err` is the device refusing a call because the object doesn't implement it. */
export function isNotImplemented(err: unknown): boolean {
	return err instanceof RemoteError && err.status === OcaStatus.NotImplemented
}

/** How aes70 declares a property's getter: a method name, or one value out of a method returning several. */
type DeclaredAccessor = string | { name: string; index: number } | null | undefined

/** An object carrying aes70's generated accessors, and the property table describing them. */
type ObjectWithAccessors = Record<string, unknown> & {
	get_properties?: () => {
		find_property?: (
			name: string,
		) => { aliases?: readonly string[] | null; accessors?: { get?: DeclaredAccessor } | null } | undefined
	}
}

/**
 * The name of `obj`'s `Get` or `Set` method for `property`, or `undefined` where it has none.
 *
 * aes70 almost always names these after the property, but a handful are named after one of the
 * property's aliases instead, and the mismatch is only in the capitalisation: `InBandGain` on
 * OcaFilterParametric is read and written by `GetInbandGain` and `SetInbandGain`, and
 * OcaDeviceManager's `ControlEnabled` by `GetEnabled` and `SetEnabled`. Guessing `Set${name}` alone
 * therefore makes a settable property look read-only, and a readable one unreadable.
 */
export function accessorName(obj: unknown, prefix: 'Get' | 'Set', property: string): string | undefined {
	const target = obj as ObjectWithAccessors
	const direct = `${prefix}${property}`
	if (typeof target[direct] === 'function') return direct

	const aliases = target.get_properties?.()?.find_property?.(property)?.aliases ?? []
	for (const alias of aliases) {
		const name = `${prefix}${alias}`
		if (typeof target[name] === 'function') return name
	}
	return undefined
}

/** The method reading a property, and where in what it returns the property's value is. */
export interface Getter {
	readonly name: string
	/** 0 for a getter of its own, which returns the value first and any limits after it. */
	readonly index: number
}

/**
 * The method reading `property` on `obj`, or `undefined` where it has none. Mostly accessorName's
 * `Get` method, but aes70 also declares a getter for a property that has none of its own name:
 * either a method named otherwise, or one value out of a method returning several. OcaPowerSensor's
 * Power and PowerFactor are the first two values GetReading returns, as of aes70 2.0.22.
 *
 * Only for reading. A declared setter can be the same sort of thing, but setting one value of a
 * method that takes several would need the others, so accessorName's `Set` doesn't follow them.
 */
export function getterOf(obj: unknown, property: string): Getter | undefined {
	const name = accessorName(obj, 'Get', property)
	if (name !== undefined) return { name, index: 0 }

	const target = obj as ObjectWithAccessors
	const declared = target.get_properties?.()?.find_property?.(property)?.accessors?.get
	const getter = typeof declared === 'string' ? { name: declared, index: 0 } : declared
	return getter && typeof target[getter.name] === 'function' ? getter : undefined
}
