/**
 * Sends a file through the data channel starting at chunk index `startIndex`
 */
export const sendFile = async (
  file: File,
  dc: RTCDataChannel,
  chunkSize: number,
  startIndex = 0
) => {
  const chunks = Math.ceil(file.size / chunkSize);
  let offset = startIndex * chunkSize;

  dc.send(
    JSON.stringify({
      name: file.name,
      /** @deprecated */
      filename: file.name,
      size: file.size,
      type: file.type,
      chunks,
    })
  );

  // TODO: should there be in intermediate step here where the recvr accepts the file before it sends? this could also be used to resuume/send partial files

  for await (const _ of bufferFlow(dc, 4 * chunkSize)) {
    if (offset >= file.size) {
      break;
    }

    const data = file.slice(offset, offset + chunkSize);
    const chunk = await data.arrayBuffer();
    offset += chunk.byteLength;

    dc.send(data);
  }
};

/**
 * Regulates the flow of data being sent through the data channel by buffer
 * size. The buffer should not exceede `threshold` bytes, and will wait before
 * pushing more data.
 */
export async function* bufferFlow(
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
        console.log('waiting');
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
