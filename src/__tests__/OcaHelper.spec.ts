import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OcaHelper } from '../OcaHelper.js'
import { OCA_CLASS_IDS, OCA_CLASS_NAMES } from '../consts/aes70-constants.js'
import {
	OcaFilterParametric,
	OcaGain,
	OcaMute,
	OcaBooleanActuator,
	OcaAudioLevelSensor,
	OcaLevelSensor,
	OcaBlock,
	OcaBlockFactoryAgent,
	OcaMatrix,
	OcaGrouper,
	OcaDeviceManager,
	OcaControlNetwork,
	OcaApplicationNetwork,
	OcaMediaTransportNetwork,
	OcaNetwork,
	OcaMediaClock,
	OcaStreamNetwork,
	OcaStreamConnector,
	OcaNetworkSignalChannel,
	OcaRoot,
} from 'aes70/src/controller/ControlClasses.js'
import * as ControlClasses from 'aes70/src/controller/ControlClasses.js'
import { ObjectBase } from 'aes70/src/controller/object_base.js'
import { CloseError } from 'aes70'
import { OcaSensorReadingState } from 'aes70/src/types/OcaSensorReadingState.js'
import { OcaLevelMeterLaw } from 'aes70/src/types/OcaLevelMeterLaw.js'
import { captureLogs, type CapturedLogs } from './captureLogs.js'

// ---------------------------------------------------------------------------
// Test helpers — build real aes70 control-class instances backed by a fake
// device, so `instanceof` chains and ClassName resolution behave exactly as
// they would against a live device, without any network I/O.
// ---------------------------------------------------------------------------

interface FakeDevice {
	send_command: ReturnType<typeof vi.fn>
	add_subscription: ReturnType<typeof vi.fn>
	remove_subscription: ReturnType<typeof vi.fn>
}

function fakeDevice(): FakeDevice {
	return {
		send_command: vi.fn(),
		add_subscription: vi.fn(),
		remove_subscription: vi.fn(),
	}
}

interface FakePropertySync {
	sync: ReturnType<typeof vi.fn>
	forEach: ReturnType<typeof vi.fn>
	Dispose: ReturnType<typeof vi.fn>
}

function makeFakePropertySync(): FakePropertySync {
	return {
		sync: vi.fn().mockResolvedValue(undefined),
		forEach: vi.fn(),
		Dispose: vi.fn(),
	}
}

interface Rig {
	getPropertySync: ReturnType<typeof vi.fn>
	propertySync: FakePropertySync
}

const rigByObject = new WeakMap<ObjectBase, Rig>()

/**
 * Instantiate a real aes70 control class against a fake device, and stub
 * GetPropertySync() so property-sync calls resolve instantly without
 * hitting the (nonexistent) network device. Use `rigOf()` to get at the
 * mocked GetPropertySync()/PropertySync for a given object.
 */
function makeObj<T extends ObjectBase>(
	Cls: new (ono: number, device: any) => T,
	ono: number,
	device: FakeDevice = fakeDevice(),
): T {
	const obj = new Cls(ono, device)
	const propertySync = makeFakePropertySync()
	const getPropertySync = vi.fn(() => propertySync)
	;(obj as unknown as { GetPropertySync: unknown }).GetPropertySync = getPropertySync
	rigByObject.set(obj, { getPropertySync, propertySync })
	return obj
}

function rigOf(obj: ObjectBase): Rig {
	const rig = rigByObject.get(obj)
	if (!rig) throw new Error('Object was not created via makeObj()')
	return rig
}

/** A non-OcaRoot ObjectBase, for testing the "not an OCA control object" paths. */
function makePlainObjectBase(ono: number): ObjectBase {
	return new ObjectBase(ono, fakeDevice() as any)
}

// ---------------------------------------------------------------------------
// determineClass / class-dispatch
// ---------------------------------------------------------------------------

describe('determineClass', () => {
	let helper: OcaHelper
	let events: string[]

	beforeEach(() => {
		helper = new OcaHelper()
		events = []
		// Record every event name this helper ever emits, across the whole
		// DetermineOcaClassEvents map, without needing per-test listeners.
		const originalEmit = helper.emit.bind(helper) as (...args: unknown[]) => boolean
		vi.spyOn(helper, 'emit').mockImplementation((eventName: string | symbol, ...args: unknown[]) => {
			events.push(String(eventName))
			return originalEmit(eventName, ...args)
		})
	})

	it('emits OcaWorker plus the exact class for a direct actuator subclass', () => {
		helper.determineClass(makeObj(OcaGain, 1))
		expect(events).toEqual(['OcaWorker', 'OcaGain'])
	})

	it('emits the exact class for a different direct actuator subclass', () => {
		helper.determineClass(makeObj(OcaMute, 1))
		expect(events).toEqual(['OcaWorker', 'OcaMute'])
	})

	it('emits only the most-derived event for a basic-actuator subtype, not OcaBasicActuator/OcaActuator', () => {
		helper.determineClass(makeObj(OcaBooleanActuator, 1))
		expect(events).toEqual(['OcaWorker', 'OcaBooleanActuator'])
	})

	it('emits only the most-derived event for a nested sensor subtype, not OcaLevelSensor/OcaSensor', () => {
		helper.determineClass(makeObj(OcaAudioLevelSensor, 1))
		expect(events).toEqual(['OcaWorker', 'OcaAudioLevelSensor'])
	})

	it('emits OcaLevelSensor (not OcaAudioLevelSensor) for the non-audio level sensor', () => {
		helper.determineClass(makeObj(OcaLevelSensor, 1))
		expect(events).toEqual(['OcaWorker', 'OcaLevelSensor'])
	})

	it.each([
		['OcaBlock', OcaBlock],
		['OcaMatrix', OcaMatrix],
	] as const)('emits OcaWorker plus %s for structural worker classes', (eventName, Cls) => {
		helper.determineClass(makeObj<ObjectBase>(Cls, 1))
		expect(events).toEqual(['OcaWorker', eventName])
	})

	// OcaNetworkSignalChannel extends OcaWorker in aes70.js, so it goes
	// through the OcaWorker branch (which always emits 'OcaWorker' first)
	// before its own dedicated event.
	it('emits OcaWorker plus OcaNetworkSignalChannel for the deprecated v1 network signal channel class', () => {
		helper.determineClass(makeObj(OcaNetworkSignalChannel, 1))
		expect(events).toEqual(['OcaWorker', 'OcaNetworkSignalChannel'])
	})

	it('emits only the exact class for an agent, with no generic OcaAgent/OcaWorker event', () => {
		helper.determineClass(makeObj(OcaGrouper, 1))
		expect(events).toEqual(['OcaGrouper'])
	})

	// OcaBlockFactoryAgent, OcaStreamConnector, OcaStreamNetwork, OcaNetwork
	// and OcaMediaClock all extend OcaAgent (not OcaWorker/OcaRoot directly)
	// in aes70.js, so — like OcaGrouper above — they get only their own
	// dedicated event, with no generic 'OcaAgent' alongside it.
	it.each([
		['OcaBlockFactory', OcaBlockFactoryAgent],
		['OcaStreamConnector', OcaStreamConnector],
		['OcaStreamNetwork', OcaStreamNetwork],
		['OcaNetwork', OcaNetwork],
		['OcaMediaClock', OcaMediaClock],
	] as const)('emits only %s for deprecated v1 classes that are actually OcaAgent subclasses', (eventName, Cls) => {
		helper.determineClass(makeObj<ObjectBase>(Cls, 1))
		expect(events).toEqual([eventName])
	})

	it('emits only the exact class for a manager, with no generic OcaManager event', () => {
		helper.determineClass(makeObj(OcaDeviceManager, 1))
		expect(events).toEqual(['OcaDeviceManager'])
	})

	it.each([
		['OcaControlNetwork', OcaControlNetwork],
		['OcaApplicationNetwork', OcaApplicationNetwork],
		['OcaMediaTransportNetwork', OcaMediaTransportNetwork],
	] as const)('emits %s for network classes', (eventName, Cls) => {
		helper.determineClass(makeObj<ObjectBase>(Cls, 1))
		expect(events).toEqual([eventName])
	})

	it('falls back to OcaRoot for an unrecognised OcaRoot subclass', () => {
		helper.determineClass(makeObj(OcaRoot, 1))
		expect(events).toEqual(['OcaRoot'])
	})

	it('emits ObjectBase for a non-OcaRoot ObjectBase', () => {
		helper.determineClass(makePlainObjectBase(1))
		expect(events).toEqual(['ObjectBase'])
	})

	it('emits nothing for values that are not an ObjectBase', () => {
		helper.determineClass({ not: 'an object base' })
		helper.determineClass(null)
		helper.determineClass(42)
		expect(events).toEqual([])
	})

	it('recurses into arrays, processing every element', () => {
		helper.determineClass([makeObj(OcaGain, 1), makeObj(OcaMute, 2)])
		expect(events).toEqual(['OcaWorker', 'OcaGain', 'OcaWorker', 'OcaMute'])
	})
})

