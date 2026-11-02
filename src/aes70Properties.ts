import { OcaBoolean } from 'aes70/src/OCP1/OcaBoolean.js'
import { OcaString } from 'aes70/src/OCP1/OcaString.js'
import { OcaInt8 } from 'aes70/src/OCP1/OcaInt8.js'
import { OcaInt16 } from 'aes70/src/OCP1/OcaInt16.js'
import { OcaInt32 } from 'aes70/src/OCP1/OcaInt32.js'
import { OcaUint8 } from 'aes70/src/OCP1/OcaUint8.js'
import { OcaUint16 } from 'aes70/src/OCP1/OcaUint16.js'
import { OcaUint32 } from 'aes70/src/OCP1/OcaUint32.js'
import { OcaFloat32 } from 'aes70/src/OCP1/OcaFloat32.js'
import { OcaFloat64 } from 'aes70/src/OCP1/OcaFloat64.js'
import type { OcaRoot } from 'aes70/src/controller/ControlClasses.js'
import { enumValuesOf, isAes70Enum, type EnumValues } from './enums.js'
import { accessorName } from './utils.js'

/*
 * The settable properties of an aes70 control class, typed from aes70's own class
 * definition rather than from a value read off the device.
 *
 * The action's value inputs are built from these, so they stay the same however many
 * properties are discovered on the device. That matters because Companion stores a
 * default for every option when an action is created, and nothing for an option added
 * to the definition afterwards: such an option would reach the action as `false`, as an
 * empty string, or fail validation, instead of the default the editor shows.
 *
 * Types come from each property's encoder in aes70: the primitive encoders by identity,
 * and an enum by the member values its encoder exposes. Both are aes70 implementation
 * details, so aes70Properties.spec.ts pins them against real aes70 classes.
 */

export type SettableProperty =
	| { readonly name: string; readonly kind: 'boolean' | 'string' | 'number' }
	| { readonly name: string; readonly kind: 'enum'; readonly enumValues: EnumValues }

export type SettableKind = SettableProperty['kind']

/**
 * Encoders that map to a simple input. OcaInt64 and OcaUint64 are deliberately absent:
 * they decode to a bigint, which a number input cannot represent.
 */
const PRIMITIVE_KINDS = new Map<unknown, 'boolean' | 'string' | 'number'>([
	[OcaBoolean, 'boolean'],
	[OcaString, 'string'],
	[OcaInt8, 'number'],
	[OcaInt16, 'number'],
	[OcaInt32, 'number'],
	[OcaUint8, 'number'],
	[OcaUint16, 'number'],
	[OcaUint32, 'number'],
	[OcaFloat32, 'number'],
	[OcaFloat64, 'number'],
])

/** The enum an encoder encodes, found through the member values it exposes, or `undefined`. */
function enumValuesOfEncoder(encoder: object): EnumValues | undefined {
	for (const name of Object.getOwnPropertyNames(encoder)) {
		let member: unknown
		try {
			member = (encoder as Record<string, unknown>)[name]
		} catch {
			continue
		}
		if (isAes70Enum(member)) return enumValuesOf(member)
	}
	return undefined
}

/**
 * Boolean properties a device changes through a pair of methods instead of a setter, keyed by class
 * and property. AES70 calls these read-only, and strictly they are: the value is a report, and the
 * thing the operator wants is the pair of methods behind it.
 *
 * This is deliberately a short explicit list rather than anything inferred. Most of aes70's methods
 * take arguments or destroy something — DeleteMember, ChangePreSharedKey, ApplyPatch — so a general
 * "call a method" action would be far more dangerous than useful. A pair of parameterless methods
 * that between them set one boolean is the rare case worth carrying, and a signal generator's
 * Start and Stop are the clearest example of it: whether the tone is running is the whole point of
 * the object.
 */
const METHOD_BACKED_PROPERTIES: Readonly<Record<string, Readonly<Record<string, MethodPair>>>> = {
	OcaSignalGenerator: { Generating: { on: 'Start', off: 'Stop' } },
}

/** The methods that turn a method-backed property on and off. */
export interface MethodPair {
	readonly on: string
	readonly off: string
}

/**
 * The pair of methods `property` is set through, where it has one and `obj` really carries them.
 * Checking the object keeps a class that only declares them in its typings from being offered.
 */
export function methodPairFor(obj: OcaRoot, property: string): MethodPair | undefined {
	const className = (obj as unknown as { ClassName?: string }).ClassName
	const pair = className === undefined ? undefined : METHOD_BACKED_PROPERTIES[className]?.[property]
	if (!pair) return undefined

	const methods = obj as unknown as Record<string, unknown>
	return typeof methods[pair.on] === 'function' && typeof methods[pair.off] === 'function' ? pair : undefined
}

