import {
	type CompanionActionDefinition,
	type CompanionActionDefinitions,
	type CompanionActionSchema,
	createModuleLogger,
	DropdownChoice,
	type SomeCompanionActionInputField,
} from '@companion-module/base'
import type ModuleInstance from './main.js'
import {
	ocaClassNameToLabel,
	excitementEmoji,
	makePropChoices,
	defaultPropertyName,
	isNotImplemented,
	accessorName,
} from './utils.js'
import { type OcaClassName, OCA_CLASS_NAMES } from './consts/aes70-constants.js'
import { enumChoices, enumExpressionDescription, isAes70Enum } from './enums.js'
import {
	CLASS_COMMANDS,
	commandsFor,
	isCommandClass,
	methodPairFor,
	settablePropertiesOf,
	structFieldFor,
	type CommandClassName,
	type SettableProperty,
} from './aes70Properties.js'
import type { OcaRoot } from 'aes70/src/controller/ControlClasses.js'

type SetPropertyActionKey = `set_property_${OcaClassName}`

type SetPropertyOptions = {
	objectId: string
	property: string
} & {
	[K in `value_${string}`]: string | number | boolean
}

type SetPropertyAction = {
	options: SetPropertyOptions
}

type SetPropertyActionSchema = CompanionActionSchema<SetPropertyOptions, void>

type RunCommandActionKey = `run_command_${CommandClassName}`

type RunCommandOptions = {
	objectId: string
	command: string
}

type RunCommandActionSchema = CompanionActionSchema<RunCommandOptions, void>

export type ActionSchema = {
	[K in SetPropertyActionKey]: SetPropertyAction
} & {
	[K in RunCommandActionKey]: { options: RunCommandOptions }
}

/**
 * The option value to learn from a property's current value, or `undefined` when
 * there is no input it could be learned into. aes70 represents enum values as
 * Enum instances, whereas the enum dropdown's choice ids are their numeric values.
 */
function toLearnedValue(value: unknown): boolean | string | number | undefined {
	if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') return value
	if (isAes70Enum(value)) return value.valueOf()
	return undefined
}

/**
 * The struct an object last reported for `property`, as a plain object. Spreading it drops the aes70
 * class, which the encoder doesn't need: it reads the fields by name and checks each one encodes.
 */
function currentStructValue(
	entry: { properties?: { forEach: (cb: (value: unknown, name: string) => void) => void } },
	property: string,
): Record<string, unknown> | undefined {
	let current: Record<string, unknown> | undefined
	entry.properties?.forEach((value, name) => {
		if (name === property && typeof value === 'object' && value !== null) current = { ...value }
	})
	return current
}

/** The value input for a settable property, visible only while that property is selected. */
function valueInputFor(prop: SettableProperty): SomeCompanionActionInputField<keyof SetPropertyOptions> {
	const id = `value_${prop.name}` as const
	const label = ocaClassNameToLabel(prop.name)
	const isVisibleExpression = `$(options:property) == '${prop.name}'`

	switch (prop.kind) {
		case 'boolean':
			return { type: 'checkbox', id, label, default: true, isVisibleExpression }
		case 'string':
			return { type: 'textinput', id, label, default: '', useVariables: true, isVisibleExpression }
		case 'number':
			return {
				type: 'number',
				id,
				label,
				default: 0,
				min: -Number.MAX_VALUE,
				max: Number.MAX_VALUE,
				isVisibleExpression,
			}
		case 'enum': {
			const choices = enumChoices(prop.enumValues)
			return {
				type: 'dropdown',
				id,
				label,
				default: choices[0]?.id ?? 0,
				choices,
				allowCustom: false,
				isVisibleExpression,
				expressionDescription: enumExpressionDescription(prop.enumValues),
			}
		}
		default: {
			const _exhaustive: never = prop
			throw new Error(`Unhandled property kind: ${JSON.stringify(_exhaustive)}`)
		}
	}
}

function completeActionSchema(
	partial: Partial<CompanionActionDefinitions<ActionSchema>>,
): CompanionActionDefinitions<ActionSchema> {
	const schema = {} as Partial<CompanionActionDefinitions<ActionSchema>>
	for (const className of Object.values(OCA_CLASS_NAMES)) {
		const key: SetPropertyActionKey = `set_property_${className}`
		schema[key] = partial[key] // undefined when not built for this class
	}
	for (const className of Object.keys(CLASS_COMMANDS) as CommandClassName[]) {
		const key: RunCommandActionKey = `run_command_${className}`
		schema[key] = partial[key]
	}
	return schema as CompanionActionDefinitions<ActionSchema>
}