// ---------------------------------------------------------------------------
// Every aes70 control class
// ---------------------------------------------------------------------------

type ControlClass = (new (ono: number, device: any) => ObjectBase) & { ClassName: string; ClassID: string }

/**
 * Every control class aes70 exports. The DeusO docs, which the class list was first written from,
 * cover AES70.js 1.1 and miss 21 classes aes70 2.x has. An object of a class the module doesn't
 * list is filed under its nearest listed ancestor, so a missing class fails nothing but this.
 * Filtered as `unknown`, because aes70's typings leave out the static ClassName and ClassID.
 */
const AES70_CLASSES = (Object.values(ControlClasses) as unknown[]).filter(
	(value): value is ControlClass =>
		typeof value === 'function' && typeof (value as { ClassID?: unknown }).ClassID === 'string',
)

/** The module's name for an aes70 class. Only the block factory differs, named as the DeusO docs name it. */
const moduleNameOf = (Cls: ControlClass): string =>
	Cls.ClassName === 'OcaBlockFactoryAgent' ? OCA_CLASS_NAMES.OcaBlockFactory : Cls.ClassName

describe('every aes70 control class', () => {
	it('is found', () => {
		// So a broken filter can't pass every test below by matching nothing
		expect(AES70_CLASSES.length).toBeGreaterThanOrEqual(119)
	})

	it.each(AES70_CLASSES.map((Cls) => [Cls.ClassName, Cls] as const))(
		'%s is registered and dispatched as its own class',
		async (_name, Cls) => {
			const helper = new OcaHelper()
			const events: string[] = []
			const originalEmit = helper.emit.bind(helper) as (...args: unknown[]) => boolean
			vi.spyOn(helper, 'emit').mockImplementation((eventName: string | symbol, ...args: unknown[]) => {
				events.push(String(eventName))
				return originalEmit(eventName, ...args)
			})
			const obj = makeObj(Cls, 1)

			await helper.loadRoleMap(new Map<string, unknown>([['Obj', obj]]))
			expect(helper.getEntry('Obj')?.className).toBe(moduleNameOf(Cls))
			events.length = 0
			helper.determineClass(obj)
			expect(events.at(-1)).toBe(moduleNameOf(Cls))
		},
	)

	it.each(AES70_CLASSES.map((Cls) => [Cls.ClassName, Cls] as const))('%s has its class ID', (_name, Cls) => {
		const ids: Record<string, string> = OCA_CLASS_IDS
		expect(ids[moduleNameOf(Cls)]).toBe(OcaHelper.classIdToDotted(Cls.ClassID))
	})

	it('lists no class aes70 no longer has', () => {
		const known = new Set(AES70_CLASSES.map(moduleNameOf))
		const listed = Object.values(OCA_CLASS_NAMES).filter((name) => name !== OCA_CLASS_NAMES.ObjectBase)
		expect(listed.filter((name) => !known.has(name))).toEqual([])
	})
})

// ---------------------------------------------------------------------------
// loadRoleMap
// ---------------------------------------------------------------------------

