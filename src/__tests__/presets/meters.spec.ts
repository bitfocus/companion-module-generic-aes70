import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as ControlClasses from 'aes70/src/controller/ControlClasses.js'
import { type OcaRoot } from 'aes70/src/controller/ControlClasses.js'
import { Arguments } from 'aes70/src/controller/arguments.js'
import { METER_CLASSES } from '../../presets/meters.js'
import { CompositeElementId } from '../../composites.js'
import {
	audioLevelSensor,
	expectOptionsOffered,
	labelOf,
	levelSensor,
	makeHarness,
	makeObject,
	type ControlClass,
	type DefinitionShape,
	type PresetEntry,
	type PresetHarness,
	type RoleMap,
} from './helpers.js'

describe('meter presets', () => {
	let ctx: PresetHarness

	beforeEach(() => {
		ctx = makeHarness()
	})

	const define = async (roleMap: RoleMap): ReturnType<PresetHarness['define']> => ctx.define(roleMap)

	it('shows a level sensor reading in dB above a bar along the bottom of the button', async () => {
		const { presets } = await define([['CHLEVELS/INS0', levelSensor(1)]])

		expect(presets['meter_OcaLevelSensor_CHLEVELS/INS0']).toEqual({
			type: 'layered',
			name: 'Level Sensor - CHLEVELS/INS0',
			elements: [
				{ type: 'box', id: 'background', name: 'Background', color: 0x000000 },
				{
					type: 'text',
					id: 'label',
					name: 'Label',
					// The unit is in a nested template literal, since Companion's + adds numbers rather than
					// joining strings. Before the first reading the line is empty, not "$NA dB"
					text: {
						isExpression: true,
						value:
							"`CHLEVELS/INS0\\n${isNumber($(local:level).values[0]) ? `${round($(local:level).values[0] * 10) / 10} dB` : ''}`",
					},
					// Clear of the bar below it
					height: 90,
					fontsize: 22,
					color: 0xffffff,
				},
				{
					type: 'composite',
					id: 'meter',
					name: 'Signal Meter',
					elementId: 'meter',
					// Reading, then the sensor's own limits, all from the one read. The bottom is the higher of the
					// button's floor and the device's minimum
					options: {
						level: { isExpression: true, value: '$(local:level).values[0]' },
						min: { isExpression: true, value: 'max($(local:meter_min), $(local:level).values[1])' },
						max: { isExpression: true, value: '$(local:level).values[2]' },
						position: 'bottom',
						padding: 2,
						// A signal level, so it keeps the metering scale and the colour goes unused
						scheme: 'meter',
						color: 0x00cc00,
					},
				},
			],
			// A sensor is read-only, so nothing on the button writes to the device
			steps: [{ down: [], up: [] }],
			feedbacks: [],
			localVariables: [
				// The NAM's level sensors report -126..0, and a level is metered in its top 60 dB. Editable on
				// the button, for a device or a use that wants more or less of it
				{ variableType: 'simple', variableName: 'meter_min', startupValue: -60 },
				{
					variableType: 'feedback',
					variableName: 'level',
					feedbackId: 'get_property_OcaLevelSensor',
					options: { objectId: 'CHLEVELS/INS0', property: 'Reading', sync: false },
				},
			],
		})
	})

	// The label and the bar both index into this shape. aes70 declares GetReading as
	// Arguments<[number, number, number]>, so it decodes like the actuators' getters. The reading is the
	// NAM's CHLEVELS/OUTS4 on 2026-09-25, with no signal playing: noise just above its -126 dB floor
	it("gets a sensor's reading and limits from the Get Property feedback without sync, as { values: [reading, min, max] }", async () => {
		const { presets } = await define([['CHLEVELS/INS0', levelSensor(1)]])
		const preset = presets['meter_OcaLevelSensor_CHLEVELS/INS0']
		if (preset?.type !== 'layered') throw new Error('No layered level sensor preset')
		const level = preset.localVariables?.find((variable) => variable.variableName === 'level') as PresetEntry
		;(ctx.helper.getObject('CHLEVELS/INS0') as unknown as { GetReading: unknown }).GetReading = vi
			.fn()
			.mockResolvedValue(new Arguments([-97.5, -126, 0]))

		const feedback = ctx.setFeedbackDefinitions.mock.lastCall?.[0].get_property_OcaLevelSensor as unknown as {
			callback: (event: unknown, context: unknown) => Promise<unknown>
		}
		const result = await feedback.callback(
			{ type: 'value', id: 'fb1', controlId: 'bank:1:1', feedbackId: level.feedbackId, options: level.options },
			{ type: 'feedback', signal: new AbortController().signal },
		)

		expect(result).toEqual({ values: [-97.5, -126, 0] })
	})

	// Reading has a getter and no setter, so requiring a writable property would leave both classes out
	it('gives both sensor classes meter presets, though their reading can only be read', async () => {
		const { structure, presets } = await define([
			['CHLEVELS/INS0', levelSensor(1)],
			['CHLEVELS/INS1', levelSensor(2)],
			['AMP/CH0/LEVEL', audioLevelSensor(3)],
		])

		expect(structure).toEqual([
			{
				id: 'meters',
				name: 'Meters',
				definitions: [
					{
						id: 'meter_OcaLevelSensor',
						type: 'simple',
						name: 'Level Sensor',
						presets: ['meter_OcaLevelSensor_CHLEVELS/INS0', 'meter_OcaLevelSensor_CHLEVELS/INS1'],
					},
					{
						id: 'meter_OcaAudioLevelSensor',
						type: 'simple',
						// Reading is inherited from OcaLevelSensor
						name: 'Audio Level Sensor',
						presets: ['meter_OcaAudioLevelSensor_AMP/CH0/LEVEL'],
					},
				],
			},
		])
		const audio = presets['meter_OcaAudioLevelSensor_AMP/CH0/LEVEL']
		if (audio?.type !== 'layered') throw new Error('No layered audio level sensor preset')
		expect(audio.localVariables?.at(-1)).toEqual({
			variableType: 'feedback',
			variableName: 'level',
			feedbackId: 'get_property_OcaAudioLevelSensor',
			options: { objectId: 'AMP/CH0/LEVEL', property: 'Reading', sync: false },
		})
	})

	it('gives every meter class a group, with its own unit and colours, from one readable Reading', async () => {
		const roleMap = METER_CLASSES.map(({ className, property }, i): [string, OcaRoot] => [
			`${className}/1`,
			makeObject(ControlClasses[className] as unknown as ControlClass, i + 1, [
				['Enabled', true],
				[property, 0],
			]),
		])
		const { structure, presets } = await define(roleMap)
		const feedbacks = ctx.setFeedbackDefinitions.mock.lastCall?.[0] as unknown as Record<string, DefinitionShape>

		// A class aes70 has no Reading on would silently lose its group
		expect(structure.find((section) => section.id === 'meters')?.definitions).toEqual(
			METER_CLASSES.map(({ className }) => expect.objectContaining({ id: `meter_${className}` })),
		)
		for (const meter of METER_CLASSES) {
			const id = `meter_${meter.className}_${meter.className}/1`
			const preset = presets[id]
			if (preset?.type !== 'layered') throw new Error(`No layered ${meter.className} preset`)

			const text = (labelOf(preset) as { text: { value: string } }).text.value
			// Inside the isNumber guard, so an unread reading shows nothing rather than a bare unit
			if (meter.unit === undefined) expect(text, meter.className).not.toContain('} ')
			else expect(text, meter.className).toContain(`} ${meter.unit}\``)

			const bar = preset.elements.find((element) => element.id === 'meter')
			if (bar?.type !== 'composite' || bar.elementId !== CompositeElementId.Meter) throw new Error(`No meter on ${id}`)
			// Only the signal level classes keep the green-to-red scale; the rest name a flat colour
			expect(bar.options.scheme, meter.className).toBe(meter.color === undefined ? 'meter' : 'custom')
			if (meter.color !== undefined) expect(bar.options.color, meter.className).toBe(meter.color)
			// Only a class with a floor carries the variable, and only there does the bar stop short of the device's minimum
			const floor = preset.localVariables?.find((variable) => variable.variableName === 'meter_min')
			expect(floor, meter.className).toEqual(
				meter.floor === undefined
					? undefined
					: { variableType: 'simple', variableName: 'meter_min', startupValue: meter.floor },
			)
			expect(bar.options.min, meter.className).toEqual({
				isExpression: true,
				value:
					meter.floor === undefined ? '$(local:level).values[1]' : 'max($(local:meter_min), $(local:level).values[1])',
			})
			for (const variable of (preset.localVariables ?? []) as PresetEntry[]) {
				if (variable.feedbackId) expectOptionsOffered(feedbacks[variable.feedbackId], variable.options)
			}
		}
		// The level and temperature classes are the only ones metered on the audio scale: headroom on the one,
		// cool to hot on the other
		expect(METER_CLASSES.filter((meter) => meter.color === undefined).map((meter) => meter.className)).toEqual([
			'OcaLevelSensor',
			'OcaAudioLevelSensor',
			'OcaTemperatureSensor',
		])
		// Only the levels get a floor; a temperature's bar runs across the device's whole range
		expect(METER_CLASSES.filter((meter) => meter.floor !== undefined).map((meter) => meter.className)).toEqual([
			'OcaLevelSensor',
			'OcaAudioLevelSensor',
		])
	})

	// Pinned because the set was asked for by name. OcaIdentificationSensor is deliberately absent: it
	// signals an identify press as an event and has no Reading. OcaPowerSensor is absent too: as of aes70
	// 2.0.21 its Power and PowerFactor properties aren't tied to GetReading, its only getter, so neither
	// can be read. GetReading also returns four values (power, power factor and the power limits) rather
	// than the [reading, min, max] the bar and label index into
	it('meters every numeric sensor class aes70 has a three-value Reading for', async () => {
		expect(METER_CLASSES.map((meter) => meter.className)).toEqual([
			'OcaLevelSensor',
			'OcaAudioLevelSensor',
			'OcaTimeIntervalSensor',
			'OcaFrequencySensor',
			'OcaTemperatureSensor',
			'OcaVoltageSensor',
			'OcaCurrentSensor',
			'OcaImpedanceSensor',
			'OcaGainSensor',
			'OcaInt8Sensor',
			'OcaInt16Sensor',
			'OcaInt32Sensor',
			'OcaInt64Sensor',
			'OcaUint8Sensor',
			'OcaUint16Sensor',
			'OcaUint32Sensor',
			'OcaUint64Sensor',
			'OcaFloat32Sensor',
			'OcaFloat64Sensor',
		])
		// Every one of them reads the same property, so the group builder's check is the same for all
		expect(METER_CLASSES.every((meter) => meter.property === 'Reading')).toBe(true)
	})
})
