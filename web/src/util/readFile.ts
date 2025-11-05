/** Lazily reads a file in chunks of size `chunkSize` starting at index `startIndex` */
export async function* readFile(
  file: File,
  chunkSize = 64 * 1_024,
  startIndex = 0
) {
  let offset = chunkSize * startIndex;
  let index = startIndex;

  while (offset < file.size) {
    const slc = file.slice(offset, offset + chunkSize);
    const chunk = await slc.arrayBuffer();

    yield {index, chunk};

    offset += chunkSize;
    index++;
  }
}