describe('loadRoleMap', () => {
	let helper: OcaHelper

	beforeEach(() => {
		helper = new OcaHelper()
	})

	it('registers only OcaRoot instances and filters out other objects', async () => {
		const gain = makeObj(OcaGain, 1)
		const notRoot = makePlainObjectBase(2)
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Faders/1', gain],
				['NotARoot/1', notRoot],
			]),
		)

		expect(helper.getRolePaths()).toEqual(['Faders/1'])
		expect(helper.hasPath('NotARoot/1')).toBe(false)
	})

	it('builds the class index and emits map:loaded with the filtered role map', async () => {
		const listener = vi.fn()
		helper.on('map:loaded', listener)

		const gain = makeObj(OcaGain, 1)
		const mute = makeObj(OcaMute, 2)
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Faders/Gain', gain],
				['Faders/Mute', mute],
			]),
		)

		expect(helper.getByClass(OCA_CLASS_NAMES.OcaGain)).toEqual(new Set(['Faders/Gain']))
		expect(helper.getByClass(OCA_CLASS_NAMES.OcaMute)).toEqual(new Set(['Faders/Mute']))
		expect(listener).toHaveBeenCalledTimes(1)
		const [passedMap] = listener.mock.calls[0]
		expect(Array.from(passedMap.keys())).toEqual(['Faders/Gain', 'Faders/Mute'])
	})

	it('migrates action/feedback IDs for role paths that survive a reload', async () => {
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', makeObj(OcaGain, 1)]]))
		await helper.addActionId('Faders/1', 'action-1')
		await helper.addFeedbackId('Faders/1', 'feedback-1')

		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', makeObj(OcaGain, 1)]]))

		expect(helper.resolveActionId('action-1')).toBe('Faders/1')
		expect(helper.resolveFeedbackId('feedback-1')).toBe('Faders/1')
		expect(helper.getEntry('Faders/1')?.actionIds.has('action-1')).toBe(true)
		expect(helper.getEntry('Faders/1')?.feedbackIds.has('feedback-1')).toBe(true)
	})

	it('disposes the old property sync and re-syncs the new object for a migrated path on reload', async () => {
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', makeObj(OcaGain, 1)]]))
		await helper.addActionId('Faders/1', 'action-1')
		const oldProps = helper.getEntry('Faders/1')?.properties as unknown as FakePropertySync
		expect(oldProps).toBeDefined()

		const newGain = makeObj(OcaGain, 1)
		const { getPropertySync: newGetPropertySync } = rigOf(newGain)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', newGain]]))

		expect(oldProps.Dispose).toHaveBeenCalledTimes(1)
		expect(newGetPropertySync).toHaveBeenCalledTimes(1)
		expect(helper.getEntry('Faders/1')?.properties).toBeDefined()
		expect(helper.getEntry('Faders/1')?.properties).not.toBe(oldProps)
	})

	it('disposes property sync for orphaned paths that held IDs on reload', async () => {
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', makeObj(OcaGain, 1)]]))
		await helper.addActionId('Faders/1', 'action-1')
		const oldProps = helper.getEntry('Faders/1')?.properties as unknown as FakePropertySync

		await helper.loadRoleMap(new Map<string, unknown>())

		expect(oldProps.Dispose).toHaveBeenCalledTimes(1)
	})

	it('emits ids:orphaned only for removed paths that actually held IDs', async () => {
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Faders/1', makeObj(OcaGain, 1)],
				['Faders/2', makeObj(OcaGain, 2)],
			]),
		)
		await helper.addActionId('Faders/2', 'action-2')

		const orphanedListener = vi.fn()
		helper.on('ids:orphaned', orphanedListener)

		// Reload without Faders/2 (had an ID) or Faders/3 (never existed).
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', makeObj(OcaGain, 1)]]))

		expect(orphanedListener).toHaveBeenCalledExactlyOnceWith(['Faders/2'])
		expect(helper.resolveActionId('action-2')).toBeUndefined()
	})

	it('does not emit ids:orphaned when no removed path held any IDs', async () => {
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Faders/1', makeObj(OcaGain, 1)],
				['Faders/2', makeObj(OcaGain, 2)],
			]),
		)

		const orphanedListener = vi.fn()
		helper.on('ids:orphaned', orphanedListener)

		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', makeObj(OcaGain, 1)]]))

		expect(orphanedListener).not.toHaveBeenCalled()
	})
})

// ---------------------------------------------------------------------------
// OcaBlock membership-change notifications ('tree:changed')
// ---------------------------------------------------------------------------

