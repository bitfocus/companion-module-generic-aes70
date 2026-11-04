import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type { CompanionFeedbackDefinitions, CompanionFeedbackValueEvent } from '@companion-module/base'
import { OcaAudioLevelSensor, OcaGain, OcaPowerSensor, OcaSwitch } from 'aes70/src/controller/ControlClasses.js'
import { Arguments } from 'aes70/src/controller/arguments.js'
import { OcaSensorReadingState } from 'aes70/src/types/OcaSensorReadingState.js'
import { OcaStatus } from 'aes70/src/types/OcaStatus.js'
import { RemoteError } from 'aes70/src/controller/remote_error.js'
import { captureLogs, type CapturedLogs } from './captureLogs.js'
import { makeNamFilterParametric } from './fakeControlObjects.js'
import { OcaHelper } from '../OcaHelper.js'
import { UpdateFeedbacks, type FeedbackSchema } from '../feedbacks.js'
import type ModuleInstance from '../main.js'

/**
 * Exercises the generated Get Property feedback's registration against a real
 * OcaHelper, passing `previousOptions` the way the Companion module host does.
 * The host sets it to the options from before the last time Companion sent the
 * feedback, and Companion re-sends every feedback on each setFeedbackDefinitions,
 * which this module calls on every role map load. So after any reload a
 * feedback's previousOptions equal its current options.
 */

type GetPropertyOptions = { objectId: string; property: string; sync: boolean }

type ValueFeedbackCallback = (
	feedback: CompanionFeedbackValueEvent<GetPropertyOptions>,
	context: { type: 'feedback'; signal: AbortSignal },
) => Promise<unknown>

const GAIN_1: GetPropertyOptions = { objectId: 'Gain1', property: 'Gain', sync: true }
const GAIN_2: GetPropertyOptions = { objectId: 'Gain2', property: 'Gain', sync: true }
const MISSING: GetPropertyOptions = { objectId: 'Missing', property: 'Gain', sync: true }

/** Value the stubbed property sync reports for Gain. */
const GAIN_VALUE = -6

/**
 * A real OcaGain against a fake device, with GetPropertySync stubbed to resolve
 * instantly and report a single Gain property.
 */
function makeGain(ono: number): OcaGain {
	const device = { send_command: vi.fn(), add_subscription: vi.fn(), remove_subscription: vi.fn() }
	const obj = new OcaGain(ono, device as unknown as ConstructorParameters<typeof OcaGain>[1])
	;(obj as unknown as { GetPropertySync: unknown }).GetPropertySync = vi.fn(() => ({
		sync: vi.fn().mockResolvedValue(undefined),
		forEach: vi.fn((cb: (value: unknown, name: string) => void) => cb(GAIN_VALUE, 'Gain')),
		Dispose: vi.fn(),
	}))
	return obj
}