/** A method an action calls with no arguments, and the label it goes by in the action's dropdown. */
export interface Command {
	readonly method: string
	readonly label: string
}

/**
 * Methods taking no arguments that an action calls outright, keyed by class: commands, where the
 * method pairs above stand for one boolean. A recorder/player's transport drives a state of five
 * values, and a task agent's run a task through its states, so neither is a property to set.
 *
 * An explicit list for the same reason as the method pairs. Open, ActionPrepare and ActionRun are
 * left out because they take arguments a button can't sensibly supply: a dataset's object number,
 * an execution parameter blob. Without Open, Play and Record only work on a session something else
 * has opened. Any method missing from here can't be called, whatever an expression says.
 */
export const CLASS_COMMANDS = {
	OcaMediaRecorderPlayer: [
		{ method: 'Play', label: 'Play' },
		// Overwrites the record/play window from the current position to its end, as any record button would
		{ method: 'Record', label: 'Record' },
		{ method: 'Stop', label: 'Stop' },
		{ method: 'Reset', label: 'Reset' },
		{ method: 'Close', label: 'Close' },
	],
	OcaTaskAgent: [
		{ method: 'ActionStart', label: 'Start' },
		{ method: 'ActionStop', label: 'Stop' },
		// Back to Ready, keeping the program, so Start runs it again
		{ method: 'ActionReset', label: 'Reset' },
		// Forgets the program, back to NotPrepared. Nothing here can prepare one again, so after this
		// Start fails until something else does
		{ method: 'ActionClear', label: 'Clear' },
	],
} as const satisfies Readonly<Record<string, readonly Command[]>>

/** The classes with commands. */
export type CommandClassName = keyof typeof CLASS_COMMANDS

export function isCommandClass(className: string): className is CommandClassName {
	return Object.hasOwn(CLASS_COMMANDS, className)
}

/**
 * The commands `obj` takes, keeping only those it really carries, as methodPairFor does. Keyed by the
 * object's own class, so a subclass doesn't inherit commands it may not mean the same way.
 */
export function commandsFor(obj: OcaRoot): readonly Command[] {
	const className = (obj as unknown as { ClassName?: string }).ClassName
	if (className === undefined || !isCommandClass(className)) return []
	const methods = obj as unknown as Record<string, unknown>
	return CLASS_COMMANDS[className].filter((command) => typeof methods[command.method] === 'function')
}

/**
 * Properties held as a struct where one field is the thing an operator sets, keyed by class and
 * property. A dynamics threshold is an OcaDBr: a level in dB and the reference it is measured from.
 * The level is what a button changes; the reference is the device's own and is carried through
 * untouched, so setting one never quietly redefines the other.
 *
 * Also an explicit list. Most structs are lists or coordinates where no single field stands for the
 * whole, and guessing which one to expose would be worse than leaving them to the Set Property action.
 */
const STRUCT_FIELD_PROPERTIES: Readonly<Record<string, Readonly<Record<string, StructField>>>> = {
	OcaDynamics: { Threshold: { field: 'Value', kind: 'number' } },
}

/** The one field of a struct property a button sets, and the input it takes. */
export interface StructField {
	readonly field: string
	readonly kind: 'number'
}

/** The field `property` is set through, where it is a struct with one and `obj` has a setter for it. */
export function structFieldFor(obj: OcaRoot, property: string): StructField | undefined {
	const className = (obj as unknown as { ClassName?: string }).ClassName
	const field = className === undefined ? undefined : STRUCT_FIELD_PROPERTIES[className]?.[property]
	return field && accessorName(obj, 'Set', property) !== undefined ? field : undefined
}

/**
 * Every property of `obj`'s class that aes70 can set and an action can offer an input
 * for, in aes70's declaration order, inherited ones first. Properties without a setter,
 * 64-bit integers and structured types are left out, bar the method-backed ones above.
 */
export function settablePropertiesOf(obj: OcaRoot): SettableProperty[] {
	const settable: SettableProperty[] = []
	obj.get_properties().forEach((property) => {
		// Not `Set${name}`: a few of aes70's setters are named after one of the property's aliases
		if (accessorName(obj, 'Set', property.name) === undefined && !methodPairFor(obj, property.name)) return
		const encoder = property.type?.[0]
		if (typeof encoder !== 'object' || encoder === null) return

		const primitive = PRIMITIVE_KINDS.get(encoder)
		if (primitive) {
			settable.push({ name: property.name, kind: primitive })
			return
		}
		// A struct the action sets one field of, the rest carried through from the current value
		const structField = structFieldFor(obj, property.name)
		if (structField) {
			settable.push({ name: property.name, kind: structField.kind })
			return
		}
		const enumValues = enumValuesOfEncoder(encoder)
		if (enumValues) settable.push({ name: property.name, kind: 'enum', enumValues })
	})
	return settable
}