describe('tree:changed notifications', () => {
	let helper: OcaHelper

	beforeEach(() => {
		helper = new OcaHelper()
	})

	it('subscribes to OnMembersChanged for a registered OcaBlock and emits tree:changed with its role path when it fires', async () => {
		const block = makeObj(OcaBlock, 1)
		const subscribeSpy = vi.spyOn(block.OnMembersChanged, 'subscribe')

		await helper.loadRoleMap(new Map<string, unknown>([['Groups/1', block]]))

		expect(subscribeSpy).toHaveBeenCalledTimes(1)
		const handler = subscribeSpy.mock.calls[0][0] as () => void

		const listener = vi.fn()
		helper.on('tree:changed', listener)
		handler()

		expect(listener).toHaveBeenCalledExactlyOnceWith('Groups/1')
	})

	it('does not treat non-block objects as having members to watch', async () => {
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))

		const listener = vi.fn()
		helper.on('tree:changed', listener)
		;(gain as unknown as { OnPropertyChanged: { emit: (args: unknown[]) => void } }).OnPropertyChanged.emit([])

		expect(listener).not.toHaveBeenCalled()
	})

	it('unsubscribes the old block and subscribes the new one when a role path is reloaded with a different instance', async () => {
		// Uses has_subscribers() rather than spying on unsubscribe(): teardown
		// uses the idempotent closure returned by subscribe() (so a connection
		// close that already cleared the subscription doesn't throw), not the
		// deprecated unsubscribe(callback) method.
		const blockV1 = makeObj(OcaBlock, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Groups/1', blockV1]]))
		expect(blockV1.OnMembersChanged.has_subscribers()).toBe(true)

		const blockV2 = makeObj(OcaBlock, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Groups/1', blockV2]]))

		expect(blockV1.OnMembersChanged.has_subscribers()).toBe(false)
		expect(blockV2.OnMembersChanged.has_subscribers()).toBe(true)
	})

	it('unsubscribes a block that is no longer present in a reloaded map', async () => {
		const block = makeObj(OcaBlock, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Groups/1', block]]))
		expect(block.OnMembersChanged.has_subscribers()).toBe(true)

		await helper.loadRoleMap(new Map<string, unknown>())

		expect(block.OnMembersChanged.has_subscribers()).toBe(false)
	})

	it('tearing down a block subscription is safe even if the connection already cleared it (e.g. on close)', async () => {
		// Regression test: a real connection close calls OnPropertyChanged's
		// emit_error(), which silently wipes every subscriber — including
		// OnMembersChanged's, via its registered error callback — before we
		// ever get a chance to unsubscribe. Reloading afterwards must not
		// throw "Subscriber does not exist."
		const block = makeObj(OcaBlock, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Groups/1', block]]))
		expect(block.OnMembersChanged.has_subscribers()).toBe(true)

		type ErroringEvent = { emit_error: (err: unknown) => void }
		;(block.OnPropertyChanged as unknown as ErroringEvent).emit_error(new Error('simulated connection close'))
		expect(block.OnMembersChanged.has_subscribers()).toBe(false)

		await expect(helper.loadRoleMap(new Map<string, unknown>())).resolves.toBeUndefined()
	})
})

// ---------------------------------------------------------------------------
// Class-index / registry query API
// ---------------------------------------------------------------------------

describe('class index and registry queries', () => {
	let helper: OcaHelper

	beforeEach(async () => {
		helper = new OcaHelper()
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Faders/1', makeObj(OcaGain, 1)],
				['Faders/2', makeObj(OcaGain, 2)],
				['Mutes/1', makeObj(OcaMute, 3)],
			]),
		)
	})

	it('getByClass returns an empty set (not undefined) for a class with no members', () => {
		expect(helper.getByClass(OCA_CLASS_NAMES.OcaSwitch)).toEqual(new Set())
	})

	it('getChoicesByClass formats role paths as dropdown choices', () => {
		expect(helper.getChoicesByClass(OCA_CLASS_NAMES.OcaMute)).toEqual([{ id: 'Mutes/1', label: 'Mutes/1' }])
	})

	it('hasClass reflects whether any object of that class is registered', () => {
		expect(helper.hasClass(OCA_CLASS_NAMES.OcaGain)).toBe(true)
		expect(helper.hasClass(OCA_CLASS_NAMES.OcaSwitch)).toBe(false)
	})

	it('getClassNames lists every class with at least one member', () => {
		expect(helper.getClassNames().sort()).toEqual([OCA_CLASS_NAMES.OcaGain, OCA_CLASS_NAMES.OcaMute].sort())
	})

	it('getClassIndex snapshots the index as a plain object of arrays', () => {
		expect(helper.getClassIndex()).toEqual({
			[OCA_CLASS_NAMES.OcaGain]: ['Faders/1', 'Faders/2'],
			[OCA_CLASS_NAMES.OcaMute]: ['Mutes/1'],
		})
	})

	it('getEntry/getObject/getClassName return data for known paths and undefined for unknown ones', () => {
		expect(helper.getClassName('Mutes/1')).toBe(OCA_CLASS_NAMES.OcaMute)
		expect(helper.getObject('Mutes/1')).toBeDefined()
		expect(helper.getEntry('Mutes/1')?.className).toBe(OCA_CLASS_NAMES.OcaMute)

		expect(helper.getClassName('Nope')).toBeUndefined()
		expect(helper.getObject('Nope')).toBeUndefined()
		expect(helper.getEntry('Nope')).toBeUndefined()
	})

	it('getTypedObject returns the object only when the guard matches', () => {
		const isOcaGain = (obj: unknown): obj is OcaGain => OcaHelper.isOcaGain(obj)
		expect(helper.getTypedObject('Faders/1', isOcaGain)).toBeDefined()
		expect(helper.getTypedObject('Mutes/1', isOcaGain)).toBeUndefined()
		expect(helper.getTypedObject('Nope', isOcaGain)).toBeUndefined()
	})

	it('getRolePaths and hasPath reflect the registered paths', () => {
		expect(helper.getRolePaths()).toEqual(['Faders/1', 'Faders/2', 'Mutes/1'])
		expect(helper.hasPath('Faders/1')).toBe(true)
		expect(helper.hasPath('Nope')).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// Action ID / feedback ID registries
// ---------------------------------------------------------------------------

describe('action IDs', () => {
	let helper: OcaHelper

	beforeEach(async () => {
		helper = new OcaHelper()
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Faders/1', makeObj(OcaGain, 1)],
				['Faders/2', makeObj(OcaGain, 2)],
			]),
		)
	})

	it('rejects when the role path is not registered', async () => {
		await expect(helper.addActionId('Nope', 'a1')).rejects.toThrow(/not registered/)
	})

	it('syncs properties only on the first ID registered to a path', async () => {
		const { getPropertySync } = rigOf(helper.getObject('Faders/1') as ObjectBase)

		await helper.addActionId('Faders/1', 'a1')
		expect(getPropertySync).toHaveBeenCalledTimes(1)
		expect(helper.getEntry('Faders/1')?.properties).toBeDefined()

		await helper.addActionId('Faders/1', 'a2')
		expect(getPropertySync).toHaveBeenCalledTimes(1)
		expect(helper.getEntry('Faders/1')?.actionIds).toEqual(new Set(['a1', 'a2']))
	})

	it('resolveActionId, getObjectByActionId and hasActionId reflect registrations', async () => {
		await helper.addActionId('Faders/1', 'a1')

		expect(helper.resolveActionId('a1')).toBe('Faders/1')
		expect(helper.getObjectByActionId('a1')).toBe(helper.getObject('Faders/1'))
		expect(helper.hasActionId('a1')).toBe(true)

		expect(helper.resolveActionId('missing')).toBeUndefined()
		expect(helper.getObjectByActionId('missing')).toBeUndefined()
		expect(helper.hasActionId('missing')).toBe(false)
	})

	it('disposing properties is safe even if the connection already cleared the subscription (e.g. on close)', async () => {
		// Regression test: a real connection close calls OnPropertyChanged's
		// own emit_error(), which silently wipes its subscriber list before we
		// ever get a chance to unsubscribe. Disposal afterwards (e.g. via a
		// reconnect's loadRoleMap()) must not throw "Subscriber does not exist."
		await helper.addActionId('Faders/1', 'a1')
		const obj = helper.getObject('Faders/1') as unknown as { OnPropertyChanged: { emit_error: (err: unknown) => void } }

		obj.OnPropertyChanged.emit_error(new Error('simulated connection close'))

		expect(() => helper.clearActionIds('Faders/1')).not.toThrow()
	})

	it('reassigns an ID already registered to a different path, disposing the old path if emptied', async () => {
		await helper.addActionId('Faders/1', 'a1')
		const propsBefore = helper.getEntry('Faders/1')?.properties as unknown as FakePropertySync

		await helper.addActionId('Faders/2', 'a1')

		expect(helper.resolveActionId('a1')).toBe('Faders/2')
		expect(helper.getEntry('Faders/1')?.actionIds.has('a1')).toBe(false)
		expect(propsBefore.Dispose).toHaveBeenCalledTimes(1)
		expect(helper.getEntry('Faders/1')?.properties).toBeUndefined()
	})

	it('removeActionId returns false for an unknown ID and true when it removes a known one', async () => {
		expect(helper.removeActionId('missing')).toBe(false)

		await helper.addActionId('Faders/1', 'a1')
		const props = helper.getEntry('Faders/1')?.properties as unknown as FakePropertySync

		expect(helper.removeActionId('a1')).toBe(true)
		expect(helper.hasActionId('a1')).toBe(false)
		expect(props.Dispose).toHaveBeenCalledTimes(1)
		expect(helper.getEntry('Faders/1')?.properties).toBeUndefined()
	})

	it('does not dispose properties while a feedback ID still holds the sync open', async () => {
		await helper.addActionId('Faders/1', 'a1')
		await helper.addFeedbackId('Faders/1', 'f1')
		const props = helper.getEntry('Faders/1')?.properties as unknown as FakePropertySync

		helper.removeActionId('a1')

		expect(props.Dispose).not.toHaveBeenCalled()
		expect(helper.getEntry('Faders/1')?.properties).toBeDefined()
	})

	it('clearActionIds removes every action ID for a path and disposes if no feedback IDs remain', async () => {
		await helper.addActionId('Faders/1', 'a1')
		await helper.addActionId('Faders/1', 'a2')
		const props = helper.getEntry('Faders/1')?.properties as unknown as FakePropertySync

		helper.clearActionIds('Faders/1')

		expect(helper.getEntry('Faders/1')?.actionIds.size).toBe(0)
		expect(helper.resolveActionId('a1')).toBeUndefined()
		expect(helper.resolveActionId('a2')).toBeUndefined()
		expect(props.Dispose).toHaveBeenCalledTimes(1)
	})

	it('does not sync properties when GetPropertySync().sync() rejects, but still registers the ID', async () => {
		const { propertySync } = rigOf(helper.getObject('Faders/1') as ObjectBase)
		propertySync.sync.mockRejectedValueOnce(new Error('boom'))

		await expect(helper.addActionId('Faders/1', 'a1')).resolves.toBeUndefined()

		expect(helper.hasActionId('a1')).toBe(true)
		expect(helper.getEntry('Faders/1')?.properties).toBeUndefined()
	})
})