describe('Get Property feedback registration', () => {
	let helper: OcaHelper
	let setFeedbackDefinitions: Mock<(definitions: CompanionFeedbackDefinitions<FeedbackSchema>) => void>
	let self: ModuleInstance

	beforeEach(() => {
		helper = new OcaHelper()
		setFeedbackDefinitions = vi.fn()
		self = { ocaHelper: helper, setFeedbackDefinitions } as unknown as ModuleInstance
	})

	/** Load a role map of OcaGain objects and rebuild the feedback definitions, as the module does on map:loaded. */
	async function loadRoleMap(paths: string[]): Promise<void> {
		await helper.loadRoleMap(new Map<string, unknown>(paths.map((path, i) => [path, makeGain(i + 1)])))
		await UpdateFeedbacks(self)
	}

	/** Run feedback fb1's callback from the most recently set definitions. */
	async function check(options: GetPropertyOptions, previousOptions: GetPropertyOptions | null): Promise<unknown> {
		const definition = setFeedbackDefinitions.mock.lastCall?.[0].get_property_OcaGain
		if (!definition) throw new Error('No OcaGain feedback was defined')
		return (definition as unknown as { callback: ValueFeedbackCallback }).callback(
			{
				type: 'value',
				id: 'fb1',
				controlId: 'bank:1:1',
				feedbackId: 'get_property_OcaGain',
				options,
				previousOptions,
			},
			{ type: 'feedback', signal: new AbortController().signal },
		)
	}

	it('re-registers when its object drops out of the role map and comes back', async () => {
		await loadRoleMap(['Gain1', 'Gain2'])
		expect(await check(GAIN_1, null)).toBe(GAIN_VALUE)
		expect(helper.resolveFeedbackId('fb1')).toBe('Gain1')

		// The reload drops the registration, and Companion re-sends the feedback
		await loadRoleMap(['Gain2'])
		expect(helper.resolveFeedbackId('fb1')).toBeUndefined()
		await expect(check(GAIN_1, GAIN_1)).resolves.toBeNull()

		await loadRoleMap(['Gain1', 'Gain2'])
		expect(await check(GAIN_1, GAIN_1)).toBe(GAIN_VALUE)
		expect(helper.resolveFeedbackId('fb1')).toBe('Gain1')
		expect(helper.getEntry('Gain1')?.properties).toBeDefined()
	})

	it('registers an object that only appears after the feedback was first checked', async () => {
		await loadRoleMap(['Gain2'])
		await expect(check(GAIN_1, null)).resolves.toBeNull()

		await loadRoleMap(['Gain1', 'Gain2'])
		expect(await check(GAIN_1, GAIN_1)).toBe(GAIN_VALUE)
		expect(helper.resolveFeedbackId('fb1')).toBe('Gain1')
		expect(helper.getEntry('Gain1')?.properties).toBeDefined()
	})

	it('moves its registration when the control object changes', async () => {
		await loadRoleMap(['Gain1', 'Gain2'])
		await check(GAIN_1, null)

		await check(GAIN_2, GAIN_1)

		expect(helper.resolveFeedbackId('fb1')).toBe('Gain2')
		expect(helper.getEntry('Gain1')?.feedbackIds.has('fb1')).toBe(false)
	})

	it('drops its registration when pointed at an object the device does not have', async () => {
		await loadRoleMap(['Gain1'])
		await check(GAIN_1, null)

		await expect(check(MISSING, GAIN_1)).resolves.toBeNull()

		expect(helper.hasFeedbackId('fb1')).toBe(false)
		expect(helper.getEntry('Gain1')?.feedbackIds.has('fb1')).toBe(false)
	})

	it('registers once, not on every check', async () => {
		await loadRoleMap(['Gain1'])
		const addFeedbackId = vi.spyOn(helper, 'addFeedbackId')

		await check(GAIN_1, null)
		await check(GAIN_1, GAIN_1)
		await check(GAIN_1, GAIN_1)

		expect(addFeedbackId).toHaveBeenCalledTimes(1)
	})
})

describe('Get Property feedback check abort', () => {
	// Companion aborts a check's signal when it queues another check of the same feedback, and won't start
	// that one until this one settles. A check stuck waiting on registration would otherwise never update again.
	it('stops waiting on registration when Companion aborts the check', async () => {
		const helper = new OcaHelper()
		const setFeedbackDefinitions: Mock<(definitions: CompanionFeedbackDefinitions<FeedbackSchema>) => void> = vi.fn()
		const self = { ocaHelper: helper, setFeedbackDefinitions } as unknown as ModuleInstance
		const gain = makeGain(1)
		// The class probe's sync finishes; the registration's is still waiting on the device when the check is aborted
		let syncs = 0
		;(gain as unknown as { GetPropertySync: unknown }).GetPropertySync = () => {
			syncs++
			const first = syncs === 1
			return {
				sync: async (): Promise<void> => (first ? undefined : new Promise<void>(() => undefined)),
				forEach: (cb: (value: unknown, name: string) => void): void => cb(GAIN_VALUE, 'Gain'),
				Dispose: (): undefined => undefined,
			}
		}
		await helper.loadRoleMap(new Map<string, unknown>([['Gain1', gain]]))
		await UpdateFeedbacks(self)
		const definition = setFeedbackDefinitions.mock.lastCall?.[0].get_property_OcaGain
		if (!definition) throw new Error('No OcaGain feedback was defined')
		const controller = new AbortController()

		const checking = (definition as unknown as { callback: ValueFeedbackCallback }).callback(
			{
				type: 'value',
				id: 'fb1',
				controlId: 'bank:1:1',
				feedbackId: 'get_property_OcaGain',
				options: GAIN_1,
				previousOptions: null,
			},
			{ type: 'feedback', signal: controller.signal },
		)
		controller.abort(new Error('recheck queued'))

		const outcome = await Promise.race([
			checking.then(
				() => 'finished',
				() => 'gave way',
			),
			new Promise((resolve) => setTimeout(() => resolve('still waiting'), 200)),
		])
		expect(outcome).toBe('gave way')
	})
})

