## Open Control Architecture: AES70

[OCA Alliance](https://ocaalliance.com)

Connect to AES70/OCA-compatible devices via TCP, UDP, or WebSockets. Get or set properties on the device's control objects.

#### How it works

When the module connects, it loads the device's role map and discovers every control class it exposes. For each control class that has at least one property of a supported data type, the module automatically generates one action and one value feedback for that class. If the device dynamically changes its role map, the module will detect this event and reload the role map, updating the action and feedback definitions.

Until the module is connected, no actions or feedbacks are defined - as such offline configuration of this module is not supported.

#### Actions

| Option           | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `Control Object` | Dropdown listing the available objects of that class on the device |
| `Property`       | Dropdown listing the supported properties for that class           |
| `Value`          | The value to set on the selected property                          |

Media recorder/players and task agents also get a **Run Command** action, which takes a `Control Object` and a `Command`:

| Class                   | Commands                         |
| ----------------------- | -------------------------------- |
| `Media Recorder Player` | Play, Record, Stop, Reset, Close |
| `Task Agent`            | Start, Stop, Reset, Clear        |

Commands that need arguments (`Open`, and a task agent's `Prepare` and `Run`) aren't available.

#### Feedbacks

| Option              | Description                                                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Control Object`    | Dropdown listing the available objects of that class on the device                                                                                                                                                                                                         |
| `Property`          | Dropdown listing the supported properties for that class                                                                                                                                                                                                                   |
| `Use Property Sync` | Enabled by default - uses the library's property-tracking ("sync") mechanism to keep the feedback value up to date. When disabled, the module instead uses the library's `async` getter directly, which can return different (and sometimes more complex) data structures. |
| `Enum`              | Shown only when the selected property is an enum and `Use Property Sync` is enabled. Enabled by default - returns the enum member's name instead of its raw numeric value.                                                                                                 |

For more detail on how properties, getters, and sync work, see the [AES70.js documentation](https://docs.deuso.de/AES70.js/introduction.html).

#### Variables

Some device info is presented as connection variables, depending on what the device exposes. All other control object data is accessible via the value feedbacks.

#### Presets

Presets are built from what the connected device reports, so a device only gets presets for the objects and properties it has. They are grouped into sections:

| Section             | What you get                                                                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Toggles`           | A button per mute, polarity, boolean actuator and identify object. A press toggles it, and the button lights while muted (red), inverted (amber), on (green) or identifying (blue).                                                                                   |
| `Rotaries`          | A dial per gain, pan, delay, frequency, switch and number actuator, for a rotary encoder. Turning steps the value within the limits the device reports, and an arc on the button shows where it sits. These can be located on both a rotary and the display above it. |
| `Meters`            | A button per numeric sensor, showing the reading and a bar.                                                                                                                                                                                                           |
| `Status`            | A button per boolean sensor, lit amber while true, and per state sensor, naming the state it is in.                                                                                                                                                                   |
| `Equalisers`        | A group per filter band, with a button for each setting the band supports.                                                                                                                                                                                            |
| `Dynamics`          | A group per dynamics processor, with a button for each setting it supports.                                                                                                                                                                                           |
| `Signal Generators` | A group per generator, with buttons for enable, start/stop, waveform, level, frequencies and sweep.                                                                                                                                                                   |

Most dials take finer steps while held pressed as you turn them.

As a generic module, some fine tuning is to be expected. Most of it is done with each button's local variables:

| Local variable        | On                                                       | What it sets                                                                                         | Default                       |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| `step_size`           | Dials that step by a fixed amount, such as gain          | How far each detent moves the value. Holding the dial takes a tenth of that.                         | 1, or 10 on integer actuators |
| `step_divisions`      | Frequency, time and ratio dials                          | How many detents make a doubling, so 3 steps a frequency by a third of an octave.                    | 3                             |
| `step_divisions_fine` | Frequency, time and ratio dials, while held              | The same, while the dial is held.                                                                    | 24                            |
| `range_divisions`     | Filter width and delay dials                             | How many detents cross the whole range the device reports. Holding the dial takes ten times as many. | 25                            |
| `max_value`           | Buttons that step through a list, such as a filter shape | The last value the dial steps to. Lower it where a device supports fewer values than AES70 defines.  | The last value in the list    |
| `meter_min`           | Level meters                                             | The bottom of the bar, in dB. The device's own minimum is used where it is higher.                   | -60                           |

#### Graphics elements

The module also provides graphics elements for your own layered buttons. The presets use them too.

- `Signal Meter`: a bar for a sensor reading.
- `Value Dial`, `Centred Dial` and `Width Dial`: knob-style arcs, filling from the minimum, growing out from zero, or opening out from the middle.

Give each one a value and the ends of its range. A Get Property feedback with `Use Property Sync` disabled returns all three from one read, as `{ values: [value, min, max] }`, for most number properties.

#### Caveats

- This module has not yet reached a stable `1.0` release - breaking changes may occur without notice.
- Compatibility with custom (vendor-specific) control classes is untested.
- Connections via UDP and WebSockets are untested.
- Actions only support setting properties with simple data types (`string | number | boolean`), including enums with dropdowns. There are two exceptions: a signal generator's `Generating` is set by calling its `Start` and `Stop` methods, and a dynamics `Threshold` sets its level while keeping the reference the device measures it from.
- Enum dropdowns list every value AES70 defines, not only the ones a device supports. A device may refuse an unsupported value, or quietly substitute another, for example by resetting an unsupported filter shape to PEQ.
- The Run Command action has not yet been tried on a device.
- Presets for signal generators, classical filters, pan, frequency actuators and extended delays have not yet been tried on a device.
