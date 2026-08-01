export function nextRandom(holder) {
  let state = holder.rngState >>> 0;
  if (state === 0) state = 0x6d2b79f5;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  holder.rngState = state >>> 0;
  return holder.rngState / 0x100000000;
}