describe('Get Property feedback enum labels', () => {
	// ReadingState is declared on OcaSensor and reaches OcaAudioLevelSensor by inheritance
	type EnumOptions = { objectId: string; property: string; sync: boolean; enum_ReadingState: boolean }
	type EnumFeedbackDefinition = {
		options: { id: string }[]
		callback: (
			feedback: CompanionFeedbackValueEvent<EnumOptions>,
			context: { type: 'feedback'; signal: AbortSignal },
		) => Promise<unknown>
	}

	let readingState: unknown
	let setFeedbackDefinitions: Mock<(definitions: CompanionFeedbackDefinitions<FeedbackSchema>) => void>

	/** A real OcaAudioLevelSensor whose stubbed property sync reports ReadingState as `readingState`. */
	function makeLevelSensor(ono: number): OcaAudioLevelSensor {
		const device = { send_command: vi.fn(), add_subscription: vi.fn(), remove_subscription: vi.fn() }
		const obj = new OcaAudioLevelSensor(ono, device as unknown as ConstructorParameters<typeof OcaAudioLevelSensor>[1])
		;(obj as unknown as { GetPropertySync: unknown }).GetPropertySync = vi.fn(() => ({
			sync: vi.fn().mockResolvedValue(undefined),
			forEach: vi.fn((cb: (value: unknown, name: string) => void) => {
				cb(readingState, 'ReadingState')
				cb(-20, 'Reading')
			}),
			Dispose: vi.fn(),
		}))
		return obj
	}

	beforeEach(async () => {
		readingState = OcaSensorReadingState.Valid
		const helper = new OcaHelper()
		setFeedbackDefinitions = vi.fn()
		const self = { ocaHelper: helper, setFeedbackDefinitions } as unknown as ModuleInstance
		await helper.loadRoleMap(new Map<string, unknown>([['Meter1', makeLevelSensor(1)]]))
		await UpdateFeedbacks(self)
	})

	function definition(): EnumFeedbackDefinition {
		const built = setFeedbackDefinitions.mock.lastCall?.[0].get_property_OcaAudioLevelSensor
		if (!built) throw new Error('No OcaAudioLevelSensor feedback was defined')
		return built as unknown as EnumFeedbackDefinition
	}

	async function check(enumOn: boolean): Promise<unknown> {
		return definition().callback(
			{
				type: 'value',
				id: 'fb1',
				controlId: 'bank:1:1',
				feedbackId: 'get_property_OcaAudioLevelSensor',
				options: { objectId: 'Meter1', property: 'ReadingState', sync: true, enum_ReadingState: enumOn },
				previousOptions: null,
			},
			{ type: 'feedback', signal: new AbortController().signal },
		)
	}

	it('offers the Enum option for an enum property inherited from a base class', () => {
		expect(definition().options.map((option) => option.id)).toContain('enum_ReadingState')
	})

	it('returns the member name with Enum on, and the number with it off', async () => {
		expect(await check(true)).toBe('Valid')
		expect(await check(false)).toBe(1)
	})

	it('returns the number for a value outside the enum, even with Enum on', async () => {
		readingState = new (OcaSensorReadingState as unknown as new (value: number) => unknown)(200)

		expect(await check(true)).toBe(200)
	})
})

