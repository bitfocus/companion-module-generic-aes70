import {
	OcaActuator,
	OcaAgent,
	OcaApplicationNetwork,
	OcaAudioLevelSensor,
	OcaAudioProcessingManager,
	OcaBasicActuator,
	OcaBasicSensor,
	OcaBitstringActuator,
	OcaBitstringSensor,
	OcaBlock,
	OcaBlockFactoryAgent,
	OcaBooleanActuator,
	OcaBooleanSensor,
	OcaCodingManager,
	OcaCommandSet,
	OcaCommandSetAgent,
	OcaControlNetwork,
	OcaCounterNotifier,
	OcaCurrentSensor,
	OcaDataset,
	OcaDatasetWorker,
	OcaDelay,
	OcaDelayExtended,
	OcaDeviceManager,
	OcaDeviceTimeManager,
	OcaDiagnosticManager,
	OcaDynamics,
	OcaDynamicsCurve,
	OcaDynamicsDetector,
	OcaFilterArbitraryCurve,
	OcaFilterClassical,
	OcaFilterFIR,
	OcaFilterParametric,
	OcaFilterPolynomial,
	OcaFirmwareManager,
	OcaFloat32Actuator,
	OcaFloat32Sensor,
	OcaFloat64Actuator,
	OcaFloat64Sensor,
	OcaFrequencyActuator,
	OcaFrequencySensor,
	OcaGain,
	OcaGainSensor,
	OcaGroup,
	OcaGrouper,
	OcaIdentificationActuator,
	OcaIdentificationSensor,
	OcaImpedanceSensor,
	OcaInt16Actuator,
	OcaInt16Sensor,
	OcaInt32Actuator,
	OcaInt32Sensor,
	OcaInt64Actuator,
	OcaInt64Sensor,
	OcaInt8Actuator,
	OcaInt8Sensor,
	OcaJsonActuator,
	OcaJsonSensor,
	OcaLevelSensor,
	OcaLibraryManager,
	OcaLockManager,
	OcaLog,
	OcaManager,
	OcaMatrix,
	OcaMediaClock,
	OcaMediaClock3,
	OcaMediaClockManager,
	OcaMediaRecorderPlayer,
	OcaMediaTransportApplication,
	OcaMediaTransportNetwork,
	OcaMediaTransportSessionAgent,
	OcaMute,
	OcaNetwork,
	OcaNetworkApplication,
	OcaNetworkInterface,
	OcaNetworkManager,
	OcaNetworkSignalChannel,
	OcaNumericObserver,
	OcaNumericObserverList,
	OcaPanBalance,
	OcaPhysicalPosition,
	OcaPolarity,
	OcaPowerManager,
	OcaPowerSensor,
	OcaPowerSupply,
	OcaProgram,
	OcaRamper,
	OcaRoot,
	OcaSamplingRateConverter,
	OcaSecurityManager,
	OcaSensor,
	OcaSignalGenerator,
	OcaSignalInput,
	OcaSignalOutput,
	OcaStateSensor,
	OcaStreamConnector,
	OcaStreamNetwork,
	OcaStringActuator,
	OcaStringSensor,
	OcaSubscriptionManager,
	OcaSummingPoint,
	OcaSwitch,
	OcaTaskAgent,
	OcaTaskManager,
	OcaTaskScheduler,
	OcaTemperatureActuator,
	OcaTemperatureSensor,
	OcaTimeIntervalSensor,
	OcaTimeSource,
	OcaUint16Actuator,
	OcaUint16Sensor,
	OcaUint32Actuator,
	OcaUint32Sensor,
	OcaUint64Actuator,
	OcaUint64Sensor,
	OcaUint8Actuator,
	OcaUint8Sensor,
	OcaVoltageSensor,
	OcaWorker,
} from 'aes70/src/controller/ControlClasses.js'
import { ObjectBase } from 'aes70/src/controller/object_base.js'
import { CloseError } from 'aes70'
import type { PropertySync, OcaRootProperties } from '../types/aes70.js'
import { OCA_CLASS_NAMES, type OcaClassName } from './consts/aes70-constants.js'
import { createModuleLogger, type DropdownChoice } from '@companion-module/base'
import EventEmitter from 'events'
import { enumValuesOf, isAes70Enum, type EnumValues } from './enums.js'
import { abortable, accessorName, formatLogValue } from './utils.js'
import { methodPairFor } from './aes70Properties.js'

// ---------------------------------------------------------------------------
// Event map
// ---------------------------------------------------------------------------

export interface DetermineOcaClassEvents {
	ObjectBase: [obj: ObjectBase]
	OcaRoot: [obj: OcaRoot]
	OcaWorker: [obj: OcaWorker]
	// --- Actuators ---
	OcaActuator: [obj: OcaActuator]
	OcaMute: [obj: OcaMute]
	OcaPolarity: [obj: OcaPolarity]
	OcaSwitch: [obj: OcaSwitch]
	OcaGain: [obj: OcaGain]
	OcaPanBalance: [obj: OcaPanBalance]
	OcaDelay: [obj: OcaDelay]
	OcaDelayExtended: [obj: OcaDelayExtended]
	OcaFrequencyActuator: [obj: OcaFrequencyActuator]
	OcaFilterClassical: [obj: OcaFilterClassical]
	OcaFilterParametric: [obj: OcaFilterParametric]
	OcaFilterPolynomial: [obj: OcaFilterPolynomial]
	OcaFilterFIR: [obj: OcaFilterFIR]
	OcaFilterArbitraryCurve: [obj: OcaFilterArbitraryCurve]
	OcaDynamics: [obj: OcaDynamics]
	OcaDynamicsDetector: [obj: OcaDynamicsDetector]
	OcaDynamicsCurve: [obj: OcaDynamicsCurve]
	OcaSignalGenerator: [obj: OcaSignalGenerator]
	OcaSignalInput: [obj: OcaSignalInput]
	OcaSignalOutput: [obj: OcaSignalOutput]
	OcaTemperatureActuator: [obj: OcaTemperatureActuator]
	OcaIdentificationActuator: [obj: OcaIdentificationActuator]
	OcaSummingPoint: [obj: OcaSummingPoint]
	OcaSamplingRateConverter: [obj: OcaSamplingRateConverter]
	OcaBasicActuator: [obj: OcaBasicActuator]
	OcaBooleanActuator: [obj: OcaBooleanActuator]
	OcaInt8Actuator: [obj: OcaInt8Actuator]
	OcaInt16Actuator: [obj: OcaInt16Actuator]
	OcaInt32Actuator: [obj: OcaInt32Actuator]
	OcaInt64Actuator: [obj: OcaInt64Actuator]
	OcaUint8Actuator: [obj: OcaUint8Actuator]
	OcaUint16Actuator: [obj: OcaUint16Actuator]
	OcaUint32Actuator: [obj: OcaUint32Actuator]
	OcaUint64Actuator: [obj: OcaUint64Actuator]
	OcaFloat32Actuator: [obj: OcaFloat32Actuator]
	OcaFloat64Actuator: [obj: OcaFloat64Actuator]
	OcaStringActuator: [obj: OcaStringActuator]
	OcaBitstringActuator: [obj: OcaBitstringActuator]
	OcaJsonActuator: [obj: OcaJsonActuator]
	// --- Sensors ---
	OcaSensor: [obj: OcaSensor]
	OcaLevelSensor: [obj: OcaLevelSensor]
	OcaAudioLevelSensor: [obj: OcaAudioLevelSensor]
	OcaTimeIntervalSensor: [obj: OcaTimeIntervalSensor]
	OcaFrequencySensor: [obj: OcaFrequencySensor]
	OcaTemperatureSensor: [obj: OcaTemperatureSensor]
	OcaIdentificationSensor: [obj: OcaIdentificationSensor]
	OcaVoltageSensor: [obj: OcaVoltageSensor]
	OcaCurrentSensor: [obj: OcaCurrentSensor]
	OcaImpedanceSensor: [obj: OcaImpedanceSensor]
	OcaGainSensor: [obj: OcaGainSensor]
	OcaPowerSensor: [obj: OcaPowerSensor]
	OcaStateSensor: [obj: OcaStateSensor]
	OcaBasicSensor: [obj: OcaBasicSensor]
	OcaBooleanSensor: [obj: OcaBooleanSensor]
	OcaInt8Sensor: [obj: OcaInt8Sensor]
	OcaInt16Sensor: [obj: OcaInt16Sensor]
	OcaInt32Sensor: [obj: OcaInt32Sensor]
	OcaInt64Sensor: [obj: OcaInt64Sensor]
	OcaUint8Sensor: [obj: OcaUint8Sensor]
	OcaUint16Sensor: [obj: OcaUint16Sensor]
	OcaUint32Sensor: [obj: OcaUint32Sensor]
	OcaUint64Sensor: [obj: OcaUint64Sensor]
	OcaFloat32Sensor: [obj: OcaFloat32Sensor]
	OcaFloat64Sensor: [obj: OcaFloat64Sensor]
	OcaStringSensor: [obj: OcaStringSensor]
	OcaBitstringSensor: [obj: OcaBitstringSensor]
	OcaJsonSensor: [obj: OcaJsonSensor]
	// --- Workers (structural) ---
	OcaBlock: [obj: OcaBlock]
	OcaBlockFactory: [obj: OcaBlockFactoryAgent]
	OcaMatrix: [obj: OcaMatrix]
	OcaDatasetWorker: [obj: OcaDatasetWorker]
	OcaMediaRecorderPlayer: [obj: OcaMediaRecorderPlayer]
	// --- Agents ---
	OcaAgent: [obj: OcaAgent]
	OcaGrouper: [obj: OcaGrouper]
	OcaRamper: [obj: OcaRamper]
	OcaNumericObserver: [obj: OcaNumericObserver]
	OcaNumericObserverList: [obj: OcaNumericObserverList]
	OcaPowerSupply: [obj: OcaPowerSupply]
	OcaMediaClock3: [obj: OcaMediaClock3]
	OcaTimeSource: [obj: OcaTimeSource]
	OcaPhysicalPosition: [obj: OcaPhysicalPosition]
	OcaTaskAgent: [obj: OcaTaskAgent]
	OcaTaskScheduler: [obj: OcaTaskScheduler]
	OcaCounterNotifier: [obj: OcaCounterNotifier]
	OcaMediaTransportSessionAgent: [obj: OcaMediaTransportSessionAgent]
	OcaGroup: [obj: OcaGroup]
	OcaCommandSetAgent: [obj: OcaCommandSetAgent]
	// --- Networks ---
	OcaApplicationNetwork: [obj: OcaApplicationNetwork]
	OcaControlNetwork: [obj: OcaControlNetwork]
	OcaMediaTransportNetwork: [obj: OcaMediaTransportNetwork]
	// --- Network interfaces and applications ---
	OcaNetworkInterface: [obj: OcaNetworkInterface]
	OcaNetworkApplication: [obj: OcaNetworkApplication]
	OcaMediaTransportApplication: [obj: OcaMediaTransportApplication]
	// --- Datasets ---
	OcaDataset: [obj: OcaDataset]
	OcaLog: [obj: OcaLog]
	OcaProgram: [obj: OcaProgram]
	OcaCommandSet: [obj: OcaCommandSet]
	// --- Managers ---
	OcaManager: [obj: OcaManager]
	OcaDeviceManager: [obj: OcaDeviceManager]
	OcaSecurityManager: [obj: OcaSecurityManager]
	OcaFirmwareManager: [obj: OcaFirmwareManager]
	OcaSubscriptionManager: [obj: OcaSubscriptionManager]
	OcaPowerManager: [obj: OcaPowerManager]
	OcaNetworkManager: [obj: OcaNetworkManager]
	OcaMediaClockManager: [obj: OcaMediaClockManager]
	OcaLibraryManager: [obj: OcaLibraryManager]
	OcaAudioProcessingManager: [obj: OcaAudioProcessingManager]
	OcaDeviceTimeManager: [obj: OcaDeviceTimeManager]
	OcaTaskManager: [obj: OcaTaskManager]
	OcaCodingManager: [obj: OcaCodingManager]
	OcaDiagnosticManager: [obj: OcaDiagnosticManager]
	OcaLockManager: [obj: OcaLockManager]
	// --- Deprecated v1 classes ---
	OcaNetworkSignalChannel: [obj: OcaNetworkSignalChannel]
	OcaNetwork: [obj: OcaNetwork]
	OcaMediaClock: [obj: OcaMediaClock]
	OcaStreamNetwork: [obj: OcaStreamNetwork]
	OcaStreamConnector: [obj: OcaStreamConnector]
}

// ---------------------------------------------------------------------------
// Internal event map (lifecycle / error events on OcaHelper itself)
// ---------------------------------------------------------------------------

interface OcaHelperInternalEvents {
	/** Fired after loadRoleMap() completes successfully. */
	'map:loaded': [roleMap: Map<string, ObjectBase>]
	/**
	 * Fired when loadRoleMap() is called again and some previously-registered
	 * action/feedback IDs belonged to role paths that no longer exist in the
	 * new map.  Those IDs have been dropped.
	 */
	'ids:orphaned': [rolePaths: string[]]
	/**
	 * Fired when properties of an object have changed that some feedbacks are subscribed to and need to be re-checked.  The set contains the IDs of the feedbacks that need to be checked.
	 */
	'property:change': [feedbackIds: Set<string>]
	/**
	 * Fired when an `OcaBlock`'s `ActionObjects` (members) change, indicating the
	 * device's object tree has been restructured (objects added/removed).
	 * Consumers should treat this as a signal to re-fetch the role map and call
	 * `loadRoleMap()` again.
	 */
	'tree:changed': [rolePath: string]
	/**
	 * Fired when a registered object implements properties its class was not yet
	 * known to have, so definitions built from `getClassProperties()` are out of date.
	 */
	'properties:discovered': [className: OcaClassName]
	/**
	 * Fired the first time an object refuses to set a property, so definitions built from
	 * `getObjectProperties()` can be rebuilt without it.
	 */
	'property:refused': [rolePath: string, property: string]
}

