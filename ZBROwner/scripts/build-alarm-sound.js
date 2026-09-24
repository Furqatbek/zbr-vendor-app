#!/usr/bin/env node
/**
 * Build the bundled alarm sound by looping a short source clip.
 *
 * The source is ~1.5s. A notification channel plays its sound ONCE, so a vendor
 * across a kitchen gets a blip that is easy to miss — which is exactly what was
 * reported. The in-app alarm loops and was never the problem; the push channel
 * sound was.
 *
 * This produces a file long enough to behave like a ringing phone: it keeps
 * sounding until someone looks.
 *
 * Kept as a script rather than a one-off binary edit so the output has
 * provenance — the source clip stays in the repo and the length is one constant.
 *
 * Usage: npm run build:alarm
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SOURCE = path.join(root, 'assets', 'sounds', 'new_order_loop.wav');
const OUTPUT = path.join(root, 'assets', 'sounds', 'new_order.wav');

/**
 * Target length in seconds.
 *
 * iOS caps a custom notification sound at 30 SECONDS — a longer file is
 * silently replaced by the default sound, which would undo the whole point. 20s
 * leaves margin while still ringing long enough to cross a room.
 */
const TARGET_SECONDS = 20;

/** Walk the RIFF chunks rather than assuming a 44-byte header. */
function parseWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  let offset = 12;
  let fmt = null;
  let data = null;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buffer.readUInt16LE(offset + 8),
        channels: buffer.readUInt16LE(offset + 10),
        sampleRate: buffer.readUInt32LE(offset + 12),
        bitsPerSample: buffer.readUInt16LE(offset + 22),
      };
    } else if (id === 'data') {
      data = buffer.subarray(offset + 8, offset + 8 + size);
    }
    offset += 8 + size + (size % 2); // chunks are word-aligned
  }

  if (!fmt || !data) throw new Error('Missing fmt or data chunk');
  if (fmt.audioFormat !== 1) throw new Error(`Expected PCM, got format ${fmt.audioFormat}`);
  return { fmt, data };
}

/** Minimal canonical PCM WAV: 44-byte header plus the samples. */
function buildWav(fmt, data) {
  const byteRate = (fmt.sampleRate * fmt.channels * fmt.bitsPerSample) / 8;
  const blockAlign = (fmt.channels * fmt.bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(fmt.channels, 22);
  header.writeUInt32LE(fmt.sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(fmt.bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}

const { fmt, data } = parseWav(fs.readFileSync(SOURCE));
const bytesPerSecond = (fmt.sampleRate * fmt.channels * fmt.bitsPerSample) / 8;
const sourceSeconds = data.length / bytesPerSecond;
const repeats = Math.max(1, Math.round(TARGET_SECONDS / sourceSeconds));

const looped = Buffer.concat(Array.from({ length: repeats }, () => data));
const output = buildWav(fmt, looped);
fs.writeFileSync(OUTPUT, output);

const seconds = looped.length / bytesPerSecond;
console.log(
  `\nAlarm sound built\n${'─'.repeat(50)}\n` +
    `  source : ${path.relative(root, SOURCE)}  ${sourceSeconds.toFixed(2)}s\n` +
    `  output : ${path.relative(root, OUTPUT)}  ${seconds.toFixed(2)}s ` +
    `(${repeats}x, ${(output.length / 1024 / 1024).toFixed(2)} MB)\n` +
    `  format : ${fmt.sampleRate} Hz, ${fmt.channels} ch, ${fmt.bitsPerSample}-bit PCM\n`,
);

if (seconds > 30) {
  console.error('  PROBLEM  Over 30s. iOS ignores a longer custom sound and plays');
  console.error('           the default instead, which defeats the purpose.\n');
  process.exit(1);
}
console.log('  Under the 30s iOS limit.\n');
