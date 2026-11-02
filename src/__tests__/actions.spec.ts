import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import type { CompanionActionDefinitions } from '@companion-module/base'
import { OcaMediaRecorderPlayer, OcaMute, OcaTaskAgent } from 'aes70/src/controller/ControlClasses.js'
import { OcaMuteState } from 'aes70/src/types/OcaMuteState.js'
import { OcaStatus } from 'aes70/src/types/OcaStatus.js'
import { RemoteError } from 'aes70/src/controller/remote_error.js'
import { captureLogs, type CapturedLogs } from './captureLogs.js'
import { makeNamFilterParametric } from './fakeControlObjects.js'
import { OcaHelper } from '../OcaHelper.js'
import { UpdateActions, type ActionSchema } from '../actions.js'
import type ModuleInstance from '../main.js'

/**
 * Exercises the generated Set Property action against a real OcaHelper and a
 * real OcaMute, whose stubbed property sync reports values the way aes70 does:
 * State as an OcaMuteState enum instance rather than a number.
 */

type SetPropertyOptions = { objectId: string; property: string }

type LearnCallback = (
	action: { id: string; controlId: string; actionId: string; options: SetPropertyOptions },
	context: { signal: AbortSignal },
) => Promise<Record<string, unknown> | undefined>

/** The parts of a generated action definition these tests use. */
type SetPropertyDefinition = {
	options: { id: string; choices?: { id: string | number }[] }[]
	learn: LearnCallback
}

/**
 * A real OcaMute against a fake device, with GetPropertySync stubbed to resolve
 * instantly and report a writable enum (State) and a writable boolean (Enabled).
 */
function makeMute(ono: number): OcaMute {
	const device = { send_command: vi.fn(), add_subscription: vi.fn(), remove_subscription: vi.fn() }
	const obj = new OcaMute(ono, device as unknown as ConstructorParameters<typeof OcaMute>[1])
	;(obj as unknown as { GetPropertySync: unknown }).GetPropertySync = vi.fn(() => ({
		sync: vi.fn().mockResolvedValue(undefined),
		forEach: vi.fn((cb: (value: unknown, name: string) => void) => {
			cb(OcaMuteState.Muted, 'State')
			cb(true, 'Enabled')
		}),
		Dispose: vi.fn(),
	}))
	return obj
}

describe('Set Property action learn', () => {
	let helper: OcaHelper
	let definition: SetPropertyDefinition

	beforeEach(async () => {
		helper = new OcaHelper()
		const setActionDefinitions: Mock<(definitions: CompanionActionDefinitions<ActionSchema>) => void> = vi.fn()
		const self = { ocaHelper: helper, setActionDefinitions } as unknown as ModuleInstance

		await helper.loadRoleMap(new Map<string, unknown>([['Mute1', makeMute(1)]]))
		await UpdateActions(self)

		const built = setActionDefinitions.mock.lastCall?.[0].set_property_OcaMute
		if (!built) throw new Error('No OcaMute action was defined')
		definition = built as unknown as SetPropertyDefinition

		// Companion subscribes an action before it can be learned, which is what syncs the properties learn reads
		await helper.addActionId('Mute1', 'a1')
	})

	async function learn(property: string): Promise<Record<string, unknown> | undefined> {
		return definition.learn(
			{ id: 'a1', controlId: 'bank:1:1', actionId: 'set_property_OcaMute', options: { objectId: 'Mute1', property } },
			{ signal: new AbortController().signal },
		)
	}

	it('learns an enum property as its numeric value, which is one of the dropdown choice ids', async () => {
		const learned = await learn('State')

		expect(learned).toEqual({ value_State: 1 })
		const choiceIds = definition.options.find((option) => option.id === 'value_State')?.choices?.map((c) => c.id)
		expect(choiceIds).toContain(learned?.value_State)
	})

	it('learns a primitive property as it is', async () => {
		await expect(learn('Enabled')).resolves.toEqual({ value_Enabled: true })
	})
})

describe('Set Property action default property', () => {
	it("defaults to the class's own property rather than an inherited one", async () => {
		const helper = new OcaHelper()
		const setActionDefinitions: Mock<(definitions: CompanionActionDefinitions<ActionSchema>) => void> = vi.fn()
		const self = { ocaHelper: helper, setActionDefinitions } as unknown as ModuleInstance
		await helper.loadRoleMap(new Map<string, unknown>([['MIC/BQ0', makeNamFilterParametric(1)]]))

		await UpdateActions(self)

		const definition = setActionDefinitions.mock.lastCall?.[0].set_property_OcaFilterParametric as unknown as
			SetPropertyDefinition | undefined
		const property = definition?.options.find((option) => option.id === 'property') as { default?: unknown } | undefined
		// Enabled, inherited from OcaWorker, is the first writable property the device reports
		expect(property?.default).toBe('Frequency')
	})
})

