# Local multi-track and privacy-mask extension

This local extension retains the upstream AGPL-3.0-only license and copyright notices.

- Existing recording channels can be named, muted and gain-adjusted independently. Channel positions are preserved; this is not acoustic source separation.
- Additional local recordings can be imported as synchronized tracks. They start at source time zero and share the parent clip's cuts. Short sources become silent at their end; longer tails are not played. Arbitrary track offsets and DAW-style independent waveform editing are not supported.
- Background music remains independently editable.
- Non-destructive source-time `privacyRanges` replace main and synchronized voice audio during the marked intervals. Four local mask styles are supported: bleep, synthesized bird chirp, low tone and silence. Music is not masked.
- The global style selector updates all clip styles in one undoable action. Drafts persist settings and ranges. Legacy projects with no markers retain their original audio. A burned-in bleep cannot be replaced without the unmasked source and known marker positions.
- Word-boundary audition uses raw source audio and can expose masked content; use main playback or export to hear the privacy mix.
- The interface follows system light/dark appearance without a manual override.

No external transcription or model service is needed for these features. Existing optional transcription/Agent operations have their own configured service behavior. Privacy markers are editing instructions, not proof that a recording is safe to publish; listen and review before sharing.

Validation: `npm run test:multitrack`, `npm run test:privacy`, `npm run test:smoke`, `npm run build`, `npm run check:release`. Tests use generated synthetic samples, including disk WAV export parity for four privacy styles.

## Branding

This fork uses a user-approved, AI-generated teal waveform/scissors mark in light and dark variants. It is custom fork branding, not an endorsement by the upstream author. The page mark and favicon follow the operating-system color scheme. The generated mark is distributed under this repository's AGPL-3.0-only license alongside the extension.
