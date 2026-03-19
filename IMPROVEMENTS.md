# Future Improvements

Tracked improvements to revisit outside of active feature work.

## Multipart Parser (`lib/multipart.js`)

The parser is a modified version of the `parse-multipart` library (by Cristian Salazar), adapted for Cisco CUCM DIME responses. It works but has accumulated technical debt.

### Unnecessary `Object.defineProperty`

Lines 34-46 use `Object.defineProperty` with all descriptor flags set to `true` (`writable`, `enumerable`, `configurable`). This is functionally identical to a simple property assignment (`obj.prop = value`). Replace with direct assignment for clarity.

### Byte-by-byte parsing is slow for large files

The FSM iterates every byte using `String.fromCharCode` to build `lastline` for boundary detection. For large DIME payloads (log files can be tens of MB), using `Buffer.indexOf()` to find boundary markers would be significantly faster.

### `DemoData()` is dead code

The `DemoData` export (lines 126-145) is a leftover from the original `parse-multipart` library's demo. It is not used anywhere in cisco-dime and should be removed.

### `var` declarations

All variables use `var`. Migrating to `const`/`let` would clarify mutation intent and prevent accidental hoisting bugs.

### No error handling for malformed multipart

If the boundary isn't found or the multipart structure is malformed, the parser silently returns an empty array. Adding a warning via the `debug` module would help troubleshoot failed file downloads.