describe('feedback IDs', () => {
	let helper: OcaHelper

	beforeEach(async () => {
		helper = new OcaHelper()
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Faders/1', makeObj(OcaGain, 1)],
				['Faders/2', makeObj(OcaGain, 2)],
			]),
		)
	})

	it('rejects when the role path is not registered', async () => {
		await expect(helper.addFeedbackId('Nope', 'f1')).rejects.toThrow(/not registered/)
	})

	it('resolveFeedbackId, getObjectByFeedbackId and hasFeedbackId reflect registrations', async () => {
		await helper.addFeedbackId('Faders/1', 'f1')

		expect(helper.resolveFeedbackId('f1')).toBe('Faders/1')
		expect(helper.getObjectByFeedbackId('f1')).toBe(helper.getObject('Faders/1'))
		expect(helper.hasFeedbackId('f1')).toBe(true)
	})

	it('reassigns a feedback ID already registered to a different path', async () => {
		await helper.addFeedbackId('Faders/1', 'f1')
		await helper.addFeedbackId('Faders/2', 'f1')

		expect(helper.resolveFeedbackId('f1')).toBe('Faders/2')
		expect(helper.getEntry('Faders/1')?.feedbackIds.has('f1')).toBe(false)
	})

	it('removeFeedbackId returns false for an unknown ID and true when it removes a known one', async () => {
		expect(helper.removeFeedbackId('missing')).toBe(false)

		await helper.addFeedbackId('Faders/1', 'f1')
		expect(helper.removeFeedbackId('f1')).toBe(true)
		expect(helper.hasFeedbackId('f1')).toBe(false)
	})

	it('clearFeedbackIds removes every feedback ID for a path and disposes if no action IDs remain', async () => {
		await helper.addFeedbackId('Faders/1', 'f1')
		const props = helper.getEntry('Faders/1')?.properties as unknown as FakePropertySync

		helper.clearFeedbackIds('Faders/1')

		expect(helper.getEntry('Faders/1')?.feedbackIds.size).toBe(0)
		expect(props.Dispose).toHaveBeenCalledTimes(1)
	})

	it('property:change fires with the set of feedback IDs when the object notifies a property change', async () => {
		await helper.addFeedbackId('Faders/1', 'f1')
		await helper.addFeedbackId('Faders/1', 'f2')

		const listener = vi.fn()
		helper.on('property:change', listener)

		const obj = helper.getObject('Faders/1') as unknown as { OnPropertyChanged: { emit: (args: unknown[]) => void } }
		obj.OnPropertyChanged.emit([])

		expect(listener).toHaveBeenCalledExactlyOnceWith(new Set(['f1', 'f2']))
	})
})

describe('clearAllIds', () => {
	it('clears both action and feedback IDs for a path and disposes the property sync', async () => {
		const helper = new OcaHelper()
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', makeObj(OcaGain, 1)]]))

		await helper.addActionId('Faders/1', 'a1')
		await helper.addFeedbackId('Faders/1', 'f1')
		const props = helper.getEntry('Faders/1')?.properties as unknown as FakePropertySync

		helper.clearAllIds('Faders/1')

		expect(helper.resolveActionId('a1')).toBeUndefined()
		expect(helper.resolveFeedbackId('f1')).toBeUndefined()
		expect(helper.getEntry('Faders/1')?.actionIds.size).toBe(0)
		expect(helper.getEntry('Faders/1')?.feedbackIds.size).toBe(0)
		expect(props.Dispose).toHaveBeenCalledTimes(1)
	})

	it('is a no-op for an unregistered path', () => {
		const helper = new OcaHelper()
		expect(() => helper.clearAllIds('Nope')).not.toThrow()
	})
})

// ---------------------------------------------------------------------------
// Missing property warnings
// ---------------------------------------------------------------------------