describe('Set Property action value inputs', () => {
	type Definition = {
		options: { id: string; choices?: { id: string | number }[] }[]
		skipUnsubscribeOnOptionsChange?: boolean
	}

	let helper: OcaHelper
	let setActionDefinitions: Mock<(definitions: CompanionActionDefinitions<ActionSchema>) => void>
	let self: ModuleInstance

	beforeEach(() => {
		helper = new OcaHelper()
		setActionDefinitions = vi.fn()
		self = { ocaHelper: helper, setActionDefinitions } as unknown as ModuleInstance
	})

	async function buildFilterDefinition(): Promise<Definition> {
		await UpdateActions(self)
		const built = setActionDefinitions.mock.lastCall?.[0].set_property_OcaFilterParametric
		if (!built) throw new Error('No OcaFilterParametric action was defined')
		return built
	}

	const optionIds = (definition: Definition): string[] => definition.options.map((option) => option.id)
	const propertyChoiceIds = (definition: Definition): (string | number)[] | undefined =>
		definition.options.find((option) => option.id === 'property')?.choices?.map((choice) => choice.id)

	it('declares a value input for every settable property of the class, but offers only implemented ones', async () => {
		await helper.loadRoleMap(new Map<string, unknown>([['MIC/BQ0', makeNamFilterParametric(1)]]))

		const definition = await buildFilterDefinition()

		// From aes70's class definition, including Label, Latency and ShapeParameter, which the NAM does not implement
		expect(optionIds(definition)).toEqual([
			'objectId',
			'property',
			'value_Enabled',
			'value_Label',
			'value_Latency',
			'value_Frequency',
			'value_Shape',
			'value_WidthParameter',
			'value_InBandGain',
			'value_ShapeParameter',
		])
		expect(propertyChoiceIds(definition)).toEqual(['Enabled', 'Frequency', 'Shape', 'WidthParameter', 'InBandGain'])
	})

	// Companion stores a default for every option when an action is created and nothing for options added
	// afterwards, so discovery must only ever add choices, never inputs
	it('keeps the same value inputs when a registration discovers more properties, adding only choices', async () => {
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['MIC/BQ0', makeNamFilterParametric(1)],
				['AMP/BQ0', makeNamFilterParametric(2, [['Label', 'Low cut']])],
			]),
		)
		const before = await buildFilterDefinition()

		await helper.addActionId('AMP/BQ0', 'a1')
		const after = await buildFilterDefinition()

		expect(optionIds(after)).toEqual(optionIds(before))
		expect(propertyChoiceIds(before)).not.toContain('Label')
		expect(propertyChoiceIds(after)).toEqual(['Enabled', 'Label', 'Frequency', 'Shape', 'WidthParameter', 'InBandGain'])
	})

	// Every definition rebuild makes Companion re-send every action. Unsubscribing first would drop an
	// object's only registration and read all of its properties from the device again.
	it('does not unsubscribe an action that Companion re-sends', async () => {
		await helper.loadRoleMap(new Map<string, unknown>([['MIC/BQ0', makeNamFilterParametric(1)]]))

		expect((await buildFilterDefinition()).skipUnsubscribeOnOptionsChange).toBe(true)
	})
})

