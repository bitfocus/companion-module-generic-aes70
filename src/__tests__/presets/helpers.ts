import { expect, vi, type Mock } from 'vitest'
import type {
	CompanionActionDefinitions,
	CompanionFeedbackDefinitions,
	CompanionPresetDefinitions,
	CompanionPresetSection,
} from '@companion-module/base'
import {
	OcaAudioLevelSensor,
	OcaBooleanActuator,
	OcaBooleanSensor,
	OcaGain,
	OcaIdentificationActuator,
	OcaLevelSensor,
	OcaMute,
	OcaPolarity,
	OcaStateSensor,
	OcaStringActuator,
	OcaSwitch,
	type OcaRoot,
} from 'aes70/src/controller/ControlClasses.js'
import { OcaMuteState } from 'aes70/src/types/OcaMuteState.js'
import { OcaPolarityState } from 'aes70/src/types/OcaPolarityState.js'
import { OcaHelper } from '../../OcaHelper.js'
import { UpdateActions, type ActionSchema } from '../../actions.js'
import { UpdateFeedbacks, type FeedbackSchema } from '../../feedbacks.js'
import { UpdatePresets } from '../../presets.js'
import type { OcaModuleTypes } from '../../types.js'
import type ModuleInstance from '../../main.js'

export type ControlClass = new (ono: number, device: ConstructorParameters<typeof OcaMute>[1]) => OcaRoot

/**
 * A real aes70 object against an inert device, with GetPropertySync stubbed to report
 * `reported`, so class probes resolve without any network I/O.
 */
export function makeObject(Cls: ControlClass, ono: number, reported: [name: string, value: unknown][]): OcaRoot {
	const device = { send_command: vi.fn(), add_subscription: vi.fn(), remove_subscription: vi.fn() }
	const obj = new Cls(ono, device as unknown as ConstructorParameters<ControlClass>[1])
	;(obj as unknown as { GetPropertySync: unknown }).GetPropertySync = () => ({
		sync: async (): Promise<void> => undefined,
		forEach: (cb: (value: unknown, name: string) => void): void => {
			for (const [name, value] of reported) cb(value, name)
		},
		Dispose: (): undefined => undefined,
	})
	return obj
}

export const mute = (ono: number): OcaRoot =>
	makeObject(OcaMute, ono, [
		['Enabled', true],
		['State', OcaMuteState.Unmuted],
	])
export const polarity = (ono: number): OcaRoot =>
	makeObject(OcaPolarity, ono, [
		['Enabled', true],
		['State', OcaPolarityState.NonInverted],
	])
export const booleanActuator = (ono: number): OcaRoot =>
	makeObject(OcaBooleanActuator, ono, [
		['Enabled', true],
		['Setting', false],
	])
export const identification = (ono: number): OcaRoot =>
	makeObject(OcaIdentificationActuator, ono, [
		['Enabled', true],
		['Active', false],
	])
export const gain = (ono: number): OcaRoot =>
	makeObject(OcaGain, ono, [
		['Enabled', true],
		['Gain', 0],
	])
/** A switch like the NAM's SDCARD/PLAY on 2026-09-20: position 0 of three named ones, though it reports a max of 3. */
export const namedSwitch = (ono: number): OcaRoot =>
	makeObject(OcaSwitch, ono, [
		['Enabled', true],
		['Position', 0],
		['PositionNames', ['ON', 'OFF', 'LOOP']],
	])
export const switchObject = (ono: number): OcaRoot =>
	makeObject(OcaSwitch, ono, [
		['Enabled', true],
		['Position', 1],
	])
/** Like one of the NAM's 16 OcaLevelSensors, such as CHLEVELS/INS0. Its Reading is read-only. */
export const levelSensor = (ono: number): OcaRoot =>
	makeObject(OcaLevelSensor, ono, [
		['Enabled', true],
		['Reading', -42.123456],
	])
export const audioLevelSensor = (ono: number): OcaRoot =>
	makeObject(OcaAudioLevelSensor, ono, [
		['Enabled', true],
		['Reading', -12.5],
	])
/** Like the NAM's AMP/CH0/ERROC on 2026-09-25, one of its 41 OcaBooleanSensors: a fault flag, reading false. */
export const booleanSensor = (ono: number): OcaRoot =>
	makeObject(OcaBooleanSensor, ono, [
		['Enabled', true],
		['Reading', false],
	])