describe('missing property warnings', () => {
	let helper: OcaHelper
	let logs: CapturedLogs

	/**
	 * An OcaGain whose sync reports Gain but no value for Label, which is what aes70's
	 * PropertySync does for a property whose getter the device refused.
	 */
	function makeGainWithoutLabel(ono: number): OcaGain {
		const obj = makeObj(OcaGain, ono)
		rigOf(obj).propertySync.forEach.mockImplementation((cb: (value: unknown, name: string) => void) => {
			cb(-6, 'Gain')
			cb(undefined, 'Label')
		})
		return obj
	}

	beforeEach(async () => {
		logs = captureLogs()
		helper = new OcaHelper()
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Faders/1', makeGainWithoutLabel(1)],
				['Faders/2', makeGainWithoutLabel(2)],
			]),
		)
	})

	afterEach(() => {
		logs.restore()
	})

	it('implementsProperty says whether the synced object returned a value, and nothing before it is synced', async () => {
		expect(helper.implementsProperty('Faders/1', 'Gain')).toBeUndefined()
		expect(helper.implementsProperty('Nope', 'Gain')).toBeUndefined()

		await helper.addActionId('Faders/1', 'a1')

		expect(helper.implementsProperty('Faders/1', 'Gain')).toBe(true)
		expect(helper.implementsProperty('Faders/1', 'Label')).toBe(false)
		expect(helper.implementsProperty('Faders/1', 'NotAProperty')).toBe(false)
	})

	it('warns once for an action using a property its object returned no value for', async () => {
		await helper.addActionId('Faders/1', 'a1')

		helper.warnIfPropertyMissing('action', 'a1', 'Faders/1', 'Label')
		helper.warnIfPropertyMissing('action', 'a1', 'Faders/1', 'Label')

		expect(logs.warnings()).toEqual([
			'"Faders/1" (OcaGain) returned no value for property "Label", so probably doesn\'t implement it. The action a1 using it will fail.',
		])
	})

	it('says nothing for a property the object implements, or until the object is synced', async () => {
		helper.warnIfPropertyMissing('action', 'a1', 'Faders/1', 'Label')
		expect(logs.warnings()).toEqual([])

		await helper.addActionId('Faders/1', 'a1')
		helper.warnIfPropertyMissing('action', 'a1', 'Faders/1', 'Gain')
		expect(logs.warnings()).toEqual([])

		// Checking before the sync didn't count as having warned
		helper.warnIfPropertyMissing('action', 'a1', 'Faders/1', 'Label')
		expect(logs.warnings()).toHaveLength(1)
	})

	it('warns again when pointed at another object or property and back, or when removed and re-added', async () => {
		await helper.addActionId('Faders/1', 'a1')
		await helper.addActionId('Faders/2', 'a2')

		helper.warnIfPropertyMissing('action', 'a1', 'Faders/1', 'Label')
		helper.warnIfPropertyMissing('action', 'a1', 'Faders/1', 'Gain')
		helper.warnIfPropertyMissing('action', 'a1', 'Faders/1', 'Label')
		helper.warnIfPropertyMissing('action', 'a1', 'Faders/2', 'Label')
		expect(logs.warnings()).toHaveLength(3)

		helper.removeActionId('a1')
		await helper.addActionId('Faders/2', 'a1')
		helper.warnIfPropertyMissing('action', 'a1', 'Faders/2', 'Label')
		expect(logs.warnings()).toHaveLength(4)
	})

	it('keeps an action and a feedback with the same id apart', async () => {
		await helper.addActionId('Faders/1', 'x')
		await helper.addFeedbackId('Faders/1', 'x')

		helper.warnIfPropertyMissing('action', 'x', 'Faders/1', 'Label')
		helper.warnIfPropertyMissing('feedback', 'x', 'Faders/1', 'Label')

		expect(logs.warnings()).toEqual([
			expect.stringContaining('The action x using it will fail.'),
			expect.stringContaining('The feedback x using it will fail.'),
		])
	})
})

// ---------------------------------------------------------------------------
// getClassProperties
// ---------------------------------------------------------------------------