// ---------------------------------------------------------------------------
// Registry types
// ---------------------------------------------------------------------------

/**
 * The per-object record stored inside OcaHelper for every role path
 * loaded from the device.
 */
export interface ObjectEntry {
	/** The live OCA control object. */
	readonly obj: OcaRoot
	/** The exact OCA class name resolved for this object (e.g. 'OcaGain'). */
	readonly className: OcaClassName
	/** Action IDs associated with this object. */
	readonly actionIds: Set<string>
	/** Feedback IDs associated with this object. */
	readonly feedbackIds: Set<string>
	/**
	 * Active property sync handle. Present when at least one action or feedback
	 * ID is registered; undefined when the object has no registered IDs and
	 * subscriptions have been disposed.
	 */
	properties?: PropertySync<OcaRootProperties>
	/**
	 * Idempotent cleanup closure returned by `OnPropertyChanged.subscribe()`.
	 * Safe to call even if the underlying connection already cleared this
	 * subscription (e.g. on a connection close) — unlike `.unsubscribe()`,
	 * which throws in that case.
	 */
	unsubscribeProperties?: () => void
}

export type JavaScriptType = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function'

export interface PropertyDescription {
	/** The name of the property. */
	readonly name: string
	/** The type of the property. */
	readonly type: JavaScriptType
	/** Whether the property is readable. */
	readonly read: boolean
	/** Whether the property is setable. */
	readonly write: boolean
	/**
	 * Class hierarchy level the property is declared at: 1 for OcaRoot properties such as
	 * Role, 2 for OcaWorker ones such as Enabled, and so on down to the class's own.
	 */
	readonly level: number
	/**
	 * For an enum property, every member of its enum by name, e.g. `{ Muted: 1, Unmuted: 2 }`.
	 * Read from the sampled value, so it follows whatever enums the installed aes70 defines.
	 */
	readonly enumValues?: EnumValues
}

// ---------------------------------------------------------------------------
// OcaHelper
// ---------------------------------------------------------------------------

/**
 * Central registry and class-dispatch helper for AES70 / OCA devices.
 *
 * ### Loading
 * ```ts
 * const helper = new OcaHelper()
 * const roleMap = await device.get_role_map('/')
 * helper.loadRoleMap(roleMap)
 * ```
 *
 * ### Listening for classes
 * ```ts
 * helper.on(OCA_CLASS_NAMES.OcaGain, (obj) => {
 *   obj.GetGain().then(([gain]) => console.log('Gain:', gain))
 * })
 * ```
 *
 * ### Querying by class
 * ```ts
 * const gainPaths = helper.getByClass(OCA_CLASS_NAMES.OcaGain)  // Set<string>
 * for (const path of gainPaths) {
 *   const entry = helper.getEntry(path)!
 *   const gain = entry.obj as OcaGain
 * }
 * ```
 *
 * ### Action / feedback IDs
 * ```ts
 * helper.addActionId('Faders/Master', 'fader-osc-001')
 * helper.addFeedbackId('Faders/Master', 'sub-abc123')
 *
 * // Reverse lookups (O(1))
 * const path = helper.resolveActionId('fader-osc-001')   // 'Faders/Master'
 * const path2 = helper.resolveFeedbackId('sub-abc123')   // 'Faders/Master'
 * ```
 *
 * ### Reloading
 * Calling `loadRoleMap` again performs a clean swap: the previous roleMap,
 * classIndex, and reverse-lookup indexes are all rebuilt. Any action/feedback
 * IDs that were registered against paths that still exist in the new map are
 * preserved; IDs for paths that no longer exist are removed and the
 * `'ids:orphaned'` event is emitted with the affected paths.
 */
export class OcaHelper extends EventEmitter<DetermineOcaClassEvents & OcaHelperInternalEvents> {
	// -------------------------------------------------------------------------
	// Internal state
	// -------------------------------------------------------------------------

	private readonly logger = createModuleLogger('OCA Helper')

	/**
	 * Source of truth: the role-path → OCA object map exactly as returned by
	 * `RemoteDevice.get_role_map()`.
	 */
	private _roleMap: Map<string, ObjectBase> = new Map()

	/**
	 * Class index: OCA class name → set of role paths that have that exact
	 * class.  Built automatically by `loadRoleMap` / `_registerObject`.
	 *
	 * Keys are the most-derived class name resolved by `_resolveClassName`,
	 * e.g. `'OcaGain'`, `'OcaDelayExtended'`, `'OcaDeviceManager'`.
	 */
	private _classIndex: Map<OcaClassName, Set<string>> = new Map()

	/**
	 * Per-object registry: role path → ObjectEntry.
	 * Holds the resolved class name plus the action/feedback ID sets.
	 */
	private _objectRegistry: Map<string, ObjectEntry> = new Map()

	/**
	 * Reverse lookup: actionId → role path.
	 * Kept in sync with every add/remove action call.
	 */
	private _actionIndex: Map<string, string> = new Map()

	/**
	 * Reverse lookup: feedbackId → role path.
	 * Kept in sync with every add/remove feedback call.
	 */
	private _feedbackIndex: Map<string, string> = new Map()

	/**
	 * Idempotent cleanup closures (returned by `OnMembersChanged.subscribe()`)
	 * for every `OcaBlock` in the current role map, keyed by role path. Torn
	 * down and rebuilt on every `loadRoleMap()` call so subscriptions never
	 * outlive their block. Using the closure rather than `.unsubscribe()`
	 * means teardown is safe even if the connection already cleared the
	 * subscription (e.g. on a connection close) — `.unsubscribe()` throws in
	 * that case.
	 */
	private _blockChangeSubscriptions: Map<string, () => void> = new Map()

	/**
	 * The representative-object probe per class, cached for the lifetime of the
	 * current role map so the device is probed once per class rather than once
	 * per caller. Cleared by `loadRoleMap()`, since a reload can change which
	 * object represents each class.
	 */
	private _classProbes: Map<OcaClassName, Promise<void>> = new Map()
	/** Per-object property reads, so a preset built per object asks the device once. */
	private _objectProbes: Map<string, Promise<PropertyDescription[]>> = new Map()
	/**
	 * Properties each object has refused to set. AES70 has no way to ask whether a property is
	 * settable on a particular object — a device can serve its value and still refuse to change
	 * it — so the refusal itself is the only signal there is.
	 */
	private _refusedWrites: Map<string, Set<string>> = new Map()

	/**
	 * Per class, the properties known to be implemented, by name: the probed
	 * object's, plus any found on objects registered since. Cleared by
	 * `loadRoleMap()`; migrated registrations re-sync during the reload, which
	 * relearns theirs before `'map:loaded'`.
	 */
	private _classProperties: Map<OcaClassName, Map<string, PropertyDescription>> = new Map()

	/**
	 * The object and property each action (`action:<id>`) or feedback (`feedback:<id>`)
	 * was last checked against by `warnIfPropertyMissing`, so each selection is warned
	 * about once rather than on every check.
	 */
	private _propertyChecks: Map<string, string> = new Map()

	// -------------------------------------------------------------------------
	// Constructor
	// -------------------------------------------------------------------------

	constructor() {
		super()
	}

	// -------------------------------------------------------------------------
	// Loading
	// -------------------------------------------------------------------------

	/**
	 * Populate the helper from the map returned by
	 * `RemoteDevice.get_role_map(separator)`.
	 *
	 * Safe to call multiple times — a second call rebuilds all indexes.
	 * Existing action/feedback IDs for paths that survive in the new map are
	 * migrated (and their property sync re-established); IDs for paths that no
	 * longer exist are dropped and the `'ids:orphaned'` event fires. Every
	 * previous entry's property subscription is disposed so reloading never
	 * leaks a live `OnPropertyChanged` subscription against a discarded object.
	 *
	 * @param roleMap - The `Map<string, object>` from `get_role_map()`.
	 */
	public async loadRoleMap(roleMap: Map<string, unknown>): Promise<void> {
		// Snapshot existing ID registrations so we can migrate or orphan them
		const previousEntries = new Map(this._objectRegistry)

		// Tear down block member-change subscriptions before rebuilding — the
		// objects backing them are about to be discarded.
		for (const unsubscribe of this._blockChangeSubscriptions.values()) {
			unsubscribe()
		}
		this._blockChangeSubscriptions = new Map()

		// Dispose every previous entry's property subscription. The entry
		// objects themselves are always replaced below (migrated paths get a
		// fresh ObjectEntry too), so any live PropertySync/OnPropertyChanged
		// subscription left on the old entry would otherwise leak and keep the
		// remote device pushing updates nobody reads.
		for (const previousEntry of previousEntries.values()) {
			this._disposeProperties(previousEntry)
		}

		// Wipe all indexes
		this._roleMap = new Map()
		this._classIndex = new Map()
		this._objectRegistry = new Map()
		this._actionIndex = new Map()
		this._feedbackIndex = new Map()
		this._classProbes = new Map()
		this._objectProbes = new Map()
		this._refusedWrites = new Map()
		this._classProperties = new Map()

		// Populate
		for (const [rolePath, obj] of roleMap) {
			if (!(obj instanceof OcaRoot)) continue
			this._roleMap.set(rolePath, obj)
			this._registerObject(rolePath, obj)
		}

		// Migrate or orphan previous ID registrations
		const orphanedPaths: string[] = []
		const entriesToSync: ObjectEntry[] = []
		for (const [rolePath, previousEntry] of previousEntries) {
			const currentEntry = this._objectRegistry.get(rolePath)
			if (!currentEntry) {
				// Path no longer exists — collect orphaned IDs for the event
				if (previousEntry.actionIds.size > 0 || previousEntry.feedbackIds.size > 0) {
					orphanedPaths.push(rolePath)
				}
				continue
			}
			// Path still exists — restore its IDs
			for (const actionId of previousEntry.actionIds) {
				currentEntry.actionIds.add(actionId)
				this._actionIndex.set(actionId, rolePath)
			}
			for (const feedbackId of previousEntry.feedbackIds) {
				currentEntry.feedbackIds.add(feedbackId)
				this._feedbackIndex.set(feedbackId, rolePath)
			}
			if (this._hasAnyIds(currentEntry)) entriesToSync.push(currentEntry)
		}

		// Re-establish property sync/subscriptions on the new entries for any
		// migrated action/feedback IDs (the old entries' sync was just disposed above).
		await Promise.all(entriesToSync.map(async (entry) => this._syncProperties(entry)))

		if (orphanedPaths.length > 0) {
			this.emit('ids:orphaned', orphanedPaths)
		}

		this.emit('map:loaded', this._roleMap)
	}

	/**
	 * Register a single object into all internal indexes and emit its typed
	 * class event.  Called by `loadRoleMap` for every entry in the role map.
	 */
	private _registerObject(rolePath: string, obj: OcaRoot): void {
		const className = this._resolveClassName(obj)

		// classIndex
		let classSet = this._classIndex.get(className)
		if (!classSet) {
			classSet = new Set()
			this._classIndex.set(className, classSet)
		}
		classSet.add(rolePath)

		// objectRegistry
		this._objectRegistry.set(rolePath, {
			obj,
			className,
			actionIds: new Set(),
			feedbackIds: new Set(),
		})

		// Blocks can gain/lose members at runtime (dynamic trees) — subscribe so
		// callers can react by refreshing the role map.
		if (obj instanceof OcaBlock) {
			const unsubscribe = obj.OnMembersChanged.subscribe(
				() => this.emit('tree:changed', rolePath),
				(err: unknown) => this._logSubscriptionError(`OnMembersChanged subscription for "${rolePath}"`, err),
			)
			this._blockChangeSubscriptions.set(rolePath, unsubscribe)
		}

		// Emit typed event
		this.determineClass(obj)
	}

	// -------------------------------------------------------------------------
	// Class-dispatch (determineClass)
	// -------------------------------------------------------------------------

