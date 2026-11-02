import { describe, it, expect, beforeEach } from 'vitest'
import { STATUS_CLASSES } from '../../presets/status.js'
import {
	booleanSensor,
	makeHarness,
	stateSensor,
	unnamedStateSensor,
	type PresetHarness,
	type RoleMap,
} from './helpers.js'

describe('status presets', () => {
	let ctx: PresetHarness

	beforeEach(() => {
		ctx = makeHarness()
	})

	const define = async (roleMap: RoleMap): ReturnType<PresetHarness['define']> => ctx.define(roleMap)

	it('labels a boolean sensor with its object, and turns it amber while the reading is true', async () => {
		const { presets } = await define([['AMP/CH0/ERROC', booleanSensor(1)]])

		expect(presets['status_OcaBooleanSensor_AMP/CH0/ERROC']).toEqual({
			type: 'layered',
			name: 'Boolean Sensor - AMP/CH0/ERROC',
			elements: [
				{ type: 'box', id: 'background', name: 'Background', color: 0x000000 },
				{ type: 'text', id: 'label', name: 'Label', text: 'AMP/CH0/ERROC', fontsize: 22, color: 0xffffff },
			],
			// A sensor is read-only, so nothing on the button writes to the device
			steps: [{ down: [], up: [] }],
			feedbacks: [
				{
					feedbackId: 'internal:checkExpression',
					options: { expression: '$(local:reading) == true' },
					// Amber with black text, as a polarity toggle is when inverted
					styleOverrides: [
						{ elementId: 'background', elementProperty: 'color', override: { isExpression: false, value: 0xffbf00 } },
						{ elementId: 'label', elementProperty: 'color', override: { isExpression: false, value: 0x000000 } },
					],
				},
			],
			localVariables: [
				{
					variableType: 'feedback',
					variableName: 'reading',
					feedbackId: 'get_property_OcaBooleanSensor',
					options: { objectId: 'AMP/CH0/ERROC', property: 'Reading', sync: true },
				},
			],
		})
	})

	// Reading has a getter and no setter, so a section that required a writable property would be empty
	it('gives boolean sensors their own section, apart from the toggles, though their reading can only be read', async () => {
		const { structure } = await define([
			['AMP/CH0/ERROC', booleanSensor(1)],
			['AES/LOCK', booleanSensor(2)],
		])

		expect(structure).toEqual([
			{
				id: 'status',
				name: 'Status',
				definitions: [
					{
						id: 'status_OcaBooleanSensor',
						type: 'simple',
						name: 'Boolean Sensor',
						presets: ['status_OcaBooleanSensor_AMP/CH0/ERROC', 'status_OcaBooleanSensor_AES/LOCK'],
					},
				],
			},
		])
	})

	it('labels a state sensor with its object and the name of its state, and never lights it', async () => {
		const { presets } = await define([['AMP/STATE', stateSensor(1)]])

		const name = '$(local:names)[$(local:reading).values[0] - $(local:reading).values[1]]'
		expect(presets['status_OcaStateSensor_AMP/STATE']).toEqual({
			type: 'layered',
			name: 'State Sensor - AMP/STATE',
			elements: [
				{ type: 'box', id: 'background', name: 'Background', color: 0x000000 },
				{
					type: 'text',
					id: 'label',
					name: 'Label',
					text: {
						isExpression: true,
						value: `\`AMP/STATE\\n\${arrayIncludes($(local:names), ${name}) ? ${name} : isNumber($(local:reading).values[0]) ? round($(local:reading).values[0]) : ''}\``,
					},
					fontsize: 22,
					color: 0xffffff,
				},
			],
			steps: [{ down: [], up: [] }],
			// Which states are good news is up to the device, so nothing lights
			feedbacks: [],
			localVariables: [
				{
					variableType: 'feedback',
					variableName: 'reading',
					feedbackId: 'get_property_OcaStateSensor',
					// Without sync, for the limits as well as the state
					options: { objectId: 'AMP/STATE', property: 'State', sync: false },
				},
				{
					variableType: 'feedback',
					variableName: 'names',
					feedbackId: 'get_property_OcaStateSensor',
					options: { objectId: 'AMP/STATE', property: 'StateNames', sync: true },
				},
			],
		})
	})

	// Run as JavaScript, which Companion's expression syntax also is for everything used here
	const showLabel = (label: string, reading: { values: unknown[] }, names?: unknown): unknown =>
		// eslint-disable-next-line @typescript-eslint/no-implied-eval
		new Function(
			'reading',
			'names',
			'arrayIncludes',
			'isNumber',
			'round',
			'return ' + label.replaceAll('$(local:reading)', 'reading').replaceAll('$(local:names)', 'names'),
		)(
			reading,
			names,
			(array: unknown, item: unknown) => Array.isArray(array) && array.includes(item),
			(value: unknown) => typeof value === 'number',
			Math.round,
		)

	const labelText = async (roleMap: Parameters<typeof define>[0], rolePath: string): Promise<string> => {
		const { presets } = await define(roleMap)
		const preset = presets[`status_OcaStateSensor_${rolePath}`]
		if (preset?.type !== 'layered') throw new Error('No layered preset')
		const label = preset.elements.find((element) => element.id === 'label')
		if (label?.type !== 'text' || typeof label.text !== 'object') throw new Error('No label expression')
		return label.text.value
	}

	// AES70 numbers the names from the lowest state, not from zero
	it("names a state by its place counting from the sensor's lowest state", async () => {
		const label = await labelText([['AMP/STATE', stateSensor(1)]], 'AMP/STATE')
		const names = ['IDLE', 'RUNNING', 'FAULT']

		expect(showLabel(label, { values: [1, 1, 3] }, names)).toBe('AMP/STATE\nIDLE')
		expect(showLabel(label, { values: [3, 1, 3] }, names)).toBe('AMP/STATE\nFAULT')
		expect(showLabel(label, { values: [2, 0, 3] }, names)).toBe('AMP/STATE\nFAULT')
	})

	it('shows the number for a state with no name, and nothing under the role path until the state is read', async () => {
		const label = await labelText([['AMP/STATE', stateSensor(1)]], 'AMP/STATE')

		expect(showLabel(label, { values: [3, 0, 3] }, ['IDLE', 'RUNNING', 'FAULT'])).toBe('AMP/STATE\n3')
		// Names not read yet
		expect(showLabel(label, { values: [1, 0, 3] }, '$NA')).toBe('AMP/STATE\n1')
		expect(showLabel(label, { values: [] }, ['IDLE'])).toBe('AMP/STATE\n')
	})

	it("shows a state sensor's number, and doesn't read names, where the device doesn't implement them", async () => {
		const { presets } = await define([['AMP/STATE', unnamedStateSensor(1)]])
		const preset = presets['status_OcaStateSensor_AMP/STATE']
		if (preset?.type !== 'layered') throw new Error('No layered preset')

		expect(preset.localVariables?.map((variable) => variable.variableName)).toEqual(['reading'])
		const label = await labelText([['AMP/STATE', unnamedStateSensor(1)]], 'AMP/STATE')
		expect(label).not.toContain('names')
		expect(showLabel(label, { values: [2, 0, 3] })).toBe('AMP/STATE\n2')
	})

	it('covers the boolean and state sensor classes', () => {
		expect(STATUS_CLASSES.map((status) => status.className)).toEqual(['OcaBooleanSensor', 'OcaStateSensor'])
	})
})