describe('getClassProperties', () => {
	it('returns [] for a class with no registered members', async () => {
		const helper = new OcaHelper()
		await expect(helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)).resolves.toEqual([])
	})

	it('describes properties, excluding ClassID and undefined values, deriving write from Set<Name> presence', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))

		const { propertySync } = rigOf(gain)
		propertySync.forEach.mockImplementation((cb: (value: unknown, name: string) => void) => {
			cb('1.1.1.5', 'ClassID')
			cb(1, 'ObjectNumber') // no SetObjectNumber -> not writable
			cb(-3.5, 'Gain') // OcaGain has SetGain -> writable
			cb(undefined, 'Ignored')
		})

		const props = await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)

		expect(props).toEqual([
			{ name: 'ObjectNumber', type: 'number', read: true, write: false, level: 1 }, // declared on OcaRoot
			{ name: 'Gain', type: 'number', read: true, write: true, level: 4 }, // declared on OcaGain
		])
	})

	// The device sends ClassID as one character per level. OcaFloat32Sensor's 1.1.2.1.10 ends in a
	// newline, which split the line in an exported log; the others logged as invisible control characters.
	it('logs an inspected ClassID in dotted notation', async () => {
		const logs = captureLogs()
		try {
			const helper = new OcaHelper()
			const gain = makeObj(OcaGain, 1)
			await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
			rigOf(gain).propertySync.forEach.mockImplementation((cb: (value: unknown, name: string) => void) => {
				cb(OcaHelper.classIdToBinary('1.1.2.1.10'), 'ClassID')
			})

			await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)

			expect(logs.debugs()).toContain(
				'Inspecting property "ClassID" of class "OcaGain" with value: "1.1.2.1.10" of type: string',
			)
		} finally {
			logs.restore()
		}
	})

	// Objects of one class can implement different optional properties, so the representative
	// alone can miss some. A registered object's property sync reads everything it implements.
	it('grows with the properties of an object registered later, reporting the discovery once', async () => {
		const helper = new OcaHelper()
		const first = makeObj(OcaGain, 1)
		const second = makeObj(OcaGain, 2)
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Gains/1', first],
				['Gains/2', second],
			]),
		)
		rigOf(first).propertySync.forEach.mockImplementation((cb: (value: unknown, name: string) => void) => {
			cb(-3, 'Gain')
		})
		rigOf(second).propertySync.forEach.mockImplementation((cb: (value: unknown, name: string) => void) => {
			cb(true, 'Enabled')
			cb(-6, 'Gain')
		})
		expect((await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)).map((prop) => prop.name)).toEqual(['Gain'])
		const discovered = vi.fn()
		helper.on('properties:discovered', discovered)

		await helper.addFeedbackId('Gains/2', 'f1')

		expect(discovered).toHaveBeenCalledExactlyOnceWith(OCA_CLASS_NAMES.OcaGain)
		// Enabled is declared on OcaWorker, so it sorts ahead of Gain
		expect((await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)).map((prop) => prop.name)).toEqual([
			'Enabled',
			'Gain',
		])
	})

	it('does not report a registered object that implements nothing new', async () => {
		const helper = new OcaHelper()
		const first = makeObj(OcaGain, 1)
		const second = makeObj(OcaGain, 2)
		await helper.loadRoleMap(
			new Map<string, unknown>([
				['Gains/1', first],
				['Gains/2', second],
			]),
		)
		for (const obj of [first, second]) {
			rigOf(obj).propertySync.forEach.mockImplementation((cb: (value: unknown, name: string) => void) => {
				cb(-3, 'Gain')
			})
		}
		await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)
		const discovered = vi.fn()
		helper.on('properties:discovered', discovered)

		await helper.addFeedbackId('Gains/2', 'f1')

		expect(discovered).not.toHaveBeenCalled()
	})

	it('relearns discovered properties on reload, from the registrations it migrates', async () => {
		const helper = new OcaHelper()
		const first = makeObj(OcaGain, 1)
		const second = makeObj(OcaGain, 2)
		const roleMap = new Map<string, unknown>([
			['Gains/1', first],
			['Gains/2', second],
		])
		await helper.loadRoleMap(roleMap)
		rigOf(first).propertySync.forEach.mockImplementation((cb: (value: unknown, name: string) => void) => {
			cb(-3, 'Gain')
		})
		rigOf(second).propertySync.forEach.mockImplementation((cb: (value: unknown, name: string) => void) => {
			cb(true, 'Enabled')
			cb(-6, 'Gain')
		})
		await helper.addFeedbackId('Gains/2', 'f1')

		await helper.loadRoleMap(roleMap)

		expect((await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)).map((prop) => prop.name)).toEqual([
			'Enabled',
			'Gain',
		])
	})

	it('records the members of enum properties, including one inherited from a base class', async () => {
		const helper = new OcaHelper()
		const sensor = makeObj(OcaAudioLevelSensor, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Meters/1', sensor]]))
		rigOf(sensor).propertySync.forEach.mockImplementation((cb: (value: unknown, name: string) => void) => {
			cb(OcaSensorReadingState.Valid, 'ReadingState') // declared on OcaSensor
			cb(OcaLevelMeterLaw.PPM1, 'Law') // declared on OcaAudioLevelSensor
			cb(-20, 'Reading')
		})

		const props = await helper.getClassProperties(OCA_CLASS_NAMES.OcaAudioLevelSensor)
		const byName = new Map(props.map((prop) => [prop.name, prop]))

		expect(byName.get('ReadingState')?.enumValues).toEqual({
			Unknown: 0,
			Valid: 1,
			Underrange: 2,
			Overrange: 3,
			Error: 4,
		})
		expect(Object.keys(byName.get('Law')?.enumValues ?? {})).toContain('PPM1')
		expect(byName.get('Reading')?.enumValues).toBeUndefined()
	})

	it('disposes the temporary property sync when the object has no registered action/feedback IDs', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
		const { propertySync } = rigOf(gain)

		await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)

		expect(propertySync.Dispose).toHaveBeenCalledTimes(1)
	})

	// On a role map reload, getClassProperties() runs after IDs have been migrated, so the
	// representative object usually has its own live sync. Measured against a real device,
	// leaving the temporary sync open there added one observer per property on every reload.
	it('disposes the temporary property sync even when the object has registered IDs, leaving its own sync open', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
		// Like aes70, hand out a new PropertySync on every call
		const created: FakePropertySync[] = []
		rigOf(gain).getPropertySync.mockImplementation(() => {
			const sync = makeFakePropertySync()
			created.push(sync)
			return sync
		})
		await helper.addActionId('Faders/1', 'a1')

		await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)

		expect(created).toHaveLength(2)
		const [entrySync, temporarySync] = created
		expect(temporarySync?.Dispose).toHaveBeenCalledTimes(1)
		expect(entrySync?.Dispose).not.toHaveBeenCalled()
		expect(helper.getEntry('Faders/1')?.properties).toBe(entrySync)
	})

	it('disposes the temporary property sync when syncing it fails', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
		const { propertySync } = rigOf(gain)
		propertySync.sync.mockRejectedValueOnce(new Error('connection closed'))

		await expect(helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)).rejects.toThrow(/connection closed/)

		expect(propertySync.Dispose).toHaveBeenCalledTimes(1)
	})

	// Discovery reads every property off a representative object, which on
	// devices lacking the optional OcaRoot/OcaWorker properties produces a burst
	// of NotImplemented/BadMethod responses — so it must happen once per class,
	// not once per caller (action and feedback definitions both ask).
	it('probes the device only once per class, serving repeat callers from cache', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
		const { getPropertySync, propertySync } = rigOf(gain)

		const first = await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)
		const second = await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)

		expect(getPropertySync).toHaveBeenCalledTimes(1)
		expect(propertySync.sync).toHaveBeenCalledTimes(1)
		expect(second).toEqual(first)
	})

	it('does not re-probe when concurrent callers ask for the same class', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
		const { getPropertySync } = rigOf(gain)

		await Promise.all([
			helper.getClassProperties(OCA_CLASS_NAMES.OcaGain),
			helper.getClassProperties(OCA_CLASS_NAMES.OcaGain),
		])

		expect(getPropertySync).toHaveBeenCalledTimes(1)
	})

	it('re-probes after loadRoleMap, since the representative object may have changed', async () => {
		const helper = new OcaHelper()
		const gainV1 = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gainV1]]))
		await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)
		expect(rigOf(gainV1).getPropertySync).toHaveBeenCalledTimes(1)

		const gainV2 = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gainV2]]))
		await helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)

		expect(rigOf(gainV2).getPropertySync).toHaveBeenCalledTimes(1)
	})

	it('does not cache a failed probe, so a later attempt can still succeed', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
		const { getPropertySync, propertySync } = rigOf(gain)
		propertySync.sync.mockRejectedValueOnce(new Error('device unreachable'))

		await expect(helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)).rejects.toThrow(/device unreachable/)
		await expect(helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)).resolves.toBeDefined()

		expect(getPropertySync).toHaveBeenCalledTimes(2)
	})
})

// ---------------------------------------------------------------------------
// Connection closing mid-sync
// ---------------------------------------------------------------------------

describe('connection closing mid-sync', () => {
	// From aes70 2.0.21, PropertySync.sync() rejects with the CloseError its pending reads fail with when
	// the connection closes part way through. Before that it never settled, and the module had to give up
	// on it itself

	/** True if `promise` settles within `ms`, false if it is still pending. */
	async function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
		return Promise.race([
			promise.then(
				() => true,
				() => true,
			),
			new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
		])
	}

	it('finishes a registration whose sync the connection closing cut short, leaving it without properties', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
		const { propertySync } = rigOf(gain)
		propertySync.sync.mockRejectedValueOnce(new CloseError())

		await expect(helper.addFeedbackId('Faders/1', 'f1')).resolves.toBeUndefined()
		expect(helper.getEntry('Faders/1')?.properties).toBeUndefined()
		expect(propertySync.Dispose).toHaveBeenCalled()
	})

	it('rejects a class probe whose sync the connection closing cut short, so the next call probes again', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
		rigOf(gain).propertySync.sync.mockRejectedValueOnce(new CloseError())

		await expect(helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)).rejects.toMatchObject({
			name: 'aes70.CloseError',
		})
		await expect(helper.getClassProperties(OCA_CLASS_NAMES.OcaGain)).resolves.toEqual([])
		expect(rigOf(gain).getPropertySync).toHaveBeenCalledTimes(2)
	})

	it('finishes loading a role map whose migrated registrations were re-syncing when the connection closed', async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		const roleMap = new Map<string, unknown>([['Faders/1', gain]])
		await helper.loadRoleMap(roleMap)
		await helper.addFeedbackId('Faders/1', 'f1')
		rigOf(gain).propertySync.sync.mockRejectedValueOnce(new CloseError())
		const loaded = vi.fn()
		helper.on('map:loaded', loaded)

		await expect(helper.loadRoleMap(roleMap)).resolves.toBeUndefined()
		expect(loaded).toHaveBeenCalledTimes(1)
	})

	// Companion aborts a feedback check's signal when it queues another check, and won't start that one
	// until this one settles, so a check stuck waiting on a sync would otherwise never update again
	it("stops waiting on a registration when the caller's signal aborts, while the sync carries on for others", async () => {
		const helper = new OcaHelper()
		const gain = makeObj(OcaGain, 1)
		await helper.loadRoleMap(new Map<string, unknown>([['Faders/1', gain]]))
		let finishSync: (() => void) | undefined
		rigOf(gain).propertySync.sync.mockReturnValueOnce(new Promise<void>((resolve) => (finishSync = resolve)))
		const controller = new AbortController()

		const registering = helper.addFeedbackId('Faders/1', 'f1', controller.signal)
		const outcome = registering.then(
			() => 'registered',
			(err: unknown) => err,
		)
		controller.abort(new Error('recheck queued'))

		expect(await settlesWithin(registering, 200)).toBe(true)
		expect(await outcome).toMatchObject({ message: 'recheck queued' })
		finishSync?.()
		await vi.waitFor(() => expect(helper.getEntry('Faders/1')?.properties).toBeDefined())
	})
})