	/**
	 * Determine the concrete OCA class of `obj` and emit the corresponding
	 * typed event. If `obj` is an array its elements are processed
	 * recursively, making it safe to pass the tree from
	 * `RemoteDevice.get_device_tree()` directly.
	 *
	 * When called internally by `loadRoleMap` this is how typed events reach
	 * consumers.  You can also call it directly if you receive ad-hoc objects
	 * outside of a role map.
	 */
	public determineClass(obj: unknown): void {
		if (Array.isArray(obj)) {
			for (const element of obj) this.determineClass(element)
			return
		}

		if (!(obj instanceof ObjectBase)) return
		if (!(obj instanceof OcaRoot)) {
			this.emit('ObjectBase', obj)
			return
		}

		if (obj instanceof OcaWorker) {
			this.emit('OcaWorker', obj)
			if (obj instanceof OcaActuator) {
				this._emitActuator(obj)
				return
			}
			if (obj instanceof OcaSensor) {
				this._emitSensor(obj)
				return
			}
			if (obj instanceof OcaBlock) {
				this.emit('OcaBlock', obj)
				return
			}
			if (obj instanceof OcaMatrix) {
				this.emit('OcaMatrix', obj)
				return
			}
			if (obj instanceof OcaNetworkSignalChannel) {
				this.emit('OcaNetworkSignalChannel', obj)
				return
			}
			if (obj instanceof OcaMediaRecorderPlayer) {
				this.emit('OcaMediaRecorderPlayer', obj)
				return
			}
			if (obj instanceof OcaDatasetWorker) {
				this.emit('OcaDatasetWorker', obj)
				return
			}
			return
		}

		if (obj instanceof OcaAgent) {
			this._emitAgent(obj)
			return
		}
		if (obj instanceof OcaManager) {
			this._emitManager(obj)
			return
		}

		if (obj instanceof OcaMediaTransportNetwork) {
			this.emit('OcaMediaTransportNetwork', obj)
			return
		}
		if (obj instanceof OcaControlNetwork) {
			this.emit('OcaControlNetwork', obj)
			return
		}
		if (obj instanceof OcaApplicationNetwork) {
			this.emit('OcaApplicationNetwork', obj)
			return
		}
		if (obj instanceof OcaNetworkInterface) {
			this.emit('OcaNetworkInterface', obj)
			return
		}
		if (obj instanceof OcaMediaTransportApplication) {
			this.emit('OcaMediaTransportApplication', obj)
			return
		}
		if (obj instanceof OcaNetworkApplication) {
			this.emit('OcaNetworkApplication', obj)
			return
		}
		if (obj instanceof OcaDataset) {
			this._emitDataset(obj)
			return
		}

		this.emit('OcaRoot', obj)
	}

	// -------------------------------------------------------------------------
	// Class-name resolver (mirrors determineClass without emitting)
	// -------------------------------------------------------------------------

	/**
	 * Resolve the most-derived known class name for `obj` without emitting
	 * any event.  Falls back to `'ObjectBase'` for unrecognised objects.
	 */
	private _resolveClassName(obj: ObjectBase): OcaClassName {
		if (!(obj instanceof OcaRoot)) return OCA_CLASS_NAMES.ObjectBase

		if (obj instanceof OcaWorker) {
			if (obj instanceof OcaActuator) return this._resolveActuatorName(obj)
			if (obj instanceof OcaSensor) return this._resolveSensorName(obj)
			if (obj instanceof OcaBlock) return OCA_CLASS_NAMES.OcaBlock
			if (obj instanceof OcaMatrix) return OCA_CLASS_NAMES.OcaMatrix
			if (obj instanceof OcaNetworkSignalChannel) return OCA_CLASS_NAMES.OcaNetworkSignalChannel
			if (obj instanceof OcaMediaRecorderPlayer) return OCA_CLASS_NAMES.OcaMediaRecorderPlayer
			if (obj instanceof OcaDatasetWorker) return OCA_CLASS_NAMES.OcaDatasetWorker
			return OCA_CLASS_NAMES.OcaWorker
		}
		if (obj instanceof OcaAgent) return this._resolveAgentName(obj)
		if (obj instanceof OcaManager) return this._resolveManagerName(obj)
		if (obj instanceof OcaMediaTransportNetwork) return OCA_CLASS_NAMES.OcaMediaTransportNetwork
		if (obj instanceof OcaControlNetwork) return OCA_CLASS_NAMES.OcaControlNetwork
		if (obj instanceof OcaApplicationNetwork) return OCA_CLASS_NAMES.OcaApplicationNetwork
		if (obj instanceof OcaNetworkInterface) return OCA_CLASS_NAMES.OcaNetworkInterface
		if (obj instanceof OcaMediaTransportApplication) return OCA_CLASS_NAMES.OcaMediaTransportApplication
		if (obj instanceof OcaNetworkApplication) return OCA_CLASS_NAMES.OcaNetworkApplication
		if (obj instanceof OcaDataset) return this._resolveDatasetName(obj)
		return OCA_CLASS_NAMES.OcaRoot
	}

	private _resolveDatasetName(obj: OcaDataset): OcaClassName {
		if (obj instanceof OcaCommandSet) return OCA_CLASS_NAMES.OcaCommandSet
		if (obj instanceof OcaProgram) return OCA_CLASS_NAMES.OcaProgram
		if (obj instanceof OcaLog) return OCA_CLASS_NAMES.OcaLog
		return OCA_CLASS_NAMES.OcaDataset
	}

	private _resolveActuatorName(obj: OcaActuator): OcaClassName {
		if (obj instanceof OcaMute) return OCA_CLASS_NAMES.OcaMute
		if (obj instanceof OcaPolarity) return OCA_CLASS_NAMES.OcaPolarity
		if (obj instanceof OcaSwitch) return OCA_CLASS_NAMES.OcaSwitch
		if (obj instanceof OcaGain) return OCA_CLASS_NAMES.OcaGain
		if (obj instanceof OcaPanBalance) return OCA_CLASS_NAMES.OcaPanBalance
		if (obj instanceof OcaDelayExtended) return OCA_CLASS_NAMES.OcaDelayExtended
		if (obj instanceof OcaDelay) return OCA_CLASS_NAMES.OcaDelay
		if (obj instanceof OcaFrequencyActuator) return OCA_CLASS_NAMES.OcaFrequencyActuator
		if (obj instanceof OcaFilterClassical) return OCA_CLASS_NAMES.OcaFilterClassical
		if (obj instanceof OcaFilterParametric) return OCA_CLASS_NAMES.OcaFilterParametric
		if (obj instanceof OcaFilterPolynomial) return OCA_CLASS_NAMES.OcaFilterPolynomial
		if (obj instanceof OcaFilterFIR) return OCA_CLASS_NAMES.OcaFilterFIR
		if (obj instanceof OcaFilterArbitraryCurve) return OCA_CLASS_NAMES.OcaFilterArbitraryCurve
		if (obj instanceof OcaDynamics) return OCA_CLASS_NAMES.OcaDynamics
		if (obj instanceof OcaDynamicsDetector) return OCA_CLASS_NAMES.OcaDynamicsDetector
		if (obj instanceof OcaDynamicsCurve) return OCA_CLASS_NAMES.OcaDynamicsCurve
		if (obj instanceof OcaSignalGenerator) return OCA_CLASS_NAMES.OcaSignalGenerator
		if (obj instanceof OcaSignalInput) return OCA_CLASS_NAMES.OcaSignalInput
		if (obj instanceof OcaSignalOutput) return OCA_CLASS_NAMES.OcaSignalOutput
		if (obj instanceof OcaTemperatureActuator) return OCA_CLASS_NAMES.OcaTemperatureActuator
		if (obj instanceof OcaIdentificationActuator) return OCA_CLASS_NAMES.OcaIdentificationActuator
		if (obj instanceof OcaSummingPoint) return OCA_CLASS_NAMES.OcaSummingPoint
		if (obj instanceof OcaSamplingRateConverter) return OCA_CLASS_NAMES.OcaSamplingRateConverter
		if (obj instanceof OcaBasicActuator) {
			if (obj instanceof OcaBooleanActuator) return OCA_CLASS_NAMES.OcaBooleanActuator
			if (obj instanceof OcaInt8Actuator) return OCA_CLASS_NAMES.OcaInt8Actuator
			if (obj instanceof OcaInt16Actuator) return OCA_CLASS_NAMES.OcaInt16Actuator
			if (obj instanceof OcaInt32Actuator) return OCA_CLASS_NAMES.OcaInt32Actuator
			if (obj instanceof OcaInt64Actuator) return OCA_CLASS_NAMES.OcaInt64Actuator
			if (obj instanceof OcaUint8Actuator) return OCA_CLASS_NAMES.OcaUint8Actuator
			if (obj instanceof OcaUint16Actuator) return OCA_CLASS_NAMES.OcaUint16Actuator
			if (obj instanceof OcaUint32Actuator) return OCA_CLASS_NAMES.OcaUint32Actuator
			if (obj instanceof OcaUint64Actuator) return OCA_CLASS_NAMES.OcaUint64Actuator
			if (obj instanceof OcaFloat32Actuator) return OCA_CLASS_NAMES.OcaFloat32Actuator
			if (obj instanceof OcaFloat64Actuator) return OCA_CLASS_NAMES.OcaFloat64Actuator
			if (obj instanceof OcaStringActuator) return OCA_CLASS_NAMES.OcaStringActuator
			if (obj instanceof OcaBitstringActuator) return OCA_CLASS_NAMES.OcaBitstringActuator
			if (obj instanceof OcaJsonActuator) return OCA_CLASS_NAMES.OcaJsonActuator
			return OCA_CLASS_NAMES.OcaBasicActuator
		}
		return OCA_CLASS_NAMES.OcaActuator
	}

	private _resolveSensorName(obj: OcaSensor): OcaClassName {
		if (obj instanceof OcaLevelSensor) {
			if (obj instanceof OcaAudioLevelSensor) return OCA_CLASS_NAMES.OcaAudioLevelSensor
			return OCA_CLASS_NAMES.OcaLevelSensor
		}
		if (obj instanceof OcaTimeIntervalSensor) return OCA_CLASS_NAMES.OcaTimeIntervalSensor
		if (obj instanceof OcaFrequencySensor) return OCA_CLASS_NAMES.OcaFrequencySensor
		if (obj instanceof OcaTemperatureSensor) return OCA_CLASS_NAMES.OcaTemperatureSensor
		if (obj instanceof OcaIdentificationSensor) return OCA_CLASS_NAMES.OcaIdentificationSensor
		if (obj instanceof OcaVoltageSensor) return OCA_CLASS_NAMES.OcaVoltageSensor
		if (obj instanceof OcaCurrentSensor) return OCA_CLASS_NAMES.OcaCurrentSensor
		if (obj instanceof OcaImpedanceSensor) return OCA_CLASS_NAMES.OcaImpedanceSensor
		if (obj instanceof OcaGainSensor) return OCA_CLASS_NAMES.OcaGainSensor
		if (obj instanceof OcaPowerSensor) return OCA_CLASS_NAMES.OcaPowerSensor
		if (obj instanceof OcaStateSensor) return OCA_CLASS_NAMES.OcaStateSensor
		if (obj instanceof OcaBasicSensor) {
			if (obj instanceof OcaBooleanSensor) return OCA_CLASS_NAMES.OcaBooleanSensor
			if (obj instanceof OcaInt8Sensor) return OCA_CLASS_NAMES.OcaInt8Sensor
			if (obj instanceof OcaInt16Sensor) return OCA_CLASS_NAMES.OcaInt16Sensor
			if (obj instanceof OcaInt32Sensor) return OCA_CLASS_NAMES.OcaInt32Sensor
			if (obj instanceof OcaInt64Sensor) return OCA_CLASS_NAMES.OcaInt64Sensor
			if (obj instanceof OcaUint8Sensor) return OCA_CLASS_NAMES.OcaUint8Sensor
			if (obj instanceof OcaUint16Sensor) return OCA_CLASS_NAMES.OcaUint16Sensor
			if (obj instanceof OcaUint32Sensor) return OCA_CLASS_NAMES.OcaUint32Sensor
			if (obj instanceof OcaUint64Sensor) return OCA_CLASS_NAMES.OcaUint64Sensor
			if (obj instanceof OcaFloat32Sensor) return OCA_CLASS_NAMES.OcaFloat32Sensor
			if (obj instanceof OcaFloat64Sensor) return OCA_CLASS_NAMES.OcaFloat64Sensor
			if (obj instanceof OcaStringSensor) return OCA_CLASS_NAMES.OcaStringSensor
			if (obj instanceof OcaBitstringSensor) return OCA_CLASS_NAMES.OcaBitstringSensor
			if (obj instanceof OcaJsonSensor) return OCA_CLASS_NAMES.OcaJsonSensor
			return OCA_CLASS_NAMES.OcaBasicSensor
		}
		return OCA_CLASS_NAMES.OcaSensor
	}

	private _resolveAgentName(obj: OcaAgent): OcaClassName {
		if (obj instanceof OcaGrouper) return OCA_CLASS_NAMES.OcaGrouper
		if (obj instanceof OcaNumericObserverList) return OCA_CLASS_NAMES.OcaNumericObserverList
		if (obj instanceof OcaNumericObserver) return OCA_CLASS_NAMES.OcaNumericObserver
		if (obj instanceof OcaRamper) return OCA_CLASS_NAMES.OcaRamper
		if (obj instanceof OcaPowerSupply) return OCA_CLASS_NAMES.OcaPowerSupply
		if (obj instanceof OcaMediaClock3) return OCA_CLASS_NAMES.OcaMediaClock3
		if (obj instanceof OcaTimeSource) return OCA_CLASS_NAMES.OcaTimeSource
		if (obj instanceof OcaPhysicalPosition) return OCA_CLASS_NAMES.OcaPhysicalPosition
		if (obj instanceof OcaTaskAgent) return OCA_CLASS_NAMES.OcaTaskAgent
		if (obj instanceof OcaTaskScheduler) return OCA_CLASS_NAMES.OcaTaskScheduler
		if (obj instanceof OcaCounterNotifier) return OCA_CLASS_NAMES.OcaCounterNotifier
		if (obj instanceof OcaMediaTransportSessionAgent) return OCA_CLASS_NAMES.OcaMediaTransportSessionAgent
		if (obj instanceof OcaGroup) return OCA_CLASS_NAMES.OcaGroup
		if (obj instanceof OcaCommandSetAgent) return OCA_CLASS_NAMES.OcaCommandSetAgent
		// --- Deprecated v1 classes (aes70.js models these as OcaAgent subclasses) ---
		if (obj instanceof OcaBlockFactoryAgent) return OCA_CLASS_NAMES.OcaBlockFactory
		if (obj instanceof OcaStreamConnector) return OCA_CLASS_NAMES.OcaStreamConnector
		if (obj instanceof OcaStreamNetwork) return OCA_CLASS_NAMES.OcaStreamNetwork
		if (obj instanceof OcaNetwork) return OCA_CLASS_NAMES.OcaNetwork
		if (obj instanceof OcaMediaClock) return OCA_CLASS_NAMES.OcaMediaClock
		return OCA_CLASS_NAMES.OcaAgent
	}

