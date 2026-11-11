# tools — custom tools for common edits, by code

A custom tool is a small operation Magic Hour does not offer, or offers badly, done by code at zero credits: words on
a picture, a crop, a resize, a side-by-side, a contact sheet. Each is one file exporting `tool`:

```js
export const tool = {
  id: "text-overlay", group: "change-content", custom: true, credits: 0,
  takes: ["picture"], makes: "picture", needs: ["picture", "text"],
  guarantees: ["legible text", "exact words", "placement"],   // what this tool can promise that a model cannot
  explain: "one line for the catalogue and the working tree",
  run({ inputs, params, out }) { /* inputs: [{ name, file }] absolute; write `out`; return { file: out } */ },
};
```

`index.js` lists them; the agent's catalogue (`../backend/agent/catalogue.js`) merges the list into the tool table and
the planner reads each tool's `guarantees` when the desired state needs a property an image model cannot hold. The
executor (`../backend/agent/execute.js`) dispatches any tool marked `custom` to its `run()` and records it like a paid
call, with zero credits.

| tool | what it promises | built |
|---|---|---|
| `text-overlay` | legible, exact words placed on a picture (top, middle, bottom) | 2026-10-31 |
| `crop` | the exact aspect, anchored, nothing regenerated | 2026-10-31 |
| `write` | a text by the text model: post copy, a caption, a note | 2026-10-31 |
| `check` | a vision verdict on a picture: the gate as a node | 2026-10-31 |
| `resize` / `side-by-side` / `contact-sheet` | layout without a model | to do |
