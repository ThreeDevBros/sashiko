

# Plan: Disable Text/Image Selection App-Wide

Add CSS rules to `src/index.css` to prevent all text, image, and element selection across the entire app. This is common for mobile/native-feel web apps.

## Changes

### `src/index.css` — Add to the `@layer base` block

Add the following to the `body` rule:

```css
body {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
```

Also add an exception for input fields and textareas so users can still select/edit text in form fields:

```css
input, textarea, [contenteditable="true"] {
  -webkit-user-select: text;
  user-select: text;
}
```

Add image drag prevention:

```css
img {
  -webkit-user-drag: none;
  user-drag: none;
  pointer-events: auto;
}
```

**One file modified**: `src/index.css`

