import { describe, it, expect } from 'vitest'
import { Arguments } from 'aes70/src/controller/arguments.js'
import { OcaModelDescription } from 'aes70/src/types/OcaModelDescription.js'
import { OcaMuteState } from 'aes70/src/types/OcaMuteState.js'
import { OcaPort } from 'aes70/src/types/OcaPort.js'
import { OcaPortID } from 'aes70/src/types/OcaPortID.js'
import { OcaIODirection } from 'aes70/src/types/OcaIODirection.js'
import { OcaMediaClockRate } from 'aes70/src/types/OcaMediaClockRate.js'
import { OcaPortClockMapEntry } from 'aes70/src/types/OcaPortClockMapEntry.js'
import { OcaSamplingRateConverterType } from 'aes70/src/types/OcaSamplingRateConverterType.js'
import { OcaStatus } from 'aes70/src/types/OcaStatus.js'
import { RemoteError } from 'aes70/src/controller/remote_error.js'
import {
	OcaFilterParametric,
	OcaLevelSensor,
	OcaMatrix,
	OcaMediaRecorderPlayer,
	OcaPowerSensor,
} from 'aes70/src/controller/ControlClasses.js'
import type { PropertyDescription } from '../OcaHelper.js'
import type { ModuleConfig } from '../config.js'
import {
	abortable,
	accessorName,
	getterOf,
	defaultPropertyName,
	excitementEmoji,
	formatLogValue,
	handleBonjourHost,
	isNotImplemented,
	makePropChoices,
	makeSafeJsonValue,
	ocaClassNameToLabel,
	unwrapValue,
	type MakeSafeJsonVisitor,
} from '../utils.js'

describe('handleBonjourHost', () => {
	const manual: ModuleConfig = { host: '10.0.0.5', port: 1234, protocol: 'udp', batchCommands: true }

	it('takes the host and port from the selected Bonjour device, and forces TCP', () => {
		const config = handleBonjourHost({ ...manual, bonjourHost: '192.168.1.10:65001' })

		expect(config).toMatchObject({ host: '192.168.1.10', port: 65001, protocol: 'tcp' })
	})

	it('falls back to the default AES70 port when the Bonjour address has none or an unusable one', () => {
		expect(handleBonjourHost({ ...manual, bonjourHost: '192.168.1.10' }).port).toBe(65000)
		expect(handleBonjourHost({ ...manual, bonjourHost: '192.168.1.10:abc' }).port).toBe(65000)
	})

	it('leaves a manually configured connection alone when no Bonjour device is selected', () => {
		expect(handleBonjourHost({ ...manual })).toEqual(manual)
		expect(handleBonjourHost({ ...manual, bonjourHost: '' })).toMatchObject({
			host: '10.0.0.5',
			port: 1234,
			protocol: 'udp',
		})
	})
})

describe('ocaClassNameToLabel', () => {
	it.each([
		['OcaLevelSensor', 'Level Sensor'],
		['OcaBlockFactory', 'Block Factory'],
		['OcaUint16Actuator', 'Uint16 Actuator'],
		['OcaFilterFIR', 'Filter FIR'],
		['IDReader', 'ID Reader'],
		['ClassID', 'Class ID'],
		['InBandGain', 'In Band Gain'],
		['PPM1', 'PPM1'],
	])('labels %s as "%s"', (name, label) => {
		expect(ocaClassNameToLabel(name)).toBe(label)
	})

	it('only strips a leading Oca', () => {
		expect(ocaClassNameToLabel('LocalOcaThing')).toBe('Local Oca Thing')
	})
})