/** A state sensor whose states run from 1, so its first name is state 1's, reading its second state. */
export const stateSensor = (ono: number): OcaRoot =>
	makeObject(OcaStateSensor, ono, [
		['Enabled', true],
		['State', 2],
		['StateNames', ['IDLE', 'RUNNING', 'FAULT']],
	])
/** A state sensor that doesn't implement StateNames. */
export const unnamedStateSensor = (ono: number): OcaRoot =>
	makeObject(OcaStateSensor, ono, [
		['Enabled', true],
		['State', 0],
	])
/** A class no preset section covers, for checking that one on its own produces nothing. */
export const stringActuator = (ono: number): OcaRoot =>
	makeObject(OcaStringActuator, ono, [
		['Enabled', true],
		['Setting', ''],
	])

/** A role map as the tests write it: a path and the object at it. */
export type RoleMap = [path: string, obj: OcaRoot][]

/** A fake instance and the definitions it was given, one per test. */
export interface PresetHarness {
	helper: OcaHelper
	self: ModuleInstance
	setPresetDefinitions: Mock<
		(structure: CompanionPresetSection<OcaModuleTypes>[], presets: CompanionPresetDefinitions<OcaModuleTypes>) => void
	>
	setActionDefinitions: Mock<(definitions: CompanionActionDefinitions<ActionSchema>) => void>
	setFeedbackDefinitions: Mock<(definitions: CompanionFeedbackDefinitions<FeedbackSchema>) => void>
	/** Load a role map and define everything, in the order the module does. */
	define(roleMap: RoleMap): Promise<{
		structure: CompanionPresetSection<OcaModuleTypes>[]
		presets: CompanionPresetDefinitions<OcaModuleTypes>
	}>
}

export function makeHarness(): PresetHarness {
	const helper = new OcaHelper()
	const setPresetDefinitions: PresetHarness['setPresetDefinitions'] = vi.fn()
	const setActionDefinitions: PresetHarness['setActionDefinitions'] = vi.fn()
	const setFeedbackDefinitions: PresetHarness['setFeedbackDefinitions'] = vi.fn()
	const self = {
		ocaHelper: helper,
		setPresetDefinitions,
		setActionDefinitions,
		setFeedbackDefinitions,
	} as unknown as ModuleInstance

	return {
		helper,
		self,
		setPresetDefinitions,
		setActionDefinitions,
		setFeedbackDefinitions,
		async define(roleMap) {
			await helper.loadRoleMap(new Map<string, unknown>(roleMap))
			await UpdateActions(self)
			await UpdateFeedbacks(self)
			await UpdatePresets(self)
			const [structure, presets] = setPresetDefinitions.mock.lastCall ?? []
			if (!structure || !presets) throw new Error('No presets were defined')
			return { structure, presets }
		},
	}
}

/** The preset's text element, found by id rather than position, since a dial sits between it and the background. */
export function labelOf(preset: { elements: { id?: string }[] }): unknown {
	const label = preset.elements.find((element) => element.id === 'label')
	expect(label).toBeDefined()
	return label
}

export type DefinitionShape = { options: { id: string; choices?: { id: string | number }[] }[] }
export type PresetEntry = { actionId?: string; feedbackId?: string; options: Record<string, unknown> }

/** Every option `options` sets exists on `definition`, and every fixed dropdown value is one of its choices. */
export function expectOptionsOffered(definition: DefinitionShape | undefined, options: Record<string, unknown>): void {
	expect(definition).toBeDefined()
	for (const [id, value] of Object.entries(options)) {
		const option = definition?.options.find((o) => o.id === id)
		expect(option, `option ${id}`).toBeDefined()
		if (!option?.choices) continue
		if (isExpression(value)) {
			// A toggle expression's two results, or the ends a stepping expression clamps itself to,
			// must all be values the dropdown offers
			const ternary = /\?\s*(-?\d+)\s*:\s*(-?\d+)$/.exec(value.value)?.slice(1).map(Number)
			const clamps = [...value.value.matchAll(/\b(?:min|max)\(\s*(-?\d+)\s*,/g)].map((match) => Number(match[1]))
			const results = ternary ?? clamps
			expect(results.length, `option ${id} results`).toBeGreaterThan(0)
			expect(option.choices.map((c) => c.id)).toEqual(expect.arrayContaining(results))
		} else {
			expect(
				option.choices.map((c) => c.id),
				`option ${id}`,
			).toContain(value)
		}
	}
}

function isExpression(value: unknown): value is { isExpression: true; value: string } {
	return typeof value === 'object' && value !== null && (value as { isExpression?: unknown }).isExpression === true
}