describe('Set Property action on an object without the property', () => {
	type ActionEvent = { id: string; controlId: string; actionId: string; options: Record<string, unknown> }
	type Definition = {
		subscribe: (action: ActionEvent, context: object) => Promise<void>
		callback: (action: ActionEvent, context: { signal: AbortSignal }) => Promise<void>
	}

	let helper: OcaHelper
	let definition: Definition
	let logs: CapturedLogs

	/** Label is optional: only AMP/BQ0 implements it, so the dropdown offers it for MIC/BQ0 too. */
	beforeEach(async () => {
		logs = captureLogs()
		helper = new OcaHelper()
		const setActionDefinitions: Mock<(definitions: CompanionActionDefinitions<ActionSchema>) => void> = vi.fn()
		const self = { ocaHelper: helper, setActionDefinitions } as unknown as ModuleInstance
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['MIC/BQ0', makeNamFilterParametric(1)],
				['AMP/BQ0', makeNamFilterParametric(2, [['Label', 'Low cut']])],
			]),
		)
		await UpdateActions(self)
		const built = setActionDefinitions.mock.lastCall?.[0].set_property_OcaFilterParametric
		if (!built) throw new Error('No OcaFilterParametric action was defined')
		definition = built as unknown as Definition
	})

	afterEach(() => {
		logs.restore()
	})

	const action = (id: string, options: Record<string, unknown>): ActionEvent => ({
		id,
		controlId: 'bank:1:1',
		actionId: 'set_property_OcaFilterParametric',
		options,
	})

	/** Make the object's setter reject the way aes70 does when the device refuses the call. */
	function refuse(rolePath: string, setterName: string, error: Error): void {
		;(helper.getObject(rolePath) as unknown as Record<string, unknown>)[setterName] = vi.fn().mockRejectedValue(error)
	}

	it('warns when subscribed to an object that returned no value for the selected property', async () => {
		await definition.subscribe(action('a1', { objectId: 'AMP/BQ0', property: 'Label' }), {})
		expect(logs.warnings()).toEqual([])

		await definition.subscribe(action('a2', { objectId: 'MIC/BQ0', property: 'Label' }), {})
		expect(logs.warnings()).toEqual([
			'"MIC/BQ0" (OcaFilterParametric) returned no value for property "Label", so probably doesn\'t implement it. The action a2 using it will fail.',
		])
	})

	it('names the object and property when the device says the object does not implement it', async () => {
		refuse('MIC/BQ0', 'SetLabel', new RemoteError(OcaStatus.NotImplemented, undefined))

		await expect(
			definition.callback(action('a1', { objectId: 'MIC/BQ0', property: 'Label', value_Label: 'Low cut' }), {
				signal: new AbortController().signal,
			}),
		).rejects.toThrow("'MIC/BQ0' does not implement property 'Label'. Aborting action a1")
	})

	it('passes any other device error through as it is', async () => {
		const error = new RemoteError(OcaStatus.ParameterOutOfRange, undefined)
		refuse('MIC/BQ0', 'SetFrequency', error)

		await expect(
			definition.callback(action('a1', { objectId: 'MIC/BQ0', property: 'Frequency', value_Frequency: 1e9 }), {
				signal: new AbortController().signal,
			}),
		).rejects.toBe(error)
	})
})