describe('Get Property feedback default property', () => {
	it("defaults to the class's own property rather than an inherited one", async () => {
		const helper = new OcaHelper()
		const setFeedbackDefinitions: Mock<(definitions: CompanionFeedbackDefinitions<FeedbackSchema>) => void> = vi.fn()
		const self = { ocaHelper: helper, setFeedbackDefinitions } as unknown as ModuleInstance
		await helper.loadRoleMap(new Map<string, unknown>([['MIC/BQ0', makeNamFilterParametric(1)]]))

		await UpdateFeedbacks(self)

		const definition = setFeedbackDefinitions.mock.lastCall?.[0].get_property_OcaFilterParametric as unknown as
			{ options: { id: string; default?: unknown }[] } | undefined
		// ClassVersion, Lockable, Role, Enabled, Ports and Owner are all inherited and reported first
		expect(definition?.options.find((option) => option.id === 'property')?.default).toBe('Frequency')
	})
})

describe('Get Property feedback on an object without the property', () => {
	let helper: OcaHelper
	let setFeedbackDefinitions: Mock<(definitions: CompanionFeedbackDefinitions<FeedbackSchema>) => void>
	let logs: CapturedLogs

	/** Label is optional: only AMP/BQ0 implements it, so the dropdown offers it for MIC/BQ0 too. */
	beforeEach(async () => {
		logs = captureLogs()
		helper = new OcaHelper()
		setFeedbackDefinitions = vi.fn()
		const self = { ocaHelper: helper, setFeedbackDefinitions } as unknown as ModuleInstance
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['MIC/BQ0', makeNamFilterParametric(1)],
				['AMP/BQ0', makeNamFilterParametric(2, [['Label', 'Low cut']])],
			]),
		)
		await UpdateFeedbacks(self)
	})

	afterEach(() => {
		logs.restore()
	})

	async function check(options: GetPropertyOptions): Promise<unknown> {
		const definition = setFeedbackDefinitions.mock.lastCall?.[0].get_property_OcaFilterParametric
		if (!definition) throw new Error('No OcaFilterParametric feedback was defined')
		return (definition as unknown as { callback: ValueFeedbackCallback }).callback(
			{
				type: 'value',
				id: 'fb1',
				controlId: 'bank:1:1',
				feedbackId: 'get_property_OcaFilterParametric',
				options,
				previousOptions: null,
			},
			{ type: 'feedback', signal: new AbortController().signal },
		)
	}

	/** Make the object's getter reject the way aes70 does when the device refuses the call. */
	function refuse(rolePath: string, getterName: string, error: Error): void {
		;(helper.getObject(rolePath) as unknown as Record<string, unknown>)[getterName] = vi.fn().mockRejectedValue(error)
	}

	it('warns once however often it is checked, and names the object and property when the device refuses', async () => {
		refuse('MIC/BQ0', 'GetLabel', new RemoteError(OcaStatus.NotImplemented, undefined))
		const options = { objectId: 'MIC/BQ0', property: 'Label', sync: true }

		const failure = "'MIC/BQ0' does not implement property 'Label'. Aborting feedback check fb1"
		await expect(check(options)).rejects.toThrow(failure)
		await expect(check(options)).rejects.toThrow(failure)

		expect(logs.warnings()).toEqual([
			'"MIC/BQ0" (OcaFilterParametric) returned no value for property "Label", so probably doesn\'t implement it. The feedback fb1 using it will fail.',
		])
	})

	it('passes any other device error through as it is', async () => {
		const error = new RemoteError(OcaStatus.DeviceError, undefined)
		refuse('MIC/BQ0', 'GetFrequency', error)

		await expect(check({ objectId: 'MIC/BQ0', property: 'Frequency', sync: false })).rejects.toBe(error)
		expect(logs.warnings()).toEqual([])
	})
})

