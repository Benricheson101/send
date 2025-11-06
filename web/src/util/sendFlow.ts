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

  while (true) {
    if (dc.bufferedAmount > threshold) {
      await new Promise(r =>
        dc.addEventListener('bufferedamountlow', r, {once: true})
      );
    }
    yield;
  }
}