describe('Run Command action', () => {
	type ActionEvent = { id: string; controlId: string; actionId: string; options: Record<string, unknown> }
	type Definition = {
		options: { id: string; default?: unknown; choices?: { id: string | number; label: string }[] }[]
		callback: (action: ActionEvent, context: { signal: AbortSignal }) => Promise<void>
	}

	let definitions: CompanionActionDefinitions<ActionSchema>
	/** The commands each object's device was sent, by aes70's name for the method. */
	let sent: { target: number; debugName: string; params: number }[]
	let reply: () => Promise<unknown>

	/** A real aes70 object whose device records what it is sent, with property sync stubbed to report `reported`. */
	function make<T extends OcaMute | OcaMediaRecorderPlayer | OcaTaskAgent>(
		Cls: new (ono: number, device: ConstructorParameters<typeof OcaMute>[1]) => T,
		ono: number,
		reported: [name: string, value: unknown][],
	): T {
		const device = {
			send_command: vi.fn(
				async (cmd: { target: number; param_count: number }, _types: unknown, _cb: unknown, debugName: string) => {
					sent.push({ target: cmd.target, debugName, params: cmd.param_count })
					return reply()
				},
			),
			add_subscription: vi.fn(),
			remove_subscription: vi.fn(),
		}
		const obj = new Cls(ono, device as unknown as ConstructorParameters<typeof OcaMute>[1])
		;(obj as unknown as { GetPropertySync: unknown }).GetPropertySync = () => ({
			sync: async (): Promise<void> => undefined,
			forEach: (cb: (value: unknown, name: string) => void): void => {
				for (const [name, value] of reported) cb(value, name)
			},
			Dispose: (): undefined => undefined,
		})
		return obj
	}

	beforeEach(async () => {
		sent = []
		reply = async () => undefined
		const helper = new OcaHelper()
		const setActionDefinitions: Mock<(definitions: CompanionActionDefinitions<ActionSchema>) => void> = vi.fn()
		const self = { ocaHelper: helper, setActionDefinitions } as unknown as ModuleInstance
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['PLAYER', make(OcaMediaRecorderPlayer, 7, [['TrackCount', 2]])],
				['TASKS', make(OcaTaskAgent, 8, [['Blocked', false]])],
			]),
		)
		sent = []
		await UpdateActions(self)
		const last = setActionDefinitions.mock.lastCall?.[0]
		if (!last) throw new Error('No actions were defined')
		definitions = last
	})

	const definitionOf = (key: keyof ActionSchema): Definition => {
		const built = definitions[key]
		if (!built) throw new Error(`No ${key} action was defined`)
		return built as unknown as Definition
	}

	const run = async (key: keyof ActionSchema, options: Record<string, unknown>): Promise<void> =>
		definitionOf(key).callback(
			{ id: 'a1', controlId: 'bank:1:1', actionId: key, options },
			{ signal: new AbortController().signal },
		)

	it("offers each class's commands for each of its objects, defaulting to the first", () => {
		const player = definitionOf('run_command_OcaMediaRecorderPlayer')
		expect(player.options).toMatchObject([
			{ id: 'objectId', choices: [{ id: 'PLAYER', label: 'PLAYER' }], default: 'PLAYER' },
			{
				id: 'command',
				choices: [
					{ id: 'Play', label: 'Play' },
					{ id: 'Record', label: 'Record' },
					{ id: 'Stop', label: 'Stop' },
					{ id: 'Reset', label: 'Reset' },
					{ id: 'Close', label: 'Close' },
				],
				default: 'Play',
			},
		])
		expect(definitionOf('run_command_OcaTaskAgent').options[1]).toMatchObject({
			choices: [
				{ id: 'ActionStart', label: 'Start' },
				{ id: 'ActionStop', label: 'Stop' },
				{ id: 'ActionReset', label: 'Reset' },
				{ id: 'ActionClear', label: 'Clear' },
			],
			default: 'ActionStart',
		})
	})

	it('sends the chosen command to the chosen object, with no parameters', async () => {
		await run('run_command_OcaMediaRecorderPlayer', { objectId: 'PLAYER', command: 'Stop' })
		await run('run_command_OcaTaskAgent', { objectId: 'TASKS', command: 'ActionStart' })

		expect(sent).toEqual([
			{ target: 7, debugName: 'OcaMediaRecorderPlayer.Stop', params: 0 },
			{ target: 8, debugName: 'OcaTaskAgent.ActionStart', params: 0 },
		])
	})

	// An expression can give the option any string, and most of aes70's methods take arguments or destroy something
	it('sends nothing for a method that is not one of the commands, whatever the option says', async () => {
		await expect(run('run_command_OcaMediaRecorderPlayer', { objectId: 'PLAYER', command: 'Open' })).rejects.toThrow(
			"'Open' is not a command 'PLAYER' takes. Aborting action a1",
		)
		// A command, but another class's
		await expect(run('run_command_OcaTaskAgent', { objectId: 'TASKS', command: 'Play' })).rejects.toThrow(
			"'Play' is not a command 'TASKS' takes",
		)
		// A command of this class, but sent at an object of another
		await expect(run('run_command_OcaMediaRecorderPlayer', { objectId: 'TASKS', command: 'Play' })).rejects.toThrow(
			"'Play' is not a command 'TASKS' takes",
		)
		expect(sent).toEqual([])
	})

	it('names the object and command when the device says the object does not implement it', async () => {
		reply = async () => Promise.reject(new RemoteError(OcaStatus.NotImplemented, undefined))

		await expect(run('run_command_OcaMediaRecorderPlayer', { objectId: 'PLAYER', command: 'Reset' })).rejects.toThrow(
			"'PLAYER' does not implement 'Reset'. Aborting action a1",
		)
	})

	it('passes any other device error through as it is', async () => {
		const error = new RemoteError(OcaStatus.InvalidRequest, undefined)
		reply = async () => Promise.reject(error)

		await expect(run('run_command_OcaTaskAgent', { objectId: 'TASKS', command: 'ActionStop' })).rejects.toBe(error)
	})

	it('defines no Run Command action for a class without commands, or one the device lacks', async () => {
		const helper = new OcaHelper()
		const setActionDefinitions: Mock<(definitions: CompanionActionDefinitions<ActionSchema>) => void> = vi.fn()
		const self = { ocaHelper: helper, setActionDefinitions } as unknown as ModuleInstance
		await helper.loadRoleMap(new Map<string, unknown>([['Mute1', make(OcaMute, 1, [['State', OcaMuteState.Muted]])]]))
		await UpdateActions(self)

		const built = setActionDefinitions.mock.lastCall?.[0]
		// Present but undefined, which tells Companion the action isn't offered
		expect(built).toHaveProperty('run_command_OcaMediaRecorderPlayer', undefined)
		expect(built).toHaveProperty('run_command_OcaTaskAgent', undefined)
		expect(built?.set_property_OcaMute).toBeDefined()
	})
})
