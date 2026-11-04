import {
	type CompanionValueFeedbackDefinition,
	type CompanionFeedbackDefinitions,
	createModuleLogger,
	type DropdownChoice,
	type JsonValue,
	SomeCompanionFeedbackInputField,
} from '@companion-module/base'
import type ModuleInstance from './main.js'
import {
	ocaClassNameToLabel,
	makeSafeJsonValue,
	unwrapValue,
	excitementEmoji,
	makePropChoices,
	defaultPropertyName,
	isNotImplemented,
	getterOf,
} from './utils.js'
import { type OcaClassName, OCA_CLASS_NAMES } from './consts/aes70-constants.js'
import { isAes70Enum } from './enums.js'
import { Arguments } from 'aes70/src/controller/arguments.js'

type GetPropertyFeedbackKey = `get_property_${OcaClassName}`

type GetPropertyOptions = {
	objectId: string
	property: string
	sync: boolean
} & {
	[K in `enum_${string}`]: boolean
}

type GetPropertyFeedback = {
	type: 'value'
	options: GetPropertyOptions
	result: JsonValue | null
}

export type FeedbackSchema = {
	[K in GetPropertyFeedbackKey]: GetPropertyFeedback
}

function completeFeedbackSchema(
	partial: Partial<CompanionFeedbackDefinitions<FeedbackSchema>>,
): CompanionFeedbackDefinitions<FeedbackSchema> {
	const schema = {} as Partial<CompanionFeedbackDefinitions<FeedbackSchema>>
	for (const className of Object.values(OCA_CLASS_NAMES)) {
		const key: GetPropertyFeedbackKey = `get_property_${className}`
		schema[key] = partial[key] // undefined when not built for this class
	}
	return schema as CompanionFeedbackDefinitions<FeedbackSchema>
}

