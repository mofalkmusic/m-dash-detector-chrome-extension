# M-Dash Detector Chrome extension

A Chrome extension that highlights em-dashes (—) on webpages. These dashes are commonly used by AI language models, making this a handy tool to spot AI-generated text.

## Installation

### 1. Download the Extension

1. Go to the [**Releases**](../../releases) page
2. Download `mdash-detector.zip` from the latest release
3. Extract the zip file to a folder on your computer

<!-- INSTALL_START -->

### Install in Chrome

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `mdash-detector` folder (the one containing `manifest.json`)
5. Done! The extension is now active on all websites
<!-- INSTALL_END -->

## How It Works

The extension scans every webpage for em-dashes (—) and highlights them with a visual indicator. A small notification appears when em-dashes are detected on a page.

## A Note on Quality

This extension was speedrun into existence with the help of [Claude Code](https://claude.ai) ☕—because sometimes you just need a tool _right now_. It should work perfectly fine for everyday use, but if you stumble upon any gremlins hiding in the code, I'd genuinely appreciate it if you opened an issue on the [GitHub repo](../../issues). Thanks for helping make it better!

## For Developers

### Prerequisites

- [Bun](https://bun.sh/) runtime

### Build from Source

```bash
# Install dependencies
bun install

# Build the extension
bun run build

# The built extension will be in the `dist` folder
# A ready-to-distribute zip will be created as mdash-detector.zip
```

### Development

```bash
# Watch for changes and rebuild
bun run dev
```

---

_Made to help you stay aware of AI-generated content._