	private _resolveManagerName(obj: OcaManager): OcaClassName {
		if (obj instanceof OcaDeviceManager) return OCA_CLASS_NAMES.OcaDeviceManager
		if (obj instanceof OcaSecurityManager) return OCA_CLASS_NAMES.OcaSecurityManager
		if (obj instanceof OcaFirmwareManager) return OCA_CLASS_NAMES.OcaFirmwareManager
		if (obj instanceof OcaSubscriptionManager) return OCA_CLASS_NAMES.OcaSubscriptionManager
		if (obj instanceof OcaPowerManager) return OCA_CLASS_NAMES.OcaPowerManager
		if (obj instanceof OcaNetworkManager) return OCA_CLASS_NAMES.OcaNetworkManager
		if (obj instanceof OcaMediaClockManager) return OCA_CLASS_NAMES.OcaMediaClockManager
		if (obj instanceof OcaLibraryManager) return OCA_CLASS_NAMES.OcaLibraryManager
		if (obj instanceof OcaAudioProcessingManager) return OCA_CLASS_NAMES.OcaAudioProcessingManager
		if (obj instanceof OcaDeviceTimeManager) return OCA_CLASS_NAMES.OcaDeviceTimeManager
		if (obj instanceof OcaTaskManager) return OCA_CLASS_NAMES.OcaTaskManager
		if (obj instanceof OcaCodingManager) return OCA_CLASS_NAMES.OcaCodingManager
		if (obj instanceof OcaDiagnosticManager) return OCA_CLASS_NAMES.OcaDiagnosticManager
		if (obj instanceof OcaLockManager) return OCA_CLASS_NAMES.OcaLockManager
		return OCA_CLASS_NAMES.OcaManager
	}

	// -------------------------------------------------------------------------
	// Private emit helpers (determineClass delegates here)
	// -------------------------------------------------------------------------

	private _emitActuator(obj: OcaActuator): void {
		if (obj instanceof OcaMute) this.emit(OCA_CLASS_NAMES.OcaMute, obj)
		else if (obj instanceof OcaPolarity) this.emit(OCA_CLASS_NAMES.OcaPolarity, obj)
		else if (obj instanceof OcaSwitch) this.emit(OCA_CLASS_NAMES.OcaSwitch, obj)
		else if (obj instanceof OcaGain) this.emit(OCA_CLASS_NAMES.OcaGain, obj)
		else if (obj instanceof OcaPanBalance) this.emit(OCA_CLASS_NAMES.OcaPanBalance, obj)
		else if (obj instanceof OcaDelayExtended) this.emit(OCA_CLASS_NAMES.OcaDelayExtended, obj)
		else if (obj instanceof OcaDelay) this.emit(OCA_CLASS_NAMES.OcaDelay, obj)
		else if (obj instanceof OcaFrequencyActuator) this.emit(OCA_CLASS_NAMES.OcaFrequencyActuator, obj)
		else if (obj instanceof OcaFilterClassical) this.emit(OCA_CLASS_NAMES.OcaFilterClassical, obj)
		else if (obj instanceof OcaFilterParametric) this.emit(OCA_CLASS_NAMES.OcaFilterParametric, obj)
		else if (obj instanceof OcaFilterPolynomial) this.emit(OCA_CLASS_NAMES.OcaFilterPolynomial, obj)
		else if (obj instanceof OcaFilterFIR) this.emit(OCA_CLASS_NAMES.OcaFilterFIR, obj)
		else if (obj instanceof OcaFilterArbitraryCurve) this.emit(OCA_CLASS_NAMES.OcaFilterArbitraryCurve, obj)
		else if (obj instanceof OcaDynamics) this.emit(OCA_CLASS_NAMES.OcaDynamics, obj)
		else if (obj instanceof OcaDynamicsDetector) this.emit(OCA_CLASS_NAMES.OcaDynamicsDetector, obj)
		else if (obj instanceof OcaDynamicsCurve) this.emit(OCA_CLASS_NAMES.OcaDynamicsCurve, obj)
		else if (obj instanceof OcaSignalGenerator) this.emit(OCA_CLASS_NAMES.OcaSignalGenerator, obj)
		else if (obj instanceof OcaSignalInput) this.emit(OCA_CLASS_NAMES.OcaSignalInput, obj)
		else if (obj instanceof OcaSignalOutput) this.emit(OCA_CLASS_NAMES.OcaSignalOutput, obj)
		else if (obj instanceof OcaTemperatureActuator) this.emit(OCA_CLASS_NAMES.OcaTemperatureActuator, obj)
		else if (obj instanceof OcaIdentificationActuator) this.emit(OCA_CLASS_NAMES.OcaIdentificationActuator, obj)
		else if (obj instanceof OcaSummingPoint) this.emit(OCA_CLASS_NAMES.OcaSummingPoint, obj)
		else if (obj instanceof OcaSamplingRateConverter) this.emit(OCA_CLASS_NAMES.OcaSamplingRateConverter, obj)
		else if (obj instanceof OcaBasicActuator) this._emitBasicActuator(obj)
		else this.emit(OCA_CLASS_NAMES.OcaActuator, obj)
	}

	private _emitBasicActuator(obj: OcaBasicActuator): void {
		if (obj instanceof OcaBooleanActuator) this.emit(OCA_CLASS_NAMES.OcaBooleanActuator, obj)
		else if (obj instanceof OcaInt8Actuator) this.emit(OCA_CLASS_NAMES.OcaInt8Actuator, obj)
		else if (obj instanceof OcaInt16Actuator) this.emit(OCA_CLASS_NAMES.OcaInt16Actuator, obj)
		else if (obj instanceof OcaInt32Actuator) this.emit(OCA_CLASS_NAMES.OcaInt32Actuator, obj)
		else if (obj instanceof OcaInt64Actuator) this.emit(OCA_CLASS_NAMES.OcaInt64Actuator, obj)
		else if (obj instanceof OcaUint8Actuator) this.emit(OCA_CLASS_NAMES.OcaUint8Actuator, obj)
		else if (obj instanceof OcaUint16Actuator) this.emit(OCA_CLASS_NAMES.OcaUint16Actuator, obj)
		else if (obj instanceof OcaUint32Actuator) this.emit(OCA_CLASS_NAMES.OcaUint32Actuator, obj)
		else if (obj instanceof OcaUint64Actuator) this.emit(OCA_CLASS_NAMES.OcaUint64Actuator, obj)
		else if (obj instanceof OcaFloat32Actuator) this.emit(OCA_CLASS_NAMES.OcaFloat32Actuator, obj)
		else if (obj instanceof OcaFloat64Actuator) this.emit(OCA_CLASS_NAMES.OcaFloat64Actuator, obj)
		else if (obj instanceof OcaStringActuator) this.emit(OCA_CLASS_NAMES.OcaStringActuator, obj)
		else if (obj instanceof OcaBitstringActuator) this.emit(OCA_CLASS_NAMES.OcaBitstringActuator, obj)
		else if (obj instanceof OcaJsonActuator) this.emit(OCA_CLASS_NAMES.OcaJsonActuator, obj)
		else this.emit(OCA_CLASS_NAMES.OcaBasicActuator, obj)
	}

	private _emitSensor(obj: OcaSensor): void {
		if (obj instanceof OcaLevelSensor) {
			if (obj instanceof OcaAudioLevelSensor) this.emit(OCA_CLASS_NAMES.OcaAudioLevelSensor, obj)
			else this.emit(OCA_CLASS_NAMES.OcaLevelSensor, obj)
		} else if (obj instanceof OcaTimeIntervalSensor) this.emit(OCA_CLASS_NAMES.OcaTimeIntervalSensor, obj)
		else if (obj instanceof OcaFrequencySensor) this.emit(OCA_CLASS_NAMES.OcaFrequencySensor, obj)
		else if (obj instanceof OcaTemperatureSensor) this.emit(OCA_CLASS_NAMES.OcaTemperatureSensor, obj)
		else if (obj instanceof OcaIdentificationSensor) this.emit(OCA_CLASS_NAMES.OcaIdentificationSensor, obj)
		else if (obj instanceof OcaVoltageSensor) this.emit(OCA_CLASS_NAMES.OcaVoltageSensor, obj)
		else if (obj instanceof OcaCurrentSensor) this.emit(OCA_CLASS_NAMES.OcaCurrentSensor, obj)
		else if (obj instanceof OcaImpedanceSensor) this.emit(OCA_CLASS_NAMES.OcaImpedanceSensor, obj)
		else if (obj instanceof OcaGainSensor) this.emit(OCA_CLASS_NAMES.OcaGainSensor, obj)
		else if (obj instanceof OcaPowerSensor) this.emit(OCA_CLASS_NAMES.OcaPowerSensor, obj)
		else if (obj instanceof OcaStateSensor) this.emit(OCA_CLASS_NAMES.OcaStateSensor, obj)
		else if (obj instanceof OcaBasicSensor) this._emitBasicSensor(obj)
		else this.emit(OCA_CLASS_NAMES.OcaSensor, obj)
	}

	private _emitBasicSensor(obj: OcaBasicSensor): void {
		if (obj instanceof OcaBooleanSensor) this.emit(OCA_CLASS_NAMES.OcaBooleanSensor, obj)
		else if (obj instanceof OcaInt8Sensor) this.emit(OCA_CLASS_NAMES.OcaInt8Sensor, obj)
		else if (obj instanceof OcaInt16Sensor) this.emit(OCA_CLASS_NAMES.OcaInt16Sensor, obj)
		else if (obj instanceof OcaInt32Sensor) this.emit(OCA_CLASS_NAMES.OcaInt32Sensor, obj)
		else if (obj instanceof OcaInt64Sensor) this.emit(OCA_CLASS_NAMES.OcaInt64Sensor, obj)
		else if (obj instanceof OcaUint8Sensor) this.emit(OCA_CLASS_NAMES.OcaUint8Sensor, obj)
		else if (obj instanceof OcaUint16Sensor) this.emit(OCA_CLASS_NAMES.OcaUint16Sensor, obj)
		else if (obj instanceof OcaUint32Sensor) this.emit(OCA_CLASS_NAMES.OcaUint32Sensor, obj)
		else if (obj instanceof OcaUint64Sensor) this.emit(OCA_CLASS_NAMES.OcaUint64Sensor, obj)
		else if (obj instanceof OcaFloat32Sensor) this.emit(OCA_CLASS_NAMES.OcaFloat32Sensor, obj)
		else if (obj instanceof OcaFloat64Sensor) this.emit(OCA_CLASS_NAMES.OcaFloat64Sensor, obj)
		else if (obj instanceof OcaStringSensor) this.emit(OCA_CLASS_NAMES.OcaStringSensor, obj)
		else if (obj instanceof OcaBitstringSensor) this.emit(OCA_CLASS_NAMES.OcaBitstringSensor, obj)
		else if (obj instanceof OcaJsonSensor) this.emit(OCA_CLASS_NAMES.OcaJsonSensor, obj)
		else this.emit(OCA_CLASS_NAMES.OcaBasicSensor, obj)
	}

	private _emitAgent(obj: OcaAgent): void {
		if (obj instanceof OcaGrouper) this.emit(OCA_CLASS_NAMES.OcaGrouper, obj)
		else if (obj instanceof OcaNumericObserverList) this.emit(OCA_CLASS_NAMES.OcaNumericObserverList, obj)
		else if (obj instanceof OcaNumericObserver) this.emit(OCA_CLASS_NAMES.OcaNumericObserver, obj)
		else if (obj instanceof OcaRamper) this.emit(OCA_CLASS_NAMES.OcaRamper, obj)
		else if (obj instanceof OcaPowerSupply) this.emit(OCA_CLASS_NAMES.OcaPowerSupply, obj)
		else if (obj instanceof OcaMediaClock3) this.emit(OCA_CLASS_NAMES.OcaMediaClock3, obj)
		else if (obj instanceof OcaTimeSource) this.emit(OCA_CLASS_NAMES.OcaTimeSource, obj)
		else if (obj instanceof OcaPhysicalPosition) this.emit(OCA_CLASS_NAMES.OcaPhysicalPosition, obj)
		else if (obj instanceof OcaTaskAgent) this.emit(OCA_CLASS_NAMES.OcaTaskAgent, obj)
		else if (obj instanceof OcaTaskScheduler) this.emit(OCA_CLASS_NAMES.OcaTaskScheduler, obj)
		else if (obj instanceof OcaCounterNotifier) this.emit(OCA_CLASS_NAMES.OcaCounterNotifier, obj)
		else if (obj instanceof OcaMediaTransportSessionAgent) this.emit(OCA_CLASS_NAMES.OcaMediaTransportSessionAgent, obj)
		else if (obj instanceof OcaGroup) this.emit(OCA_CLASS_NAMES.OcaGroup, obj)
		else if (obj instanceof OcaCommandSetAgent) this.emit(OCA_CLASS_NAMES.OcaCommandSetAgent, obj)
		// --- Deprecated v1 classes (aes70.js models these as OcaAgent subclasses) ---
		else if (obj instanceof OcaBlockFactoryAgent) this.emit('OcaBlockFactory', obj)
		else if (obj instanceof OcaStreamConnector) this.emit('OcaStreamConnector', obj)
		else if (obj instanceof OcaStreamNetwork) this.emit('OcaStreamNetwork', obj)
		else if (obj instanceof OcaNetwork) this.emit('OcaNetwork', obj)
		else if (obj instanceof OcaMediaClock) this.emit('OcaMediaClock', obj)
		else this.emit(OCA_CLASS_NAMES.OcaAgent, obj)
	}