export async function UpdateFeedbacks(self: ModuleInstance): Promise<void> {
	const feedbackDefinitions: Partial<CompanionFeedbackDefinitions<FeedbackSchema>> = {}
	const logger = createModuleLogger('OCA Feedbacks')
	logger.debug('Updating feedbacks')
	const classes = self.ocaHelper.getClassNames()

	for (const className of classes) {
		const objectChoices = self.ocaHelper.getChoicesByClass(className)
		const properties = await self.ocaHelper.getClassProperties(className)
		const readableProps = properties.filter((p) => p.read)
		if (readableProps.length === 0) {
			logger.debug(`Skipping feedback definition for class ${className} since it has no readable properties`)
			continue
		}

		logger.debug(
			`Class ${className} has ${objectChoices.length} objects and ${properties.filter((p) => p.read).length} readable properties`,
		)
		const options: SomeCompanionFeedbackInputField<keyof GetPropertyOptions>[] = [
			{
				type: 'dropdown',
				id: 'objectId',
				label: 'Control Object',
				choices: objectChoices,
				default: objectChoices[0]?.id,
				allowCustom: false,
				allowInvalidValues: false,
			},
		]
		const propertyChoices: DropdownChoice<string>[] = makePropChoices(readableProps)

		const propertyOption: SomeCompanionFeedbackInputField<keyof GetPropertyOptions> = {
			type: 'dropdown',
			id: 'property',
			label: 'Property',
			choices: propertyChoices,
			// Choices come from the device at runtime; this is the class's own property among them
			default: defaultPropertyName(readableProps) ?? '',
			disableAutoExpression: true,
		}
		options.push(propertyOption)
		const syncOption: SomeCompanionFeedbackInputField<keyof GetPropertyOptions> = {
			type: 'checkbox',
			id: 'sync',
			label: 'Use Property Sync',
			default: true,
			description: 'May return complex data structure when false',
			disableAutoExpression: true,
		}
		options.push(syncOption)
		let hasEnumOption = false
		readableProps.forEach((prop) => {
			if (!prop.enumValues) return
			hasEnumOption = true
			options.push({
				type: 'checkbox',
				id: `enum_${prop.name}`,
				label: 'Enum',
				default: true,
				isVisibleExpression: `$(options:property) == '${prop.name}' && $(options:sync) == true`,
				description: `Return enum label instead of raw value for property ${prop.name}`,
			})
		})
		// disableAutoExpression is only needed to keep isVisibleExpression working for enum options above
		if (!hasEnumOption) {
			propertyOption.disableAutoExpression = false
			syncOption.disableAutoExpression = false
		}
		const feedbackDefinition: CompanionValueFeedbackDefinition<GetPropertyOptions> = {
			name: `${ocaClassNameToLabel(className)} - Get Property`,
			type: 'value',
			options: options,
			callback: async (feedback, context) => {
				const objectId = feedback.options.objectId
				const property = feedback.options.property
				const sync = feedback.options.sync
				const entry = self.ocaHelper.getEntry(objectId)
				if (!entry) {
					// Don't leave it registered to an object it no longer points at
					self.ocaHelper.removeFeedbackId(feedback.id)
					logger.warn(`No entry found for objectId ${objectId}. Aborting feedback check ${feedback.id}`)
					return null
				}
				// Register whenever this feedback isn't registered to its object, not only when previousOptions
				// says the object changed. Companion resets previousOptions each time it re-sends the feedback,
				// which includes every setFeedbackDefinitions, so a registration dropped by a role map reload
				// would otherwise never come back. Once registered, this is just a map lookup.
				if (self.ocaHelper.resolveFeedbackId(feedback.id) !== objectId) {
					// Companion aborts this check when it queues another, and won't start that one until this settles
					await self.ocaHelper.addFeedbackId(objectId, feedback.id, context.signal)
				}
				self.ocaHelper.warnIfPropertyMissing('feedback', feedback.id, objectId, property)
				if (sync) {
					let propValue: unknown = undefined
					entry.properties?.forEach((value, name) => {
						if (name === property && value !== undefined) {
							propValue = value
						}
					})
					if (isAes70Enum(propValue)) {
						// The member name when asked for, falling back to the number for a value outside the enum
						const useEnum = feedback.options[`enum_${property}`]
						return useEnum && propValue.name !== undefined ? ocaClassNameToLabel(propValue.name) : propValue.valueOf()
					}
					if (propValue !== undefined) {
						return unwrapValue(await makeSafeJsonValue(propValue, { awaitPromises: true }))
					}

					// If properties sync check failed
					logger.debug(`property: ${property} not found in entry.properties, trying async getter`)
				}

				// The property's own getter, or the method aes70 says returns it among other values
				const found = getterOf(entry.obj, property)
				const getter = found && (entry.obj as unknown as Record<string, unknown>)[found.name]
				if (!found || typeof getter !== 'function') {
					logger.warn(
						`${feedback.feedbackId}\\${feedback.id}: No getter for '${property}' found on object at '${objectId}'. Aborting feedback check ${feedback.id}`,
					)
					return null
				}
				let result: unknown
				try {
					result = await (getter as () => Promise<unknown>).call(entry.obj)
				} catch (err) {
					if (isNotImplemented(err)) {
						throw new Error(
							`'${objectId}' does not implement property '${property}'. Aborting feedback check ${feedback.id}`,
							{
								cause: err,
							},
						)
					}
					throw err
				}
				// Synced, a getter returning several values gives just this property's, as aes70's own sync
				// does. Anything else is the value itself, which may be a list
				if (sync) {
					const value = result instanceof Arguments ? result.values[found.index] : result
					return unwrapValue(await makeSafeJsonValue(value, { awaitPromises: true }))
				}
				return await makeSafeJsonValue(result, { awaitPromises: true })
			},
			unsubscribe: (feedback) => {
				self.ocaHelper.removeFeedbackId(feedback.id)
			},
		}
		feedbackDefinitions[`get_property_${className}`] = feedbackDefinition
	}

	const feedbackCount = Object.keys(feedbackDefinitions).length
	logger.info(`Completed feedback definitions: ${feedbackCount} feedbacks defined (${excitementEmoji(feedbackCount)})`)

	self.setFeedbackDefinitions(completeFeedbackSchema(feedbackDefinitions))
}
