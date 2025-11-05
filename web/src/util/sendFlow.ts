/**
 * Regulates the flow of data being sent through the data channel by buffer
 * size. The buffer should not exceede `threshold` bytes, and will wait before
 * pushing more data.
 */
export async function* sendFlow(
  dc: RTCDataChannel,
  threshold = 4 * 64 * 1_024
) {
  dc.bufferedAmountLowThreshold = threshold;

  let _r: ((arg0: unknown) => void) | undefined = undefined;

  try {
    while (true) {
      if (dc.bufferedAmount <= threshold) {
        yield;
      } else {
        await new Promise(r =>
          dc.addEventListener('bufferedamountlow', (_r = r), {once: true})
        );
        _r = undefined;
        yield;
      }
    }
  } finally {
    if (_r) {
      dc.removeEventListener('bufferedamountlow', _r);
    }
  }
}
