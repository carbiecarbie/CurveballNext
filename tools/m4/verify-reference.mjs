import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// File identity only. This does not execute AVM1 or measure native game objects.
const expected = {
  sha256: '4c837f4960ac661a40b0b7cad4323f5410df1905693fa3ecb810f9740c325977',
  signature: 'FWS', version: 5, actualBytes: 59360, declaredBytes: 59360,
  rectTwips: [0, 7000, 0, 5000], width: 350, height: 250, fps: 30, rootFrames: 115,
};

try {
  if (process.argv.length !== 3) throw new Error('Usage: node tools/m4/verify-reference.mjs <private-reference.swf>');
  const bytes = readFileSync(process.argv[2]);
  if (bytes.length < 9) throw new Error('Truncated SWF header');
  if (bytes.toString('ascii', 0, 3) !== 'FWS') throw new Error('Expected uncompressed FWS');
  let bit = 64;
  function bits(count, signed = false) {
    if (bit + count > bytes.length * 8) throw new Error('Truncated SWF rectangle');
    let value = 0;
    for (let i = 0; i < count; i++, bit++) value = value * 2 + ((bytes[Math.floor(bit / 8)] >>> (7 - bit % 8)) & 1);
    return signed && value >= 2 ** (count - 1) ? value - 2 ** count : value;
  }
  const count = bits(5);
  if (count === 0) throw new Error('Invalid SWF rectangle bit count');
  const rectTwips = Array.from({ length: 4 }, () => bits(count, true));
  const offset = Math.ceil(bit / 8);
  if (offset + 4 > bytes.length) throw new Error('Truncated SWF frame metadata');
  const observed = {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    signature: bytes.toString('ascii', 0, 3), version: bytes[3],
    actualBytes: bytes.length, declaredBytes: bytes.readUInt32LE(4), rectTwips,
    width: (rectTwips[1] - rectTwips[0]) / 20,
    height: (rectTwips[3] - rectTwips[2]) / 20,
    fps: bytes.readUInt16LE(offset) / 256, rootFrames: bytes.readUInt16LE(offset + 2),
  };
  const mismatches = Object.keys(expected).filter(key => JSON.stringify(observed[key]) !== JSON.stringify(expected[key]));
  console.log(JSON.stringify({ evidenceClass: 'FILE_IDENTITY_ONLY', result: mismatches.length ? 'FAIL' : 'PASS', observed, mismatches }, null, 2));
  if (mismatches.length) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ evidenceClass: 'FILE_IDENTITY_ONLY', result: 'FAIL', error: error.message }));
  process.exitCode = 1;
}