	private _emitManager(obj: OcaManager): void {
		if (obj instanceof OcaDeviceManager) this.emit(OCA_CLASS_NAMES.OcaDeviceManager, obj)
		else if (obj instanceof OcaSecurityManager) this.emit(OCA_CLASS_NAMES.OcaSecurityManager, obj)
		else if (obj instanceof OcaFirmwareManager) this.emit(OCA_CLASS_NAMES.OcaFirmwareManager, obj)
		else if (obj instanceof OcaSubscriptionManager) this.emit(OCA_CLASS_NAMES.OcaSubscriptionManager, obj)
		else if (obj instanceof OcaPowerManager) this.emit(OCA_CLASS_NAMES.OcaPowerManager, obj)
		else if (obj instanceof OcaNetworkManager) this.emit(OCA_CLASS_NAMES.OcaNetworkManager, obj)
		else if (obj instanceof OcaMediaClockManager) this.emit(OCA_CLASS_NAMES.OcaMediaClockManager, obj)
		else if (obj instanceof OcaLibraryManager) this.emit(OCA_CLASS_NAMES.OcaLibraryManager, obj)
		else if (obj instanceof OcaAudioProcessingManager) this.emit(OCA_CLASS_NAMES.OcaAudioProcessingManager, obj)
		else if (obj instanceof OcaDeviceTimeManager) this.emit(OCA_CLASS_NAMES.OcaDeviceTimeManager, obj)
		else if (obj instanceof OcaTaskManager) this.emit(OCA_CLASS_NAMES.OcaTaskManager, obj)
		else if (obj instanceof OcaCodingManager) this.emit(OCA_CLASS_NAMES.OcaCodingManager, obj)
		else if (obj instanceof OcaDiagnosticManager) this.emit(OCA_CLASS_NAMES.OcaDiagnosticManager, obj)
		else if (obj instanceof OcaLockManager) this.emit(OCA_CLASS_NAMES.OcaLockManager, obj)
		else this.emit(OCA_CLASS_NAMES.OcaManager, obj)
	}

	private _emitDataset(obj: OcaDataset): void {
		if (obj instanceof OcaCommandSet) this.emit(OCA_CLASS_NAMES.OcaCommandSet, obj)
		else if (obj instanceof OcaProgram) this.emit(OCA_CLASS_NAMES.OcaProgram, obj)
		else if (obj instanceof OcaLog) this.emit(OCA_CLASS_NAMES.OcaLog, obj)
		else this.emit(OCA_CLASS_NAMES.OcaDataset, obj)
	}

	// -------------------------------------------------------------------------
	// Public query API — class index
	// -------------------------------------------------------------------------

	/**
	 * Return the set of role paths for all objects of a given OCA class name.
	 *
	 * Returns an empty set (not undefined) when the class has no members,
	 * so callers can always safely iterate.
	 *
	 * @example
	 * ```ts
	 * for (const path of helper.getByClass('OcaGain')) {
	 *   const entry = helper.getEntry(path)!
	 * }
	 * ```
	 */
	public getByClass(className: OcaClassName): ReadonlySet<string> {
		return this._classIndex.get(className) ?? new Set()
	}

	/**
	 * Return the set of role paths for all objects of a given OCA class name, formatted as an array of `DropdownChoice` for use in Action and Feedback definitions.
	 *
	 */
	public getChoicesByClass(className: OcaClassName): DropdownChoice[] {
		const paths = this.getByClass(className)
		return Array.from(paths).map((path) => ({ id: path, label: path }))
	}

	/**
	 * True if there is at least one object of the given class name in the current
	 * role map.
	 */

	public hasClass(className: OcaClassName): boolean {
		const size = this._classIndex.get(className)?.size ?? 0
		return size > 0
	}

	/**
	 * Return every class name that has at least one registered object,
	 * in insertion order.
	 */
	public getClassNames(): OcaClassName[] {
		return Array.from(this._classIndex.keys())
	}

	/**
	 * Return a snapshot of the full class index as a plain object — useful
	 * for serialisation or debugging.
	 *
	 * ```ts
	 * { OcaGain: ['Faders/Master', 'Faders/Ch1'], OcaMute: [...] }
	 * ```
	 */
	public getClassIndex(): Partial<Record<OcaClassName, string[]>> {
		const out: Partial<Record<OcaClassName, string[]>> = {}
		for (const [cls, paths] of this._classIndex) {
			out[cls] = Array.from(paths)
		}
		return out
	}

	/**
	 * Return the properties known to be implemented by objects of the given class, in
	 * aes70's declaration order, inherited ones first.
	 *
	 * This starts from one representative object, whose properties are all read once per
	 * class for as long as the current role map is loaded. On devices that don't implement
	 * the optional `OcaRoot` / `OcaWorker` properties that read is a burst of
	 * NotImplemented/BadMethod responses, so action and feedback definition building share
	 * it rather than each probing the device.
	 *
	 * Objects of one class can implement different optional properties, so the
	 * representative alone can miss some. The set therefore also grows as other objects of
	 * the class are registered: their property sync already reads everything they
	 * implement, and anything new is added and reported with `'properties:discovered'`.
	 * Only objects actually in use are ever read beyond the first.
	 */
	public async getClassProperties(className: OcaClassName): Promise<PropertyDescription[]> {
		let probe = this._classProbes.get(className)
		if (!probe) {
			probe = this._probeClass(className)
			this._classProbes.set(className, probe)
		}
		try {
			await probe
		} catch (err) {
			// Don't cache a failure — a later attempt may succeed.
			if (this._classProbes.get(className) === probe) this._classProbes.delete(className)
			throw err
		}
		return this._knownClassProperties(className)
	}

	/**
	 * Every property the object at `rolePath` implements, meaning every one it returned a value for.
	 *
	 * `getClassProperties` answers for a class from one representative object plus whatever other
	 * objects have since been registered, so it is the union across them: objects of a class can
	 * implement different optional properties, and a device may refuse one of them on a particular
	 * object. Anything built per object — a preset group for one filter band, say — needs that
	 * object's own set instead, or it offers buttons the device will refuse.
	 *
	 * This reads the object, so it costs a round trip per object the first time. The result is cached
	 * until the role map reloads, and also folded into the class's set, which only makes that more
	 * complete.
	 */
	public async getObjectProperties(rolePath: string): Promise<PropertyDescription[]> {
		let probe = this._objectProbes.get(rolePath)
		if (!probe) {
			probe = this._probeObject(rolePath)
			this._objectProbes.set(rolePath, probe)
		}
		let props: PropertyDescription[]
		try {
			props = await probe
		} catch (err) {
			// Don't cache a failure — a later attempt may succeed.
			if (this._objectProbes.get(rolePath) === probe) this._objectProbes.delete(rolePath)
			throw err
		}

		// Applied here rather than to the cached read, so a refusal after the probe still counts
		const refused = this._refusedWrites.get(rolePath)
		if (!refused?.size) return props
		return props.map((prop) => (prop.write && refused.has(prop.name) ? { ...prop, write: false } : prop))
	}

	/**
	 * Record that the object at `rolePath` refused to set `property`, so anything built per object
	 * stops offering it. Fires `'property:refused'` the first time, for a definitions rebuild.
	 *
	 * The class's property set is left alone: another object of the same class may well accept it.
	 */
	public markWriteRefused(rolePath: string, property: string): void {
		let refused = this._refusedWrites.get(rolePath)
		if (!refused) {
			refused = new Set()
			this._refusedWrites.set(rolePath, refused)
		}
		if (refused.has(property)) return
		refused.add(property)
		this.logger.info(
			`"${rolePath}" refused to set "${property}", so it won't be offered for that object again. Buttons already using it need removing by hand.`,
		)
		this.emit('property:refused', rolePath, property)
	}

	private async _probeObject(rolePath: string): Promise<PropertyDescription[]> {
		const entry = this._objectRegistry.get(rolePath)
		if (!entry) {
			this.logger.debug(`No object at "${rolePath}" to read properties from`)
			return []
		}

		// A temporary sync, disposed like the class probe's: GetPropertySync() hands out a new
		// instance each call, so disposing this one never unsubscribes the entry's own.
		const propSync = entry.obj.GetPropertySync()
		try {
			await propSync.sync()
			const props = this._describeProperties(entry, propSync)
			this._recordProperties(entry, props)
			return props
		} finally {
			propSync.Dispose()
		}
	}

	private async _probeClass(className: OcaClassName): Promise<void> {
		const rolePath = this._classIndex.get(className)?.values().next().value
		this.logger.debug(`Getting properties for class "${className}" using role path "${rolePath}".`)
		const entry = this._objectRegistry.get(rolePath ?? '')

		if (!entry) return

		// Spin up a temporary sync just to read property structure and types. Always dispose it:
		// GetPropertySync() returns a new instance on every call, separate from the entry's own
		// sync, and aes70 counts subscribers per event, so disposing this one never unsubscribes
		// the entry's. Leaving it open when the entry had IDs leaked one observer per property on
		// every role map reload, and kept the device sending changes after the last ID was removed.
		const propSync = entry.obj.GetPropertySync()
		try {
			await propSync.sync()
			this._recordProperties(entry, this._describeProperties(entry, propSync))
		} finally {
			propSync.Dispose()
		}

		this.logger.debug(`Properties for ${className}:\n${JSON.stringify(this._knownClassProperties(className), null, 2)}`)
	}

	/** Describe every property a synced object implements, meaning every one it returned a value for. */
	private _describeProperties(entry: ObjectEntry, sync: PropertySync<OcaRootProperties>): PropertyDescription[] {
		const objWithMethods = entry.obj as unknown as Record<string, unknown>
		const props: PropertyDescription[] = []

		sync.forEach((value, name) => {
			const valueType = typeof value
			// ClassID is binary, one character per level, so log it dotted rather than as control characters
			const shown = name === 'ClassID' && typeof value === 'string' ? OcaHelper.classIdToDotted(value) : value
			this.logger.debug(
				`Inspecting property "${name}" of class "${entry.className}" with value: ${formatLogValue(shown)} of type: ${valueType}`,
			)

			if (name !== 'ClassID' && valueType !== 'undefined') {
				props.push({
					name,
					type: valueType,
					read: true, //accessorName(objWithMethods, 'Get', name) !== undefined,
					// A handful of properties are set through a pair of methods rather than a setter
					write:
						accessorName(objWithMethods, 'Set', name) !== undefined || methodPairFor(entry.obj, name) !== undefined,
					level: entry.obj.get_properties().find_property(name)?.level ?? 0,
					...(isAes70Enum(value) ? { enumValues: enumValuesOf(value) } : {}),
				})
			}
		})

		return props
	}

	/** Add any of `props` not yet known for the entry's class. Returns true when anything was added. */
	private _recordProperties(entry: ObjectEntry, props: readonly PropertyDescription[]): boolean {
		let known = this._classProperties.get(entry.className)
		if (!known) {
			known = new Map()
			this._classProperties.set(entry.className, known)
		}

		let added = false
		for (const prop of props) {
			if (known.has(prop.name)) continue
			known.set(prop.name, prop)
			added = true
		}
		return added
	}

	/** The class's known properties in aes70's declaration order: by level, then by index within it. */
	private _knownClassProperties(className: OcaClassName): PropertyDescription[] {
		const known = this._classProperties.get(className)
		if (!known) return []

		const samplePath = this._classIndex.get(className)?.values().next().value
		const sample = this._objectRegistry.get(samplePath ?? '')
		const indexOf = (name: string): number => sample?.obj.get_properties().find_property(name)?.index ?? 0

		return Array.from(known.values()).sort((a, b) => a.level - b.level || indexOf(a.name) - indexOf(b.name))
	}

	// -------------------------------------------------------------------------
	// Public query API — object registry
	// -------------------------------------------------------------------------

	/**
	 * Return the ObjectEntry for a role path, or `undefined` if the path is
	 * not in the current role map.
	 */
	public getEntry(rolePath: string): ObjectEntry | undefined {
		return this._objectRegistry.get(rolePath)
	}

	/**
	 * Return the live OCA object for a role path, or `undefined`.
	 */
	public getObject(rolePath: string): ObjectBase | undefined {
		return this._objectRegistry.get(rolePath)?.obj
	}

	/**
	 * Return the resolved class name for a role path, or `undefined`.
	 */
	public getClassName(rolePath: string): OcaClassName | undefined {
		return this._objectRegistry.get(rolePath)?.className
	}