/**
 * An action calling one of the commands objects of `className` take, from CLASS_COMMANDS. It reads
 * nothing from the object, so unlike Set Property it doesn't register with it.
 */
function runCommandAction(
	self: ModuleInstance,
	className: OcaClassName,
	objectChoices: DropdownChoice[],
	sample: OcaRoot,
): CompanionActionDefinition<RunCommandActionSchema> | undefined {
	const commandChoices: DropdownChoice<string>[] = commandsFor(sample).map(({ method, label }) => ({
		id: method,
		label,
	}))
	if (commandChoices.length === 0) return undefined
	return {
		name: `${ocaClassNameToLabel(className)} - Run Command`,
		options: [
			{
				type: 'dropdown',
				id: 'objectId',
				label: 'Control Object',
				choices: objectChoices,
				default: objectChoices[0]?.id,
				allowCustom: false,
				allowInvalidValues: false,
			},
			{
				type: 'dropdown',
				id: 'command',
				label: 'Command',
				choices: commandChoices,
				default: commandChoices[0].id,
			},
		],
		hasResult: false,
		callback: async (action) => {
			const { objectId, command } = action.options
			const entry = self.ocaHelper.getEntry(objectId)
			if (!entry) {
				throw new Error(`No entry found for objectId ${objectId}. Aborting action ${action.id}`)
			}
			// Checked against the table, since an expression can give the option any string at all
			const known = commandsFor(entry.obj).find((candidate) => candidate.method === command)
			if (!known) {
				throw new Error(`'${command}' is not a command '${objectId}' takes. Aborting action ${action.id}`)
			}
			const method = (entry.obj as unknown as Record<string, () => Promise<void>>)[known.method]
			try {
				await method.call(entry.obj)
			} catch (err) {
				if (isNotImplemented(err)) {
					throw new Error(`'${objectId}' does not implement '${command}'. Aborting action ${action.id}`, {
						cause: err,
					})
				}
				throw err
			}
		},
	}
}