describe('makeSafeJsonValue', () => {
	it('passes JSON primitives through, and turns null and undefined into null', async () => {
		expect(await makeSafeJsonValue({ s: 'text', n: -6.5, b: false, nothing: null, missing: undefined })).toEqual({
			s: 'text',
			n: -6.5,
			b: false,
			nothing: null,
			missing: null,
		})
		expect(await makeSafeJsonValue(undefined)).toBeNull()
	})

	it('turns a bigint, such as a 64-bit property value, into a string', async () => {
		expect(await makeSafeJsonValue(9007199254740993n)).toBe('9007199254740993')
	})

	it('drops functions and symbols from objects, and makes them null in arrays and at the root', async () => {
		const fn = (): void => undefined
		expect(await makeSafeJsonValue({ keep: 1, fn, sym: Symbol('s') })).toEqual({ keep: 1 })
		expect(await makeSafeJsonValue([fn, Symbol('s')])).toEqual([null, null])
		expect(await makeSafeJsonValue(fn)).toBeNull()
	})

	it('skips promises by default, and awaits them when asked', async () => {
		expect(await makeSafeJsonValue({ pending: Promise.resolve(1), keep: 2 })).toEqual({ keep: 2 })
		expect(await makeSafeJsonValue([Promise.resolve(1)])).toEqual([null])

		expect(await makeSafeJsonValue({ later: Promise.resolve({ gain: -6 }) }, { awaitPromises: true })).toEqual({
			later: { gain: -6 },
		})
		expect(await makeSafeJsonValue(Promise.reject(new Error('refused')), { awaitPromises: true })).toBeNull()
	})

	it('unboxes boxed primitives', async () => {
		expect(await makeSafeJsonValue([Object(2), Object('text'), Object(true)])).toEqual([2, 'text', true])
	})

	it('turns a Date into an ISO string, and an Error into its name, message and stack', async () => {
		expect(await makeSafeJsonValue(new Date('2026-09-17T10:00:00Z'))).toBe('2026-09-17T10:00:00.000Z')

		const error = new RangeError('out of range')
		expect(await makeSafeJsonValue(error)).toEqual({ name: 'RangeError', message: 'out of range', stack: error.stack })
	})

	it('turns byte buffers into arrays of byte values', async () => {
		expect(await makeSafeJsonValue(Buffer.from([1, 2, 255]))).toEqual([1, 2, 255])
		expect(await makeSafeJsonValue(new Uint8Array([3, 4]).buffer)).toEqual([3, 4])
		expect(await makeSafeJsonValue(new Uint8Array([5, 6]))).toEqual([5, 6])
	})

	it('turns a typed array into its element values, not its raw bytes', async () => {
		expect(await makeSafeJsonValue(new Float32Array([1.5, -6]))).toEqual([1.5, -6])
		expect(await makeSafeJsonValue(new Int16Array([-2, 300]))).toEqual([-2, 300])
		// Like any other bigint
		expect(await makeSafeJsonValue(new BigInt64Array([1099511627776n]))).toEqual(['1099511627776'])
	})

	it('turns a DataView, which has no element type, into its bytes', async () => {
		expect(await makeSafeJsonValue(new DataView(new Uint8Array([7, 8, 9]).buffer, 1))).toEqual([8, 9])
	})

	it('turns a Set into an array, and a Map into an object with string keys', async () => {
		expect(await makeSafeJsonValue(new Set(['a', 'b']))).toEqual(['a', 'b'])
		expect(
			await makeSafeJsonValue(
				new Map<unknown, unknown>([
					[1, 'one'],
					['two', 2],
				]),
			),
		).toEqual({ '1': 'one', two: 2 })
	})

	// Every struct key stringifies to "[object Object]", so as an object each entry overwrote the
	// last and a PortClockMap came back as its final entry alone
	it('turns a Map keyed by struct, such as a PortClockMap, into its entries', async () => {
		const portClockMap = new Map([
			[new OcaPortID(OcaIODirection.Input, 1), new OcaPortClockMapEntry(4, OcaSamplingRateConverterType.None)],
			[new OcaPortID(OcaIODirection.Output, 1), new OcaPortClockMapEntry(5, OcaSamplingRateConverterType.None)],
		])
		expect(await makeSafeJsonValue(portClockMap)).toEqual([
			[
				{ Direction: { value: 1 }, Index: 1 },
				{ ClockONo: 4, SRCType: { value: 0 } },
			],
			[
				{ Direction: { value: 2 }, Index: 1 },
				{ ClockONo: 5, SRCType: { value: 0 } },
			],
		])
	})

	it('serialises aes70 values as the feedback reads them: getter results, structs and enums', async () => {
		expect(await makeSafeJsonValue(new Arguments([-6, -70, 20]))).toEqual({ values: [-6, -70, 20] })
		expect(await makeSafeJsonValue(new OcaModelDescription('T&M Media', 'NAM', '3'))).toEqual({
			Manufacturer: 'T&M Media',
			Name: 'NAM',
			Version: '3',
		})
		expect(await makeSafeJsonValue(OcaMuteState.Unmuted)).toEqual({ value: 2 })
	})

	it('skips a property whose getter throws', async () => {
		const value = { keep: 1 }
		Object.defineProperty(value, 'broken', {
			enumerable: true,
			get: () => {
				throw new Error('not readable')
			},
		})

		expect(await makeSafeJsonValue(value)).toEqual({ keep: 1 })
	})

	it('turns a reference back to an object already being serialised into null', async () => {
		const node: Record<string, unknown> = { name: 'root' }
		node.self = node

		expect(await makeSafeJsonValue(node)).toEqual({ name: 'root', self: null })
	})

	// aes70 enum members are singletons, so every input port shares one OcaIODirection.Input. Treated
	// as a cycle, it was written as null for every port after the first
	it('writes an object referenced more than once, outside a cycle, every time', async () => {
		const ports = [
			new OcaPort(10001, new OcaPortID(OcaIODirection.Input, 1), 'In 1'),
			new OcaPort(10001, new OcaPortID(OcaIODirection.Input, 2), 'In 2'),
		]

		expect(await makeSafeJsonValue(ports)).toEqual([
			{ Owner: 10001, ID: { Direction: { value: 1 }, Index: 1 }, Role: 'In 1' },
			{ Owner: 10001, ID: { Direction: { value: 1 }, Index: 2 }, Role: 'In 2' },
		])
	})

	describe('visitor', () => {
		it('can replace a value, with the path to it', async () => {
			const paths: (string | number)[][] = []
			const result = await makeSafeJsonValue(
				{ gain: -6, nested: { gain: -3 } },
				{
					visitor: (path, value) => {
						paths.push([...path])
						return path.at(-1) === 'gain' ? { action: 'replace', value: `${String(value)} dB` } : { action: 'continue' }
					},
				},
			)

			expect(result).toEqual({ gain: '-6 dB', nested: { gain: '-3 dB' } })
			expect(paths).toContainEqual(['nested', 'gain'])
		})

		it('can omit a value: dropped from objects, null in arrays and at the root', async () => {
			const omitWhere =
				(test: (key: string | number | undefined) => boolean): MakeSafeJsonVisitor =>
				(path) =>
					test(path.at(-1)) ? { action: 'omit' } : { action: 'continue' }

			expect(
				await makeSafeJsonValue({ keep: 1, secret: 2 }, { visitor: omitWhere((key) => key === 'secret') }),
			).toEqual({
				keep: 1,
			})
			expect(await makeSafeJsonValue(['a', 'b', 'c'], { visitor: omitWhere((key) => key === 1) })).toEqual([
				'a',
				null,
				'c',
			])
			expect(await makeSafeJsonValue('anything', { visitor: omitWhere(() => true) })).toBeNull()
		})
	})
})