	/**
	 * Whether the object at `rolePath` returned a value for `property` when its properties
	 * were synced, or `undefined` while it isn't synced: nothing is registered to it, or its
	 * sync is still running or failed.
	 */
	public implementsProperty(rolePath: string, property: string): boolean | undefined {
		const properties = this._objectRegistry.get(rolePath)?.properties
		if (!properties) return undefined
		let implemented = false
		properties.forEach((value, name) => {
			if (name === property && value !== undefined) implemented = true
		})
		return implemented
	}

	/**
	 * Warn when an action or feedback uses a property its object didn't return a value for,
	 * which usually means the object doesn't implement it. The Property dropdown offers every
	 * property found on any object of the class, including optional ones only some objects have.
	 *
	 * Warns once per action or feedback until it points at another object or property. Says
	 * nothing while the object isn't synced, since there is nothing to go on yet.
	 */
	public warnIfPropertyMissing(kind: 'action' | 'feedback', id: string, rolePath: string, property: string): void {
		const implemented = this.implementsProperty(rolePath, property)
		if (implemented === undefined) return
		const key = `${kind}:${id}`
		const checked = `${rolePath}\n${property}`
		if (this._propertyChecks.get(key) === checked) return
		this._propertyChecks.set(key, checked)
		if (implemented) return
		this.logger.warn(
			`"${rolePath}" (${this.getClassName(rolePath)}) returned no value for property "${property}", so probably doesn't implement it. The ${kind} ${id} using it will fail.`,
		)
	}

	/**
	 * Retrieve a control object by role path with a specific type, using one of
	 * the static type-guard methods as the guard function.
	 * Returns `undefined` if the path is not registered or the guard does not match.
	 *
	 * @example
	 * ```ts
	 * const gain = helper.getTypedObject('Faders/Master', OcaHelper.isOcaGain)
	 * // gain is OcaGain | undefined
	 * ```
	 */
	public getTypedObject<T extends ObjectBase>(rolePath: string, guard: (obj: unknown) => obj is T): T | undefined {
		const obj = this._objectRegistry.get(rolePath)?.obj
		if (obj === undefined) return undefined
		return guard(obj) ? obj : undefined
	}

	/**
	 * Return all registered role paths in insertion order.
	 */
	public getRolePaths(): string[] {
		return Array.from(this._objectRegistry.keys())
	}

	/**
	 * True if the role path is currently registered.
	 */
	public hasPath(rolePath: string): boolean {
		return this._objectRegistry.has(rolePath)
	}

	// -------------------------------------------------------------------------
	// Public API — action IDs
	// -------------------------------------------------------------------------

	/**
	 * Associate an action ID with a role path.
	 *
	 * An action ID is any opaque string your application uses to route
	 * incoming commands to an OCA object — e.g. an OSC address, a MIDI
	 * binding key, or a custom protocol ID.
	 *
	 * Throws if the role path is not in the current map.
	 * If the action ID is already registered to a different path, a warning is
	 * logged, the previous assignment is cleaned up, and the ID is moved to the
	 * new path. If the previous path loses its last ID as a result, its
	 * property subscriptions are disposed.
	 *
	 * If this is the first ID registered to the target path, `GetPropertySync`
	 * is called and awaited so that property values are fetched and subscribed.
	 *
	 * @param rolePath - Role path as returned by `get_role_map`.
	 * @param actionId - Opaque identifier string.
	 */
	public async addActionId(rolePath: string, actionId: string, signal?: AbortSignal): Promise<void> {
		const entry = this._requireEntry(rolePath)
		const isFirst = !this._hasAnyIds(entry)

		const existing = this._actionIndex.get(actionId)
		if (existing !== undefined && existing !== rolePath) {
			this.logger.warn(`Action ID "${actionId}" was registered to "${existing}" — reassigning to "${rolePath}".`)
			const previousEntry = this._objectRegistry.get(existing)
			if (previousEntry) {
				previousEntry.actionIds.delete(actionId)
				if (!this._hasAnyIds(previousEntry)) this._disposeProperties(previousEntry)
			}
		}

		entry.actionIds.add(actionId)
		this._actionIndex.set(actionId, rolePath)

		// Stops waiting when `signal` aborts, but the sync carries on for other registrations
		if (isFirst) await abortable(this._syncProperties(entry), signal)
	}

	/**
	 * Remove an action ID, looking up its registered path via the reverse index.
	 * Returns `true` if the ID was present and removed, `false` otherwise.
	 * If this was the last ID on the entry, property subscriptions are disposed.
	 */
	public removeActionId(actionId: string): boolean {
		this._propertyChecks.delete(`action:${actionId}`)
		const rolePath = this._actionIndex.get(actionId)
		if (rolePath === undefined) return false
		this._actionIndex.delete(actionId)
		const entry = this._objectRegistry.get(rolePath)
		if (!entry) {
			this.logger.warn(
				`removeActionId: reverse index pointed to "${rolePath}" for action ID "${actionId}" but no registry entry exists. This is an internal inconsistency.`,
			)
			return false
		}
		entry.actionIds.delete(actionId)
		if (!this._hasAnyIds(entry)) this._disposeProperties(entry)
		return true
	}

	/**
	 * Remove all action IDs from a role path, cleaning up the reverse index.
	 * If no feedback IDs remain either, property subscriptions are disposed.
	 */
	public clearActionIds(rolePath: string): void {
		const entry = this._objectRegistry.get(rolePath)
		if (!entry) return
		for (const id of entry.actionIds) this._forgetActionId(id)
		entry.actionIds.clear()
		if (!this._hasAnyIds(entry)) this._disposeProperties(entry)
	}

	/**
	 * Resolve an action ID back to its role path in O(1).
	 * Returns `undefined` if the ID is not registered.
	 */
	public resolveActionId(actionId: string): string | undefined {
		return this._actionIndex.get(actionId)
	}

	/**
	 * Return the OCA object associated with an action ID, or `undefined`.
	 * Convenience shorthand for `getObject(resolveActionId(id)!)`.
	 */
	public getObjectByActionId(actionId: string): ObjectBase | undefined {
		const path = this._actionIndex.get(actionId)
		return path !== undefined ? this.getObject(path) : undefined
	}

	/**
	 * True if an action ID is currently registered (to any path).
	 */
	public hasActionId(actionId: string): boolean {
		return this._actionIndex.has(actionId)
	}

	// -------------------------------------------------------------------------
	// Public API — feedback IDs
	// -------------------------------------------------------------------------

	/**
	 * Associate a feedback ID with a role path.
	 *
	 * A feedback ID is any opaque string your application uses to map
	 * incoming notifications back to an OCA object — e.g. a subscription
	 * handle, a WebSocket correlation ID, or a polling timer key.
	 *
	 * Throws if the role path is not in the current map.
	 * If the feedback ID is already registered to a different path, a warning is
	 * logged, the previous assignment is cleaned up, and the ID is moved to the
	 * new path. If the previous path loses its last ID as a result, its
	 * property subscriptions are disposed.
	 *
	 * If this is the first ID registered to the target path, `GetPropertySync`
	 * is called and awaited so that property values are fetched and subscribed.
	 *
	 * @param rolePath   - Role path as returned by `get_role_map`.
	 * @param feedbackId - Opaque identifier string.
	 */
	public async addFeedbackId(rolePath: string, feedbackId: string, signal?: AbortSignal): Promise<void> {
		const entry = this._requireEntry(rolePath)
		const isFirst = !this._hasAnyIds(entry)

		const existing = this._feedbackIndex.get(feedbackId)
		if (existing !== undefined && existing !== rolePath) {
			this.logger.warn(`Feedback ID "${feedbackId}" was registered to "${existing}" — reassigning to "${rolePath}".`)
			const previousEntry = this._objectRegistry.get(existing)
			if (previousEntry) {
				previousEntry.feedbackIds.delete(feedbackId)
				if (!this._hasAnyIds(previousEntry)) this._disposeProperties(previousEntry)
			}
		}

		entry.feedbackIds.add(feedbackId)
		this._feedbackIndex.set(feedbackId, rolePath)

		// Stops waiting when `signal` aborts, but the sync carries on for other registrations
		if (isFirst) await abortable(this._syncProperties(entry), signal)
	}

	/**
	 * Remove a feedback ID, looking up its registered path via the reverse index.
	 * Returns `true` if the ID was present and removed, `false` otherwise.
	 * If this was the last ID on the entry, property subscriptions are disposed.
	 */
	public removeFeedbackId(feedbackId: string): boolean {
		this._propertyChecks.delete(`feedback:${feedbackId}`)
		const rolePath = this._feedbackIndex.get(feedbackId)
		if (rolePath === undefined) return false
		this._feedbackIndex.delete(feedbackId)
		const entry = this._objectRegistry.get(rolePath)
		if (!entry) {
			this.logger.warn(
				`removeFeedbackId: reverse index pointed to "${rolePath}" for feedback ID "${feedbackId}" but no registry entry exists. This is an internal inconsistency.`,
			)
			return false
		}
		entry.feedbackIds.delete(feedbackId)
		if (!this._hasAnyIds(entry)) this._disposeProperties(entry)
		return true
	}

	/**
	 * Remove all feedback IDs from a role path, cleaning up the reverse index.
	 * If no action IDs remain either, property subscriptions are disposed.
	 */
	public clearFeedbackIds(rolePath: string): void {
		const entry = this._objectRegistry.get(rolePath)
		if (!entry) return
		for (const id of entry.feedbackIds) this._forgetFeedbackId(id)
		entry.feedbackIds.clear()
		if (!this._hasAnyIds(entry)) this._disposeProperties(entry)
	}

	/**
	 * Resolve a feedback ID back to its role path in O(1).
	 * Returns `undefined` if the ID is not registered.
	 */
	public resolveFeedbackId(feedbackId: string): string | undefined {
		return this._feedbackIndex.get(feedbackId)
	}

	/**
	 * Return the OCA object associated with a feedback ID, or `undefined`.
	 */
	public getObjectByFeedbackId(feedbackId: string): ObjectBase | undefined {
		const path = this._feedbackIndex.get(feedbackId)
		return path !== undefined ? this.getObject(path) : undefined
	}

	/**
	 * True if a feedback ID is currently registered (to any path).
	 */
	public hasFeedbackId(feedbackId: string): boolean {
		return this._feedbackIndex.has(feedbackId)
	}

	// -------------------------------------------------------------------------
	// Convenience — clear all IDs for a path
	// -------------------------------------------------------------------------

	/**
	 * Clear both action IDs and feedback IDs for a role path, disposing
	 * property subscriptions if both sets become empty.
	 */
	public clearAllIds(rolePath: string): void {
		const entry = this._objectRegistry.get(rolePath)
		if (!entry) return
		for (const id of entry.actionIds) this._forgetActionId(id)
		entry.actionIds.clear()
		for (const id of entry.feedbackIds) this._forgetFeedbackId(id)
		entry.feedbackIds.clear()
		this._disposeProperties(entry)
	}

	// -------------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------------

	/** Drop an action ID from the reverse index, along with its property check. */
	private _forgetActionId(actionId: string): void {
		this._actionIndex.delete(actionId)
		this._propertyChecks.delete(`action:${actionId}`)
	}

	/** Drop a feedback ID from the reverse index, along with its property check. */
	private _forgetFeedbackId(feedbackId: string): void {
		this._feedbackIndex.delete(feedbackId)
		this._propertyChecks.delete(`feedback:${feedbackId}`)
	}

	/** True when the entry has at least one action ID or feedback ID. */
	private _hasAnyIds(entry: ObjectEntry): boolean {
		return entry.actionIds.size > 0 || entry.feedbackIds.size > 0
	}

	/**
	 * Logs a subscription failure/error-callback invocation. `CloseError` is
	 * expected whenever the connection closes — deliberate shutdown, a
	 * reconnect, or the device dropping the session — and every live
	 * subscription reports one at once, so those are logged at `debug`
	 * (surfacing the underlying cause when there is one) to keep routine
	 * teardown out of the normal log. Anything else is a genuine, unexpected
	 * failure and is logged at `warn`.
	 */
	private _logSubscriptionError(context: string, err: unknown): void {
		if (err instanceof CloseError) {
			this.logger.debug(`${context}: connection closed${err.error ? ` (${err.error})` : ''}`)
			return
		}
		this.logger.warn(`${context}: ${err}`)
	}

	/**
	 * Call GetPropertySync on the entry's object, await sync(), and store the
	 * result so property values are live and subscribed.
	 * Safe to call even if properties are already synced (no-op in that case).
	 */
	private async _syncProperties(entry: ObjectEntry): Promise<void> {
		if (entry.properties !== undefined) return
		const properties = entry.obj.GetPropertySync()
		try {
			// Rejects with a CloseError if the connection closes part way through
			await properties.sync()
		} catch (err) {
			properties.Dispose()
			if (err instanceof CloseError) {
				this.logger.debug(
					`Gave up syncing properties for "${entry.className}" (ONo ${entry.obj.ObjectNumber}): the connection closed`,
				)
			} else {
				this.logger.warn(`Failed to sync properties for "${entry.className}" (ONo ${entry.obj.ObjectNumber}): ${err}`)
			}
			return
		}
		try {
			entry.properties = properties

			// A registered object can implement properties its class's representative doesn't
			if (this._recordProperties(entry, this._describeProperties(entry, properties))) {
				this.emit('properties:discovered', entry.className)
			}

			entry.unsubscribeProperties = entry.obj.OnPropertyChanged.subscribe(
				() => {
					if (entry.feedbackIds.size === 0) return
					this.emit('property:change', new Set(entry.feedbackIds))
				},
				(err: unknown) =>
					this._logSubscriptionError(
						`OnPropertyChanged subscription for "${entry.className}" (ONo ${entry.obj.ObjectNumber})`,
						err,
					),
			)
		} catch (err) {
			this.logger.warn(`Failed to sync properties for "${entry.className}" (ONo ${entry.obj.ObjectNumber}): ${err}`)
		}
	}