export async function UpdateActions(self: ModuleInstance): Promise<void> {
	const actionDefinitions: Partial<CompanionActionDefinitions<ActionSchema>> = {}
	const logger = createModuleLogger('OCA Actions')
	logger.debug('Updating actions')
	const classes = self.ocaHelper.getClassNames()

	for (const className of classes) {
		const objectChoices = self.ocaHelper.getChoicesByClass(className)
		const [samplePath] = self.ocaHelper.getByClass(className)
		const sample = samplePath === undefined ? undefined : self.ocaHelper.getEntry(samplePath)
		if (!sample) continue

		if (isCommandClass(className)) {
			actionDefinitions[`run_command_${className}`] = runCommandAction(self, className, objectChoices, sample.obj)
		}

		// Value inputs follow aes70's class definition, so they stay the same however many properties are
		// discovered on the device, and every action has a stored value for each of them from creation
		const settable = settablePropertiesOf(sample.obj)
		const settableNames = new Set(settable.map((prop) => prop.name))
		// The Property dropdown offers only what objects of the class are known to implement
		const offered = (await self.ocaHelper.getClassProperties(className)).filter((prop) => settableNames.has(prop.name))
		if (offered.length === 0) {
			logger.debug(`Skipping action definition for class ${className}: no settable properties known to be implemented`)
			continue
		}
		logger.debug(
			`Class ${className} has ${objectChoices.length} objects, and ${offered.length} of its ${settable.length} settable properties are known to be implemented`,
		)

		const propertyChoices: DropdownChoice<string>[] = makePropChoices(offered)
		const options: SomeCompanionActionInputField<keyof SetPropertyOptions>[] = [
			{
				type: 'dropdown',
				id: 'objectId',
				label: 'Control Object',
				choices: objectChoices,
				default: objectChoices[0]?.id,
				allowCustom: false,
				allowInvalidValues: false,
			},
			{
				type: 'dropdown',
				id: 'property',
				label: 'Property',
				choices: propertyChoices,
				// Choices come from the device at runtime; this is the class's own property among them
				default: defaultPropertyName(offered) ?? '',
				disableAutoExpression: true,
			},
			...settable.map(valueInputFor),
		]

		const actionDefinition: CompanionActionDefinition<SetPropertyActionSchema> = {
			name: `${ocaClassNameToLabel(className)} - Set Property`,
			options: options,
			optionsToMonitorForSubscribe: ['objectId'],
			// Companion re-sends every action whenever definitions change, which they do as properties are
			// discovered. Unsubscribing first would drop an object's only registration and read all of its
			// properties from the device again each time. addActionId moves a registration when the object changes.
			skipUnsubscribeOnOptionsChange: true,
			hasResult: false,
			subscribe: async (action) => {
				const objectId = action.options.objectId
				if (objectId) {
					await self.ocaHelper.addActionId(objectId, action.id)
					self.ocaHelper.warnIfPropertyMissing('action', action.id, objectId, action.options.property)
				}
			},
			unsubscribe: (action) => {
				self.ocaHelper.removeActionId(action.id)
			},
			learn: async (action) => {
				const objectId = action.options.objectId
				const property = action.options.property
				logger.debug(`Learning action for objectId ${objectId} and property ${property}`)
				const entry = self.ocaHelper.getEntry(objectId)
				if (!entry) {
					logger.warn(`No entry found for objectId ${objectId}`)
					return undefined
				}
				// PropertySync does not support index access — iterate to find the value
				let propValue: boolean | string | number | undefined
				entry.properties?.forEach((value, name) => {
					if (name === property) propValue = toLearnedValue(value)
				})
				if (propValue === undefined) {
					logger.warn(`Property ${property} not found or has unsupported type on entry with objectId ${objectId}`)
					return undefined
				}
				return { [`value_${property}`]: propValue }
			},
			callback: async (action) => {
				const objectId = action.options.objectId
				const property = action.options.property
				const value = action.options[`value_${property}`]

				const entry = self.ocaHelper.getEntry(objectId)
				if (!entry) {
					throw new Error(`No entry found for objectId ${objectId}. Aborting action ${action.id}`)
				}
				// A few booleans are changed by calling one of a pair of methods rather than a setter,
				// so which one to call depends on the value being set
				const methods = methodPairFor(entry.obj, property)
				// A struct property takes its whole value, so the field being set is put back into the
				// current one and everything else the device reported is carried through untouched
				const structField = structFieldFor(entry.obj, property)
				const setterName = methods
					? value === true
						? methods.on
						: methods.off
					: accessorName(entry.obj, 'Set', property)
				const setter = setterName && (entry.obj as unknown as Record<string, unknown>)[setterName]
				if (typeof setter !== 'function') {
					throw new Error(`No setter for '${property}' found on object at '${objectId}'. Aborting action ${action.id}`)
				}
				try {
					// A method-backed property carries its value in which method was picked, so it takes none
					if (methods) {
						await (setter as () => Promise<void>).call(entry.obj)
					} else if (structField) {
						const current = currentStructValue(entry, property)
						if (!current) {
							throw new Error(
								`'${objectId}' has not reported '${property}', so the rest of it can't be carried through. Aborting action ${action.id}`,
							)
						}
						await (setter as (v: Record<string, unknown>) => Promise<void>).call(entry.obj, {
							...current,
							[structField.field]: value,
						})
					} else {
						await (setter as (v: boolean | string | number) => Promise<void>).call(entry.obj, value)
					}
				} catch (err) {
					if (isNotImplemented(err)) {
						// The only way to learn this: a device can serve a property's value and still refuse
						// to set it, and AES70 has no way to ask beforehand
						self.ocaHelper.markWriteRefused(objectId, property)
						throw new Error(`'${objectId}' does not implement property '${property}'. Aborting action ${action.id}`, {
							cause: err,
						})
					}
					throw err
				}
			},
		}
		actionDefinitions[`set_property_${className}`] = actionDefinition
	}

	const actionCount = Object.keys(actionDefinitions).length
	logger.info(`Completed action definitions: ${actionCount} actions defined (${excitementEmoji(actionCount)})`)

	self.setActionDefinitions(completeActionSchema(actionDefinitions))
}