// ---------------------------------------------------------------------------
// Static type guards
// ---------------------------------------------------------------------------

describe('static type guards', () => {
	it('match only their exact class, not a shared base class', () => {
		const gain = makeObj(OcaGain, 1)
		const mute = makeObj(OcaMute, 2)

		expect(OcaHelper.isOcaGain(gain)).toBe(true)
		expect(OcaHelper.isOcaGain(mute)).toBe(false)
		expect(OcaHelper.isOcaMute(mute)).toBe(true)

		// Both are OcaActuator subclasses, but the exact-class guard for the
		// abstract base should reject concrete subclasses.
		expect(OcaHelper.isOcaActuator(gain)).toBe(false)
	})

	it('distinguishes nested sensor subtypes', () => {
		const audioLevel = makeObj(OcaAudioLevelSensor, 1)
		const level = makeObj(OcaLevelSensor, 2)

		expect(OcaHelper.isOcaAudioLevelSensor(audioLevel)).toBe(true)
		expect(OcaHelper.isOcaLevelSensor(audioLevel)).toBe(false)
		expect(OcaHelper.isOcaLevelSensor(level)).toBe(true)
	})

	it('rejects values of an unrelated type', () => {
		expect(OcaHelper.isOcaGain({})).toBe(false)
		expect(OcaHelper.isOcaGain(null)).toBe(false)
		expect(OcaHelper.isOcaGain(undefined)).toBe(false)
	})

	describe('isValidClassName', () => {
		it('accepts every known class name and rejects unknown strings', () => {
			expect(OcaHelper.isValidClassName('OcaGain')).toBe(true)
			expect(OcaHelper.isValidClassName('NotARealClass')).toBe(false)
		})
	})
})

// ---------------------------------------------------------------------------
// Class ID conversion
// ---------------------------------------------------------------------------

describe('classIdToBinary / classIdToDotted', () => {
	it('converts a dotted class ID to its binary string form and back', () => {
		const dotted = '1.2.33'
		const binary = OcaHelper.classIdToBinary(dotted)

		expect(binary).toBe('!')
		expect(OcaHelper.classIdToDotted(binary)).toBe(dotted)
	})

	it('treats the empty string as its own round trip', () => {
		expect(OcaHelper.classIdToBinary('')).toBe('')
		expect(OcaHelper.classIdToDotted('')).toBe('')
	})
})

describe('getObjectProperties and refused writes', () => {
	const device = {
		send_command: (): undefined => undefined,
		add_subscription: (): undefined => undefined,
		remove_subscription: (): undefined => undefined,
	}
	/** An object reporting only `reported`, the way a device serves the properties it implements. */
	const filter = (ono: number, reported: [name: string, value: unknown][]): OcaFilterParametric => {
		const obj = new OcaFilterParametric(ono, device as unknown as ConstructorParameters<typeof OcaFilterParametric>[1])
		;(obj as unknown as { GetPropertySync: unknown }).GetPropertySync = () => ({
			sync: async (): Promise<void> => undefined,
			forEach: (cb: (value: unknown, name: string) => void): void => {
				for (const [name, value] of reported) cb(value, name)
			},
			Dispose: (): undefined => undefined,
		})
		return obj
	}

	it("reports only the properties an object itself returned, not its class's", async () => {
		const helper = new OcaHelper()
		await helper.loadRoleMap(
			new Map<string, unknown>([
				[
					'EQ/Band1',
					filter(1, [
						['Enabled', true],
						['Frequency', 1000],
						['WidthParameter', 1],
					]),
				],
				['EQ/Band2', filter(2, [['Frequency', 1000]])],
			]),
		)

		const band1 = (await helper.getObjectProperties('EQ/Band1')).map((prop) => prop.name)
		const band2 = (await helper.getObjectProperties('EQ/Band2')).map((prop) => prop.name)

		expect(band1).toEqual(['Enabled', 'Frequency', 'WidthParameter'])
		// Its sibling implements more, and the class's set is the union, but this object's is its own
		expect(band2).toEqual(['Frequency'])
		expect((await helper.getClassProperties(OCA_CLASS_NAMES.OcaFilterParametric)).map((prop) => prop.name)).toEqual(
			expect.arrayContaining(['Enabled', 'Frequency', 'WidthParameter']),
		)
	})

	// A device can serve a property's value and still refuse to set it, and AES70 has no way to ask
	// beforehand, so the refusal is the only signal
	it('stops calling a property settable once the object has refused to set it', async () => {
		const helper = new OcaHelper()
		const refused = vi.fn()
		helper.on('property:refused', refused)
		await helper.loadRoleMap(
			new Map<string, unknown>([
				[
					'EQ/Band2',
					filter(1, [
						['Frequency', 1000],
						['Shape', 1],
					]),
				],
			]),
		)
		const writable = async (): Promise<string[]> =>
			(await helper.getObjectProperties('EQ/Band2')).filter((prop) => prop.write).map((prop) => prop.name)

		expect(await writable()).toEqual(['Frequency', 'Shape'])

		helper.markWriteRefused('EQ/Band2', 'Shape')

		expect(await writable()).toEqual(['Frequency'])
		// Still readable, so it keeps its value on the button; only setting it is off
		expect((await helper.getObjectProperties('EQ/Band2')).map((prop) => prop.name)).toEqual(['Frequency', 'Shape'])
		expect(refused).toHaveBeenCalledExactlyOnceWith('EQ/Band2', 'Shape')

		// Repeats are quiet, so a button pressed again doesn't schedule another rebuild
		helper.markWriteRefused('EQ/Band2', 'Shape')
		expect(refused).toHaveBeenCalledTimes(1)
	})
})