	/**
	 * Dispose the entry's property subscriptions and clear the reference.
	 * Safe to call when properties are already undefined (no-op).
	 */
	private _disposeProperties(entry: ObjectEntry): void {
		if (entry.properties === undefined) return
		entry.properties.Dispose()
		entry.properties = undefined
		entry.unsubscribeProperties?.()
		entry.unsubscribeProperties = undefined
	}

	private _requireEntry(rolePath: string): ObjectEntry {
		const entry = this._objectRegistry.get(rolePath)
		if (!entry) {
			throw new Error(`Role path "${rolePath}" is not registered. ` + `Call loadRoleMap() before adding IDs.`)
		}
		return entry
	}

	// -------------------------------------------------------------------------
	// Static type-guard methods
	// -------------------------------------------------------------------------

	static isObjectBase(obj: unknown): obj is ObjectBase {
		return obj instanceof ObjectBase && obj.ClassName === OCA_CLASS_NAMES.ObjectBase
	}
	static isOcaRoot(obj: unknown): obj is OcaRoot {
		return obj instanceof OcaRoot && obj.ClassName === OCA_CLASS_NAMES.OcaRoot
	}
	static isOcaWorker(obj: unknown): obj is OcaWorker {
		return obj instanceof OcaWorker && obj.ClassName === OCA_CLASS_NAMES.OcaWorker
	}
	static isOcaActuator(obj: unknown): obj is OcaActuator {
		return obj instanceof OcaActuator && obj.ClassName === OCA_CLASS_NAMES.OcaActuator
	}
	static isOcaMute(obj: unknown): obj is OcaMute {
		return obj instanceof OcaMute && obj.ClassName === OCA_CLASS_NAMES.OcaMute
	}
	static isOcaPolarity(obj: unknown): obj is OcaPolarity {
		return obj instanceof OcaPolarity && obj.ClassName === OCA_CLASS_NAMES.OcaPolarity
	}
	static isOcaSwitch(obj: unknown): obj is OcaSwitch {
		return obj instanceof OcaSwitch && obj.ClassName === OCA_CLASS_NAMES.OcaSwitch
	}
	static isOcaGain(obj: unknown): obj is OcaGain {
		return obj instanceof OcaGain && obj.ClassName === OCA_CLASS_NAMES.OcaGain
	}
	static isOcaPanBalance(obj: unknown): obj is OcaPanBalance {
		return obj instanceof OcaPanBalance && obj.ClassName === OCA_CLASS_NAMES.OcaPanBalance
	}
	static isOcaDelay(obj: unknown): obj is OcaDelay {
		return obj instanceof OcaDelay && obj.ClassName === OCA_CLASS_NAMES.OcaDelay
	}
	static isOcaDelayExtended(obj: unknown): obj is OcaDelayExtended {
		return obj instanceof OcaDelayExtended && obj.ClassName === OCA_CLASS_NAMES.OcaDelayExtended
	}
	static isOcaFrequencyActuator(obj: unknown): obj is OcaFrequencyActuator {
		return obj instanceof OcaFrequencyActuator && obj.ClassName === OCA_CLASS_NAMES.OcaFrequencyActuator
	}
	static isOcaFilterClassical(obj: unknown): obj is OcaFilterClassical {
		return obj instanceof OcaFilterClassical && obj.ClassName === OCA_CLASS_NAMES.OcaFilterClassical
	}
	static isOcaFilterParametric(obj: unknown): obj is OcaFilterParametric {
		return obj instanceof OcaFilterParametric && obj.ClassName === OCA_CLASS_NAMES.OcaFilterParametric
	}
	static isOcaFilterPolynomial(obj: unknown): obj is OcaFilterPolynomial {
		return obj instanceof OcaFilterPolynomial && obj.ClassName === OCA_CLASS_NAMES.OcaFilterPolynomial
	}
	static isOcaFilterFIR(obj: unknown): obj is OcaFilterFIR {
		return obj instanceof OcaFilterFIR && obj.ClassName === OCA_CLASS_NAMES.OcaFilterFIR
	}
	static isOcaFilterArbitraryCurve(obj: unknown): obj is OcaFilterArbitraryCurve {
		return obj instanceof OcaFilterArbitraryCurve && obj.ClassName === OCA_CLASS_NAMES.OcaFilterArbitraryCurve
	}
	static isOcaDynamics(obj: unknown): obj is OcaDynamics {
		return obj instanceof OcaDynamics && obj.ClassName === OCA_CLASS_NAMES.OcaDynamics
	}
	static isOcaDynamicsDetector(obj: unknown): obj is OcaDynamicsDetector {
		return obj instanceof OcaDynamicsDetector && obj.ClassName === OCA_CLASS_NAMES.OcaDynamicsDetector
	}
	static isOcaDynamicsCurve(obj: unknown): obj is OcaDynamicsCurve {
		return obj instanceof OcaDynamicsCurve && obj.ClassName === OCA_CLASS_NAMES.OcaDynamicsCurve
	}
	static isOcaSignalGenerator(obj: unknown): obj is OcaSignalGenerator {
		return obj instanceof OcaSignalGenerator && obj.ClassName === OCA_CLASS_NAMES.OcaSignalGenerator
	}
	static isOcaSignalInput(obj: unknown): obj is OcaSignalInput {
		return obj instanceof OcaSignalInput && obj.ClassName === OCA_CLASS_NAMES.OcaSignalInput
	}
	static isOcaSignalOutput(obj: unknown): obj is OcaSignalOutput {
		return obj instanceof OcaSignalOutput && obj.ClassName === OCA_CLASS_NAMES.OcaSignalOutput
	}
	static isOcaTemperatureActuator(obj: unknown): obj is OcaTemperatureActuator {
		return obj instanceof OcaTemperatureActuator && obj.ClassName === OCA_CLASS_NAMES.OcaTemperatureActuator
	}
	static isOcaIdentificationActuator(obj: unknown): obj is OcaIdentificationActuator {
		return obj instanceof OcaIdentificationActuator && obj.ClassName === OCA_CLASS_NAMES.OcaIdentificationActuator
	}
	static isOcaSummingPoint(obj: unknown): obj is OcaSummingPoint {
		return obj instanceof OcaSummingPoint && obj.ClassName === OCA_CLASS_NAMES.OcaSummingPoint
	}
	static isOcaSamplingRateConverter(obj: unknown): obj is OcaSamplingRateConverter {
		return obj instanceof OcaSamplingRateConverter && obj.ClassName === OCA_CLASS_NAMES.OcaSamplingRateConverter
	}
	static isOcaBasicActuator(obj: unknown): obj is OcaBasicActuator {
		return obj instanceof OcaBasicActuator && obj.ClassName === OCA_CLASS_NAMES.OcaBasicActuator
	}
	static isOcaBooleanActuator(obj: unknown): obj is OcaBooleanActuator {
		return obj instanceof OcaBooleanActuator && obj.ClassName === OCA_CLASS_NAMES.OcaBooleanActuator
	}
	static isOcaInt8Actuator(obj: unknown): obj is OcaInt8Actuator {
		return obj instanceof OcaInt8Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaInt8Actuator
	}
	static isOcaInt16Actuator(obj: unknown): obj is OcaInt16Actuator {
		return obj instanceof OcaInt16Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaInt16Actuator
	}
	static isOcaInt32Actuator(obj: unknown): obj is OcaInt32Actuator {
		return obj instanceof OcaInt32Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaInt32Actuator
	}
	static isOcaInt64Actuator(obj: unknown): obj is OcaInt64Actuator {
		return obj instanceof OcaInt64Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaInt64Actuator
	}
	static isOcaUint8Actuator(obj: unknown): obj is OcaUint8Actuator {
		return obj instanceof OcaUint8Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaUint8Actuator
	}
	static isOcaUint16Actuator(obj: unknown): obj is OcaUint16Actuator {
		return obj instanceof OcaUint16Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaUint16Actuator
	}
	static isOcaUint32Actuator(obj: unknown): obj is OcaUint32Actuator {
		return obj instanceof OcaUint32Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaUint32Actuator
	}
	static isOcaUint64Actuator(obj: unknown): obj is OcaUint64Actuator {
		return obj instanceof OcaUint64Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaUint64Actuator
	}
	static isOcaFloat32Actuator(obj: unknown): obj is OcaFloat32Actuator {
		return obj instanceof OcaFloat32Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaFloat32Actuator
	}
	static isOcaFloat64Actuator(obj: unknown): obj is OcaFloat64Actuator {
		return obj instanceof OcaFloat64Actuator && obj.ClassName === OCA_CLASS_NAMES.OcaFloat64Actuator
	}
	static isOcaStringActuator(obj: unknown): obj is OcaStringActuator {
		return obj instanceof OcaStringActuator && obj.ClassName === OCA_CLASS_NAMES.OcaStringActuator
	}
	static isOcaBitstringActuator(obj: unknown): obj is OcaBitstringActuator {
		return obj instanceof OcaBitstringActuator && obj.ClassName === OCA_CLASS_NAMES.OcaBitstringActuator
	}
	static isOcaJsonActuator(obj: unknown): obj is OcaJsonActuator {
		return obj instanceof OcaJsonActuator && obj.ClassName === OCA_CLASS_NAMES.OcaJsonActuator
	}
	static isOcaSensor(obj: unknown): obj is OcaSensor {
		return obj instanceof OcaSensor && obj.ClassName === OCA_CLASS_NAMES.OcaSensor
	}
	static isOcaLevelSensor(obj: unknown): obj is OcaLevelSensor {
		return obj instanceof OcaLevelSensor && obj.ClassName === OCA_CLASS_NAMES.OcaLevelSensor
	}
	static isOcaAudioLevelSensor(obj: unknown): obj is OcaAudioLevelSensor {
		return obj instanceof OcaAudioLevelSensor && obj.ClassName === OCA_CLASS_NAMES.OcaAudioLevelSensor
	}
	static isOcaTimeIntervalSensor(obj: unknown): obj is OcaTimeIntervalSensor {
		return obj instanceof OcaTimeIntervalSensor && obj.ClassName === OCA_CLASS_NAMES.OcaTimeIntervalSensor
	}
	static isOcaFrequencySensor(obj: unknown): obj is OcaFrequencySensor {
		return obj instanceof OcaFrequencySensor && obj.ClassName === OCA_CLASS_NAMES.OcaFrequencySensor
	}
	static isOcaTemperatureSensor(obj: unknown): obj is OcaTemperatureSensor {
		return obj instanceof OcaTemperatureSensor && obj.ClassName === OCA_CLASS_NAMES.OcaTemperatureSensor
	}
	static isOcaIdentificationSensor(obj: unknown): obj is OcaIdentificationSensor {
		return obj instanceof OcaIdentificationSensor && obj.ClassName === OCA_CLASS_NAMES.OcaIdentificationSensor
	}
	static isOcaVoltageSensor(obj: unknown): obj is OcaVoltageSensor {
		return obj instanceof OcaVoltageSensor && obj.ClassName === OCA_CLASS_NAMES.OcaVoltageSensor
	}
	static isOcaCurrentSensor(obj: unknown): obj is OcaCurrentSensor {
		return obj instanceof OcaCurrentSensor && obj.ClassName === OCA_CLASS_NAMES.OcaCurrentSensor
	}
	static isOcaImpedanceSensor(obj: unknown): obj is OcaImpedanceSensor {
		return obj instanceof OcaImpedanceSensor && obj.ClassName === OCA_CLASS_NAMES.OcaImpedanceSensor
	}
	static isOcaGainSensor(obj: unknown): obj is OcaGainSensor {
		return obj instanceof OcaGainSensor && obj.ClassName === OCA_CLASS_NAMES.OcaGainSensor
	}
	static isOcaPowerSensor(obj: unknown): obj is OcaPowerSensor {
		return obj instanceof OcaPowerSensor && obj.ClassName === OCA_CLASS_NAMES.OcaPowerSensor
	}
	static isOcaStateSensor(obj: unknown): obj is OcaStateSensor {
		return obj instanceof OcaStateSensor && obj.ClassName === OCA_CLASS_NAMES.OcaStateSensor
	}
	static isOcaBasicSensor(obj: unknown): obj is OcaBasicSensor {
		return obj instanceof OcaBasicSensor && obj.ClassName === OCA_CLASS_NAMES.OcaBasicSensor
	}
	static isOcaBooleanSensor(obj: unknown): obj is OcaBooleanSensor {
		return obj instanceof OcaBooleanSensor && obj.ClassName === OCA_CLASS_NAMES.OcaBooleanSensor
	}
	static isOcaInt8Sensor(obj: unknown): obj is OcaInt8Sensor {
		return obj instanceof OcaInt8Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaInt8Sensor
	}
	static isOcaInt16Sensor(obj: unknown): obj is OcaInt16Sensor {
		return obj instanceof OcaInt16Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaInt16Sensor
	}
	static isOcaInt32Sensor(obj: unknown): obj is OcaInt32Sensor {
		return obj instanceof OcaInt32Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaInt32Sensor
	}
	static isOcaInt64Sensor(obj: unknown): obj is OcaInt64Sensor {
		return obj instanceof OcaInt64Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaInt64Sensor
	}
	static isOcaUint8Sensor(obj: unknown): obj is OcaUint8Sensor {
		return obj instanceof OcaUint8Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaUint8Sensor
	}
	static isOcaUint16Sensor(obj: unknown): obj is OcaUint16Sensor {
		return obj instanceof OcaUint16Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaUint16Sensor
	}
	static isOcaUint32Sensor(obj: unknown): obj is OcaUint32Sensor {
		return obj instanceof OcaUint32Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaUint32Sensor
	}
	static isOcaUint64Sensor(obj: unknown): obj is OcaUint64Sensor {
		return obj instanceof OcaUint64Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaUint64Sensor
	}
	static isOcaFloat32Sensor(obj: unknown): obj is OcaFloat32Sensor {
		return obj instanceof OcaFloat32Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaFloat32Sensor
	}
	static isOcaFloat64Sensor(obj: unknown): obj is OcaFloat64Sensor {
		return obj instanceof OcaFloat64Sensor && obj.ClassName === OCA_CLASS_NAMES.OcaFloat64Sensor
	}
	static isOcaStringSensor(obj: unknown): obj is OcaStringSensor {
		return obj instanceof OcaStringSensor && obj.ClassName === OCA_CLASS_NAMES.OcaStringSensor
	}
	static isOcaBitstringSensor(obj: unknown): obj is OcaBitstringSensor {
		return obj instanceof OcaBitstringSensor && obj.ClassName === OCA_CLASS_NAMES.OcaBitstringSensor
	}
	static isOcaJsonSensor(obj: unknown): obj is OcaJsonSensor {
		return obj instanceof OcaJsonSensor && obj.ClassName === OCA_CLASS_NAMES.OcaJsonSensor
	}
	static isOcaBlock(obj: unknown): obj is OcaBlock {
		return obj instanceof OcaBlock && obj.ClassName === OCA_CLASS_NAMES.OcaBlock
	}
	static isOcaBlockFactory(obj: unknown): obj is OcaBlockFactoryAgent {
		return obj instanceof OcaBlockFactoryAgent && obj.ClassName === OCA_CLASS_NAMES.OcaBlockFactory
	}
	static isOcaMatrix(obj: unknown): obj is OcaMatrix {
		return obj instanceof OcaMatrix && obj.ClassName === OCA_CLASS_NAMES.OcaMatrix
	}
	static isOcaDatasetWorker(obj: unknown): obj is OcaDatasetWorker {
		return obj instanceof OcaDatasetWorker && obj.ClassName === OCA_CLASS_NAMES.OcaDatasetWorker
	}
	static isOcaMediaRecorderPlayer(obj: unknown): obj is OcaMediaRecorderPlayer {
		return obj instanceof OcaMediaRecorderPlayer && obj.ClassName === OCA_CLASS_NAMES.OcaMediaRecorderPlayer
	}
	static isOcaAgent(obj: unknown): obj is OcaAgent {
		return obj instanceof OcaAgent && obj.ClassName === OCA_CLASS_NAMES.OcaAgent
	}
	static isOcaGrouper(obj: unknown): obj is OcaGrouper {
		return obj instanceof OcaGrouper && obj.ClassName === OCA_CLASS_NAMES.OcaGrouper
	}
	static isOcaRamper(obj: unknown): obj is OcaRamper {
		return obj instanceof OcaRamper && obj.ClassName === OCA_CLASS_NAMES.OcaRamper
	}
	static isOcaNumericObserver(obj: unknown): obj is OcaNumericObserver {
		return obj instanceof OcaNumericObserver && obj.ClassName === OCA_CLASS_NAMES.OcaNumericObserver
	}
	static isOcaNumericObserverList(obj: unknown): obj is OcaNumericObserverList {
		return obj instanceof OcaNumericObserverList && obj.ClassName === OCA_CLASS_NAMES.OcaNumericObserverList
	}
	static isOcaPowerSupply(obj: unknown): obj is OcaPowerSupply {
		return obj instanceof OcaPowerSupply && obj.ClassName === OCA_CLASS_NAMES.OcaPowerSupply
	}
	static isOcaMediaClock3(obj: unknown): obj is OcaMediaClock3 {
		return obj instanceof OcaMediaClock3 && obj.ClassName === OCA_CLASS_NAMES.OcaMediaClock3
	}
	static isOcaTimeSource(obj: unknown): obj is OcaTimeSource {
		return obj instanceof OcaTimeSource && obj.ClassName === OCA_CLASS_NAMES.OcaTimeSource
	}
	static isOcaPhysicalPosition(obj: unknown): obj is OcaPhysicalPosition {
		return obj instanceof OcaPhysicalPosition && obj.ClassName === OCA_CLASS_NAMES.OcaPhysicalPosition
	}
	static isOcaTaskAgent(obj: unknown): obj is OcaTaskAgent {
		return obj instanceof OcaTaskAgent && obj.ClassName === OCA_CLASS_NAMES.OcaTaskAgent
	}
	static isOcaTaskScheduler(obj: unknown): obj is OcaTaskScheduler {
		return obj instanceof OcaTaskScheduler && obj.ClassName === OCA_CLASS_NAMES.OcaTaskScheduler
	}
	static isOcaCounterNotifier(obj: unknown): obj is OcaCounterNotifier {
		return obj instanceof OcaCounterNotifier && obj.ClassName === OCA_CLASS_NAMES.OcaCounterNotifier
	}
	static isOcaMediaTransportSessionAgent(obj: unknown): obj is OcaMediaTransportSessionAgent {
		return (
			obj instanceof OcaMediaTransportSessionAgent && obj.ClassName === OCA_CLASS_NAMES.OcaMediaTransportSessionAgent
		)
	}
	static isOcaGroup(obj: unknown): obj is OcaGroup {
		return obj instanceof OcaGroup && obj.ClassName === OCA_CLASS_NAMES.OcaGroup
	}
	static isOcaCommandSetAgent(obj: unknown): obj is OcaCommandSetAgent {
		return obj instanceof OcaCommandSetAgent && obj.ClassName === OCA_CLASS_NAMES.OcaCommandSetAgent
	}
	static isOcaApplicationNetwork(obj: unknown): obj is OcaApplicationNetwork {
		return obj instanceof OcaApplicationNetwork && obj.ClassName === OCA_CLASS_NAMES.OcaApplicationNetwork
	}
	static isOcaControlNetwork(obj: unknown): obj is OcaControlNetwork {
		return obj instanceof OcaControlNetwork && obj.ClassName === OCA_CLASS_NAMES.OcaControlNetwork
	}
	static isOcaMediaTransportNetwork(obj: unknown): obj is OcaMediaTransportNetwork {
		return obj instanceof OcaMediaTransportNetwork && obj.ClassName === OCA_CLASS_NAMES.OcaMediaTransportNetwork
	}
	static isOcaNetworkInterface(obj: unknown): obj is OcaNetworkInterface {
		return obj instanceof OcaNetworkInterface && obj.ClassName === OCA_CLASS_NAMES.OcaNetworkInterface
	}
	static isOcaNetworkApplication(obj: unknown): obj is OcaNetworkApplication {
		return obj instanceof OcaNetworkApplication && obj.ClassName === OCA_CLASS_NAMES.OcaNetworkApplication
	}
	static isOcaMediaTransportApplication(obj: unknown): obj is OcaMediaTransportApplication {
		return obj instanceof OcaMediaTransportApplication && obj.ClassName === OCA_CLASS_NAMES.OcaMediaTransportApplication
	}
	static isOcaDataset(obj: unknown): obj is OcaDataset {
		return obj instanceof OcaDataset && obj.ClassName === OCA_CLASS_NAMES.OcaDataset
	}
	static isOcaLog(obj: unknown): obj is OcaLog {
		return obj instanceof OcaLog && obj.ClassName === OCA_CLASS_NAMES.OcaLog
	}
	static isOcaProgram(obj: unknown): obj is OcaProgram {
		return obj instanceof OcaProgram && obj.ClassName === OCA_CLASS_NAMES.OcaProgram
	}
	static isOcaCommandSet(obj: unknown): obj is OcaCommandSet {
		return obj instanceof OcaCommandSet && obj.ClassName === OCA_CLASS_NAMES.OcaCommandSet
	}
	static isOcaManager(obj: unknown): obj is OcaManager {
		return obj instanceof OcaManager && obj.ClassName === OCA_CLASS_NAMES.OcaManager
	}
	static isOcaDeviceManager(obj: unknown): obj is OcaDeviceManager {
		return obj instanceof OcaDeviceManager && obj.ClassName === OCA_CLASS_NAMES.OcaDeviceManager
	}
	static isOcaSecurityManager(obj: unknown): obj is OcaSecurityManager {
		return obj instanceof OcaSecurityManager && obj.ClassName === OCA_CLASS_NAMES.OcaSecurityManager
	}
	static isOcaFirmwareManager(obj: unknown): obj is OcaFirmwareManager {
		return obj instanceof OcaFirmwareManager && obj.ClassName === OCA_CLASS_NAMES.OcaFirmwareManager
	}
	static isOcaSubscriptionManager(obj: unknown): obj is OcaSubscriptionManager {
		return obj instanceof OcaSubscriptionManager && obj.ClassName === OCA_CLASS_NAMES.OcaSubscriptionManager
	}
	static isOcaPowerManager(obj: unknown): obj is OcaPowerManager {
		return obj instanceof OcaPowerManager && obj.ClassName === OCA_CLASS_NAMES.OcaPowerManager
	}
	static isOcaNetworkManager(obj: unknown): obj is OcaNetworkManager {
		return obj instanceof OcaNetworkManager && obj.ClassName === OCA_CLASS_NAMES.OcaNetworkManager
	}
	static isOcaMediaClockManager(obj: unknown): obj is OcaMediaClockManager {
		return obj instanceof OcaMediaClockManager && obj.ClassName === OCA_CLASS_NAMES.OcaMediaClockManager
	}
	static isOcaLibraryManager(obj: unknown): obj is OcaLibraryManager {
		return obj instanceof OcaLibraryManager && obj.ClassName === OCA_CLASS_NAMES.OcaLibraryManager
	}
	static isOcaAudioProcessingManager(obj: unknown): obj is OcaAudioProcessingManager {
		return obj instanceof OcaAudioProcessingManager && obj.ClassName === OCA_CLASS_NAMES.OcaAudioProcessingManager
	}
	static isOcaDeviceTimeManager(obj: unknown): obj is OcaDeviceTimeManager {
		return obj instanceof OcaDeviceTimeManager && obj.ClassName === OCA_CLASS_NAMES.OcaDeviceTimeManager
	}
	static isOcaTaskManager(obj: unknown): obj is OcaTaskManager {
		return obj instanceof OcaTaskManager && obj.ClassName === OCA_CLASS_NAMES.OcaTaskManager
	}
	static isOcaCodingManager(obj: unknown): obj is OcaCodingManager {
		return obj instanceof OcaCodingManager && obj.ClassName === OCA_CLASS_NAMES.OcaCodingManager
	}
	static isOcaDiagnosticManager(obj: unknown): obj is OcaDiagnosticManager {
		return obj instanceof OcaDiagnosticManager && obj.ClassName === OCA_CLASS_NAMES.OcaDiagnosticManager
	}
	static isOcaLockManager(obj: unknown): obj is OcaLockManager {
		return obj instanceof OcaLockManager && obj.ClassName === OCA_CLASS_NAMES.OcaLockManager
	}
	static isOcaNetworkSignalChannel(obj: unknown): obj is OcaNetworkSignalChannel {
		return obj instanceof OcaNetworkSignalChannel && obj.ClassName === OCA_CLASS_NAMES.OcaNetworkSignalChannel
	}
	static isOcaNetwork(obj: unknown): obj is OcaNetwork {
		return obj instanceof OcaNetwork && obj.ClassName === OCA_CLASS_NAMES.OcaNetwork
	}
	static isOcaMediaClock(obj: unknown): obj is OcaMediaClock {
		return obj instanceof OcaMediaClock && obj.ClassName === OCA_CLASS_NAMES.OcaMediaClock
	}
	static isOcaStreamNetwork(obj: unknown): obj is OcaStreamNetwork {
		return obj instanceof OcaStreamNetwork && obj.ClassName === OCA_CLASS_NAMES.OcaStreamNetwork
	}
	static isOcaStreamConnector(obj: unknown): obj is OcaStreamConnector {
		return obj instanceof OcaStreamConnector && obj.ClassName === OCA_CLASS_NAMES.OcaStreamConnector
	}

	// -------------------------------------------------------------------------
	// Static type-guard method — class name validation
	// -------------------------------------------------------------------------
	static isValidClassName(name: string): name is OcaClassName {
		const names = Object.values(OCA_CLASS_NAMES) as string[]
		return names.includes(name)
	}

	// -------------------------------------------------------------------------
	// Static Class ID conversion methods
	// -------------------------------------------------------------------------

	static classIdToBinary(id: string): string {
		if (id === '') return ''
		return id
			.split('.')
			.map((n) => String.fromCharCode(parseInt(n)))
			.join('')
	}

	static classIdToDotted(binary: string): string {
		if (binary === '') return ''
		return Array.from(binary)
			.map((c) => c.charCodeAt(0))
			.join('.')
	}
}
