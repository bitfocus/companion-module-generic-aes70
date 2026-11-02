import {
	combineRgb,
	type CompanionLayeredButtonPresetDefinition,
	type CompanionPresetDefinitions,
	type CompanionPresetGroup,
} from '@companion-module/base'
import type ModuleInstance from '../main.js'
import type { PropertyDescription } from '../OcaHelper.js'
import type { OcaModuleTypes } from '../types.js'
import { OCA_CLASS_NAMES } from '../consts/aes70-constants.js'
import { ocaClassNameToLabel } from '../utils.js'
import {
	activeOverrides,
	classGroups,
	labelElements,
	numberWithUnit,
	templateText,
	type ActiveColors,
} from './consts.js'

/** The classes with status presets. Add a class here and to STATUS_CLASSES to give it presets. */
export type StatusClassName = typeof OCA_CLASS_NAMES.OcaBooleanSensor | typeof OCA_CLASS_NAMES.OcaStateSensor

/** A class whose objects each get a button that lights while a boolean reading is true. */
export interface BooleanStatusClass {
	readonly kind: 'boolean'
	readonly className: StatusClassName
	/** The boolean property shown. */
	readonly property: string
	readonly activeColors: ActiveColors
}

/** A class whose objects each get a button naming the state they are in. */
export interface StateStatusClass {
	readonly kind: 'state'
	readonly className: StatusClassName
	/** The state property shown, whose getter returns its limits after the value. */
	readonly property: string
	/** A string list property naming each state, the first naming the lowest. */
	readonly names: string
}

export type StatusClass = BooleanStatusClass | StateStatusClass

export const STATUS_CLASSES: readonly StatusClass[] = [
	// Amber rather than a toggle's green: a generic sensor's true can be good or bad news. On the NAM, 20 of
	// its 41 are fault flags (AMP/CH0/ERROC and the like), which green would show as all well
	{
		kind: 'boolean',
		className: OCA_CLASS_NAMES.OcaBooleanSensor,
		property: 'Reading',
		// White text is unreadable on amber
		activeColors: { background: combineRgb(255, 191, 0), text: combineRgb(0, 0, 0) },
	},
	// Never lit: which states are good news and which bad is up to the device, so the name says it all
	{ kind: 'state', className: OCA_CLASS_NAMES.OcaStateSensor, property: 'State', names: 'StateNames' },
]

/** The button's local variable, holding the reading from a Get Property feedback. */
const STATUS_VARIABLE = 'reading'

/**
 * A button for the object at `rolePath`, labelled with its role path, that lights while the reading is
 * true. A sensor is read-only, so the button has no actions. Until the reading is known it stays unlit.
 */
function booleanPreset(
	status: BooleanStatusClass,
	rolePath: string,
): CompanionLayeredButtonPresetDefinition<OcaModuleTypes> {
	const { className, property } = status
	return {
		type: 'layered',
		name: `${ocaClassNameToLabel(className)} - ${rolePath}`,
		elements: labelElements(rolePath),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{
				feedbackId: 'internal:checkExpression',
				options: { expression: `$(local:${STATUS_VARIABLE}) == true` },
				styleOverrides: activeOverrides(status.activeColors),
			},
		],
		localVariables: [
			{
				variableType: 'feedback',
				variableName: STATUS_VARIABLE,
				feedbackId: `get_property_${className}`,
				options: { objectId: rolePath, property, sync: true },
			},
		],
	}
}

/**
 * A button for the object at `rolePath`, labelled with its role path and then the name of the state it
 * is in. It shows the state's number instead where the device names no states, or none for this one,
 * and nothing under the role path until the state is read. Read-only, and never lit, like a boolean
 * sensor's button but without even its amber.
 *
 * `range` holds the getter's result without sync, `{ values: [state, min, max] }`, since the names run
 * from the lowest state rather than from zero, so the state's name is at `state - min`.
 */
function statePreset(
	status: StateStatusClass,
	rolePath: string,
	properties: readonly PropertyDescription[],
): CompanionLayeredButtonPresetDefinition<OcaModuleTypes> {
	const { className, property } = status
	const [value, min] = [0, 1].map((index) => `$(local:${STATUS_VARIABLE}).values[${index}]`)
	// Only when the device has shown it implements the names, so their feedback doesn't fail on every check
	const namesProperty = properties.some((prop) => prop.name === status.names && prop.read) ? status.names : undefined
	const number = numberWithUnit(value, 0)
	const name = `$(local:names)[${value} - ${min}]`
	// Only an array holding that name: a variable not known yet can read as the string $NA, which indexing picks apart
	const shown = namesProperty ? `arrayIncludes($(local:names), ${name}) ? ${name} : ${number}` : number
	return {
		type: 'layered',
		name: `${ocaClassNameToLabel(className)} - ${rolePath}`,
		elements: labelElements({ isExpression: true, value: '`' + templateText(rolePath) + '\\n${' + shown + '}`' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
		localVariables: [
			{
				variableType: 'feedback',
				variableName: STATUS_VARIABLE,
				feedbackId: `get_property_${className}`,
				options: { objectId: rolePath, property, sync: false },
			},
			...(namesProperty
				? [
						{
							variableType: 'feedback' as const,
							variableName: 'names',
							feedbackId: `get_property_${className}` as const,
							options: { objectId: rolePath, property: namesProperty, sync: true },
						},
					]
				: []),
		],
	}
}

function statusPreset(
	status: StatusClass,
	rolePath: string,
	properties: readonly PropertyDescription[],
): CompanionLayeredButtonPresetDefinition<OcaModuleTypes> {
	switch (status.kind) {
		case 'boolean':
			return booleanPreset(status, rolePath)
		case 'state':
			return statePreset(status, rolePath, properties)
		default: {
			const exhaustive: never = status
			return exhaustive
		}
	}
}

/** One group per status class the device has, each holding a button for every object of it. */
export async function getStatusGroups(
	self: ModuleInstance,
	presets: CompanionPresetDefinitions<OcaModuleTypes>,
): Promise<CompanionPresetGroup<OcaModuleTypes>[]> {
	return classGroups(self, 'status', 'read', STATUS_CLASSES, statusPreset, presets)
}