describe('Get Property feedback on a getter returning several values', () => {
	let helper: OcaHelper
	let setFeedbackDefinitions: Mock<(definitions: CompanionFeedbackDefinitions<FeedbackSchema>) => void>

	/** A real aes70 object whose property sync reports `reported`, and whose getters are stubbed as given. */
	function make<T extends OcaPowerSensor | OcaSwitch>(
		Cls: new (ono: number, device: ConstructorParameters<typeof OcaGain>[1]) => T,
		reported: [name: string, value: unknown][],
		getters: Record<string, unknown>,
	): T {
		const device = { send_command: vi.fn(), add_subscription: vi.fn(), remove_subscription: vi.fn() }
		const obj = new Cls(1, device as unknown as ConstructorParameters<typeof OcaGain>[1])
		;(obj as unknown as { GetPropertySync: unknown }).GetPropertySync = vi.fn(() => ({
			sync: vi.fn().mockResolvedValue(undefined),
			forEach: vi.fn((cb: (value: unknown, name: string) => void) => {
				for (const [name, value] of reported) cb(value, name)
			}),
			Dispose: vi.fn(),
		}))
		for (const [name, result] of Object.entries(getters)) {
			;(obj as unknown as Record<string, unknown>)[name] = vi.fn().mockResolvedValue(result)
		}
		return obj
	}

	async function check(className: 'OcaPowerSensor' | 'OcaSwitch', options: GetPropertyOptions): Promise<unknown> {
		const definition = setFeedbackDefinitions.mock.lastCall?.[0][`get_property_${className}`]
		if (!definition) throw new Error(`No ${className} feedback was defined`)
		return (definition as unknown as { callback: ValueFeedbackCallback }).callback(
			{
				type: 'value',
				id: 'fb1',
				controlId: 'bank:1:1',
				feedbackId: `get_property_${className}`,
				options,
				previousOptions: null,
			},
			{ type: 'feedback', signal: new AbortController().signal },
		)
	}

	async function load(roleMap: [string, unknown][]): Promise<void> {
		helper = new OcaHelper()
		setFeedbackDefinitions = vi.fn()
		const self = { ocaHelper: helper, setFeedbackDefinitions } as unknown as ModuleInstance
		await helper.loadRoleMap(new Map<string, unknown>(roleMap))
		await UpdateFeedbacks(self)
	}

	// As of aes70 2.0.22, Power and PowerFactor have no getter of their own: they are the first two of
	// what GetReading returns, followed by the power limits. Synced, PowerFactor is missing here, so the
	// feedback falls back to the getter
	const READING = new Arguments([120.5, 0.92, 0, 2000])
	const powerSensor = (): OcaPowerSensor => make(OcaPowerSensor, [['Power', 120.5]], { GetReading: READING })

	it('reads a property through the getter aes70 declares for it, whole without sync', async () => {
		await load([['AMP/PWR', powerSensor()]])

		await expect(check('OcaPowerSensor', { objectId: 'AMP/PWR', property: 'Power', sync: false })).resolves.toEqual({
			values: [120.5, 0.92, 0, 2000],
		})
		await expect(
			check('OcaPowerSensor', { objectId: 'AMP/PWR', property: 'PowerFactor', sync: false }),
		).resolves.toEqual({ values: [120.5, 0.92, 0, 2000] })
	})

	it("gives just the property's own value with sync, from where the getter returns it", async () => {
		await load([['AMP/PWR', powerSensor()]])

		// Missing from the sync, so this is the getter's second value, not its first
		await expect(check('OcaPowerSensor', { objectId: 'AMP/PWR', property: 'PowerFactor', sync: true })).resolves.toBe(
			0.92,
		)
		await expect(check('OcaPowerSensor', { objectId: 'AMP/PWR', property: 'Power', sync: true })).resolves.toBe(120.5)
	})

	// A getter returning one value that is itself a list isn't several values to pick one from
	it('gives the whole list with sync, where a getter returns a single list', async () => {
		await load([['SDCARD/PLAY', make(OcaSwitch, [['Position', 0]], { GetPositionNames: ['ON', 'OFF', 'LOOP'] })]])

		await expect(
			check('OcaSwitch', { objectId: 'SDCARD/PLAY', property: 'PositionNames', sync: true }),
		).resolves.toEqual(['ON', 'OFF', 'LOOP'])
	})
})