describe('formatLogValue', () => {
	it('quotes strings, so an empty one shows and control characters are escaped', () => {
		expect(formatLogValue('System')).toBe('"System"')
		expect(formatLogValue('')).toBe('""')
		expect(formatLogValue('\x01\x01\x02\x01\n')).toBe('"\\u0001\\u0001\\u0002\\u0001\\n"')
	})

	it('prints other primitives as a template string would', () => {
		expect(formatLogValue(-6.5)).toBe('-6.5')
		expect(formatLogValue(-Infinity)).toBe('-Infinity')
		expect(formatLogValue(true)).toBe('true')
		expect(formatLogValue(undefined)).toBe('undefined')
		expect(formatLogValue(null)).toBe('null')
		expect(formatLogValue(9007199254740993n)).toBe('9007199254740993')
	})

	it('prints an enum as its member name, or its number when outside the enum', () => {
		expect(formatLogValue(OcaMuteState.Muted)).toBe('Muted')
		expect(formatLogValue(new (OcaMuteState as unknown as new (value: number) => unknown)(99))).toBe('99')
	})

	it('writes a struct as JSON, with nested enums by name', () => {
		const port = new OcaPort(10001, new OcaPortID(OcaIODirection.Input, 1), 'In 1')
		expect(formatLogValue(port)).toBe('{"Owner":10001,"ID":{"Direction":"Input","Index":1},"Role":"In 1"}')
		expect(formatLogValue([port])).toBe('[{"Owner":10001,"ID":{"Direction":"Input","Index":1},"Role":"In 1"}]')
		expect(formatLogValue(new OcaMediaClockRate(48000, 0, 0, 0))).toBe(
			'{"NominalRate":48000,"PullRange":0,"Accuracy":0,"JitterMax":0}',
		)
	})

	it('writes a Map keyed by number as an object, and one keyed by struct as its entries', () => {
		expect(formatLogValue(new Map([[1, 'a']]))).toBe('{"1":"a"}')
		const portClockMap = new Map([
			[new OcaPortID(OcaIODirection.Input, 1), new OcaPortClockMapEntry(4, OcaSamplingRateConverterType.None)],
			[new OcaPortID(OcaIODirection.Output, 1), new OcaPortClockMapEntry(4, OcaSamplingRateConverterType.None)],
		])
		expect(formatLogValue(portClockMap)).toBe(
			'[[{"Direction":"Input","Index":1},{"ClockONo":4,"SRCType":"None"}],' +
				'[{"Direction":"Output","Index":1},{"ClockONo":4,"SRCType":"None"}]]',
		)
	})

	it('writes a blob as its bytes, and a Set as an array', () => {
		expect(formatLogValue(new Uint8Array([0xf0, 0x5e]))).toBe('[240,94]')
		expect(formatLogValue(new Set([1, 2]))).toBe('[1,2]')
	})

	it('cuts a long value short, saying how long it was', () => {
		const text = formatLogValue(Array.from({ length: 500 }, (_, i) => i))
		expect(text).toMatch(/^\[0,1,2,.*… \(1891 characters\)$/)
		expect(text.indexOf('…')).toBe(1000)
	})

	it('falls back to util.inspect for a value JSON cannot write', () => {
		const cyclic: Record<string, unknown> = {}
		cyclic.self = cyclic
		expect(formatLogValue(cyclic)).toBe('<ref *1> { self: [Circular *1] }')
	})
})

describe('unwrapValue', () => {
	it('unwraps an object holding only a value, as an aes70 enum serialises', () => {
		expect(unwrapValue({ value: 2 })).toBe(2)
	})

	it('unwraps an object holding only values, as aes70 getter results serialise', () => {
		expect(unwrapValue({ values: [-6, -70, 20] })).toEqual([-6, -70, 20])
	})

	it('leaves anything else unchanged', () => {
		expect(unwrapValue({ value: 1, min: 0 })).toEqual({ value: 1, min: 0 })
		expect(unwrapValue({ other: 1 })).toEqual({ other: 1 })
		expect(unwrapValue([{ value: 1 }])).toEqual([{ value: 1 }])
		expect(unwrapValue(null)).toBeNull()
		expect(unwrapValue('text')).toBe('text')
	})
})

describe('excitementEmoji', () => {
	it.each([
		[0, '😭'],
		[1, '😐'],
		[9, '😐'],
		[10, '🙂'],
		[45, '😃'],
		[89, '🤯'],
		[90, '🚀'],
		[500, '🚀'],
	])('picks the band for %i definitions', (count, emoji) => {
		expect(excitementEmoji(count)).toBe(emoji)
	})
})

describe('makePropChoices', () => {
	it('offers each property by name, labelled for display', () => {
		const props: PropertyDescription[] = [
			{ name: 'Frequency', type: 'number', read: true, write: true, level: 4 },
			{ name: 'InBandGain', type: 'number', read: true, write: false, level: 4 },
		]

		expect(makePropChoices(props)).toEqual([
			{ id: 'Frequency', label: 'Frequency' },
			{ id: 'InBandGain', label: 'In Band Gain' },
		])
	})
})

describe('abortable', () => {
	it('settles as the promise does when there is no signal, or it never aborts', async () => {
		await expect(abortable(Promise.resolve(1), undefined)).resolves.toBe(1)
		await expect(abortable(Promise.resolve(2), new AbortController().signal)).resolves.toBe(2)
		await expect(abortable(Promise.reject(new Error('failed')), new AbortController().signal)).rejects.toThrow('failed')
	})

	it('rejects with the reason as soon as the signal aborts, without waiting on the promise', async () => {
		const controller = new AbortController()
		const waiting = abortable(new Promise(() => undefined), controller.signal)

		controller.abort(new Error('gave up'))

		await expect(waiting).rejects.toThrow('gave up')
	})

	it('rejects straight away for a signal already aborted, and ignores the abandoned promise failing later', async () => {
		const controller = new AbortController()
		controller.abort(new Error('already aborted'))
		let failLater: ((err: Error) => void) | undefined
		const abandoned = new Promise<void>((_, reject) => (failLater = reject))

		await expect(abortable(abandoned, controller.signal)).rejects.toThrow('already aborted')

		// Must not surface as an unhandled rejection
		failLater?.(new Error('late failure'))
		await new Promise((resolve) => setTimeout(resolve, 10))
	})
})

function prop(name: string, level: number): PropertyDescription {
	return { name, level, type: 'number', read: true, write: true }
}

describe('defaultPropertyName', () => {
	it("picks the class's own property over inherited framework ones", () => {
		// The order an OcaFilterParametric on a real device reports them in: inherited first
		const props = [
			prop('ClassVersion', 1),
			prop('Lockable', 1),
			prop('Role', 1),
			prop('Enabled', 2),
			prop('Frequency', 4),
			prop('Shape', 4),
		]

		expect(defaultPropertyName(props)).toBe('Frequency')
	})

	it("falls back to the deepest level present when none of the class's own properties are", () => {
		expect(defaultPropertyName([prop('Role', 1), prop('Enabled', 2)])).toBe('Enabled')
	})

	it('has no default when there are no properties', () => {
		expect(defaultPropertyName([])).toBeUndefined()
	})
})

describe('isNotImplemented', () => {
	it('is true only for a device refusing a call as not implemented', () => {
		expect(isNotImplemented(new RemoteError(OcaStatus.NotImplemented, undefined))).toBe(true)
		expect(isNotImplemented(new RemoteError(OcaStatus.DeviceError, undefined))).toBe(false)
		expect(isNotImplemented(new Error('Call failed with OcaStatus NotImplemented'))).toBe(false)
		expect(isNotImplemented(undefined)).toBe(false)
	})
})

describe('accessorName', () => {
	const device = {
		send_command: (): undefined => undefined,
		add_subscription: (): undefined => undefined,
		remove_subscription: (): undefined => undefined,
	} as unknown as ConstructorParameters<typeof OcaFilterParametric>[1]
	const make = <T>(Cls: new (ono: number, dev: typeof device) => T): T => new Cls(1, device)

	it('names the getter and setter after the property', () => {
		const filter = make(OcaFilterParametric)

		expect(accessorName(filter, 'Get', 'Frequency')).toBe('GetFrequency')
		expect(accessorName(filter, 'Set', 'Frequency')).toBe('SetFrequency')
	})

	// aes70 spells these two after the property's alias, differing only in case, so guessing
	// Set<property> makes a settable property look read-only
	it("falls back to a property's alias where aes70 named the accessor after that instead", () => {
		const filter = make(OcaFilterParametric)

		expect(filter).not.toHaveProperty('SetInBandGain')
		expect(accessorName(filter, 'Get', 'InBandGain')).toBe('GetInbandGain')
		expect(accessorName(filter, 'Set', 'InBandGain')).toBe('SetInbandGain')
	})

	it('has no setter for a property that is only ever read', () => {
		const sensor = make(OcaLevelSensor)

		expect(accessorName(sensor, 'Get', 'Reading')).toBe('GetReading')
		expect(accessorName(sensor, 'Set', 'Reading')).toBeUndefined()
	})

	it('has nothing for an unknown property, or an object with no accessors at all', () => {
		expect(accessorName(make(OcaFilterParametric), 'Get', 'NotAProperty')).toBeUndefined()
		expect(accessorName({}, 'Set', 'Frequency')).toBeUndefined()
	})
})

describe('getterOf', () => {
	const device = {
		send_command: (): undefined => undefined,
		add_subscription: (): undefined => undefined,
		remove_subscription: (): undefined => undefined,
	} as unknown as ConstructorParameters<typeof OcaFilterParametric>[1]
	const make = <T>(Cls: new (ono: number, dev: typeof device) => T): T => new Cls(1, device)

	it("finds a property's own getter, alias spellings included, with its value first", () => {
		const filter = make(OcaFilterParametric)

		expect(getterOf(filter, 'Frequency')).toEqual({ name: 'GetFrequency', index: 0 })
		expect(getterOf(filter, 'InBandGain')).toEqual({ name: 'GetInbandGain', index: 0 })
	})

	// Declared by aes70 from 2.0.22. Pinned against the real classes, so an aes70 that moves them fails here
	it('follows the getter aes70 declares for a property returned among other values', () => {
		const sensor = make(OcaPowerSensor)
		expect(sensor).not.toHaveProperty('GetPower')
		expect(getterOf(sensor, 'Power')).toEqual({ name: 'GetReading', index: 0 })
		expect(getterOf(sensor, 'PowerFactor')).toEqual({ name: 'GetReading', index: 1 })

		expect(getterOf(make(OcaMediaRecorderPlayer), 'WindowEnd')).toEqual({ name: 'GetWindowRange', index: 1 })
		expect(getterOf(make(OcaMatrix), 'ySize')).toEqual({ name: 'GetSize', index: 1 })
	})

	it('has nothing for an unknown property, a declared method the object lacks, or no accessors at all', () => {
		expect(getterOf(make(OcaFilterParametric), 'NotAProperty')).toBeUndefined()
		const sensor = make(OcaPowerSensor)
		;(sensor as unknown as Record<string, unknown>).GetReading = undefined
		expect(getterOf(sensor, 'Power')).toBeUndefined()
		expect(getterOf({}, 'Frequency')).toBeUndefined()
	})

	// Setting one of several values a method takes would need the others, so setters don't follow
	it("leaves accessorName's setter lookup alone, though aes70 declares indexed setters too", () => {
		expect(accessorName(make(OcaMediaRecorderPlayer), 'Set', 'WindowStart')).toBeUndefined()
	})
})
