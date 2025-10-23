# AI Studio Advanced Settings Setter (userscript)

This userscript automates the configuration of Google AI Studio's chat UI. It can set the model, temperature, thinking budget, grounding toggle, and system prompt automatically — either from a set of built-in defaults or from URL query parameters. It also supports auto-inserting a first message or attaching a YouTube URL to the chat input.

This is intended for use with Tampermonkey, Greasemonkey, or other userscript managers in modern browsers.

## Key features

- Automatically set model (e.g. `gemini-2.5-pro`).
- Configure thinking budget (automatic/manual toggle + slider).
- Set temperature slider value.
- Toggle grounding (Search-as-a-tool) on/off.
- Set the system prompt (system instructions) programmatically.
- Optionally paste a YouTube URL and run a summarization prompt.
- Optionally set the first user message in the chat input and submit it.
- Listens for UI interactions and keeps convenient defaults (e.g. resets temperature when switching models or starting new chat).

## Installation

1. Install a userscript manager in your browser (Tampermonkey is recommended).
2. Create a new script and paste the contents of `ai-studio.user.js`, or install directly from the script's `downloadURL` if hosted.
3. Enable the script and navigate to https://aistudio.google.com/.

Note: The script runs at `document-idle` and targets pages under `https://aistudio.google.com/*`.

## Usage — URL parameters

You can configure the script using URL query parameters. Examples below assume you opened AI Studio with appended query parameters.

Supported parameters:

- `model` — Model identifier string. Example: `model=gemini-2.5-pro`.
- `budget` — Thinking budget as an integer. Use `-1` to disable manual budget and let AI Studio decide. Example: `budget=128`.
- `temp` — Temperature value (float). Example: `temp=0.5`.
- `grounding` — Enable grounding/search-as-a-tool. Use `true`, `false`, `1`, or `0`. Example: `grounding=true`.
- `sp` — System prompt (system instructions). URL-encode long text. Example: `sp=Your%20system%20prompt%20here`.
- `yt_url` — A YouTube URL to paste into the chat input; the script will wait for the YouTube chunk to appear and then run a summarization prompt. Example: `yt_url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ`.
- `fm` — First message: insert and submit this text in the main input area. URL-encode if needed.

Examples:

- Open AI Studio with model and temperature set:

  https://aistudio.google.com/?model=gemini-2.5-pro&temp=0

- Open with a YouTube URL to auto-attach and ask for a summary:

  https://aistudio.google.com/?yt_url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DEXAMPLE

- Set a custom system prompt and first message:

  https://aistudio.google.com/?sp=Custom%20system%20prompt%20here&fm=Hello%2C%20please%20summarize%20my%20note

## How it works (brief)

When the page contains AI Studio's controls, the script waits for the settings area and then:

1. Reads URL params (falls back to defaults if absent).
2. Clicks the model selector and chooses the requested model (if different).
3. Toggles thinking budget and sets the slider when requested.
4. Sets the temperature slider.
5. Toggles grounding (Search-as-a-tool) on/off.
6. Opens the System Instructions panel, fills the textarea, and closes it.
7. Optionally pastes a YouTube URL or sets the first message and runs the prompt.

All interactions are performed by simulating clicks, input events, and keyboard events so they behave like manual UI changes.

## Customization

- Change defaults by editing the `defaultSettings` object at the top of `ai-studio.user.js`.
- You can modify the script to add presets or listen for keyboard shortcuts to apply different configurations.

## Troubleshooting

- If the script fails to find UI elements, AI Studio may have changed selectors or markup. Open the browser console to see error logs prefixed with `[Tampermonkey]`.
- Ensure the userscript manager has permission to run on `https://aistudio.google.com/*`.
- If the system prompt isn't applied, the script looks for a button with `data-test-system-instructions-card` and a textarea labeled `System instructions`. Selector changes on AI Studio will require updating those selectors.
- If pasting YouTube URLs doesn't create a video chunk, the script retries up to 2 times, then inserts the URL as plain text.

## Example flows

- Quick start (use defaults): open AI Studio and the script will set model to `gemini-2.5-pro`, temperature to `0`, and apply the embedded system prompt.
- Auto summarize a video:
  - Open the AI Studio URL with `yt_url` set.
  - The script pastes the link, waits for the video chunk UI, replaces the input with a summarization prompt, and clicks Run.

## License

This repository contains the userscript and is distributed under the same LICENSE file included in the repository root. Check `LICENSE` for terms.

## Notes and caveats

- This script relies on specific element attributes and class names present in AI Studio's web UI. It may need updates if Google changes the UI.
- Use responsibly and avoid automating actions that violate AI Studio's terms of service.
