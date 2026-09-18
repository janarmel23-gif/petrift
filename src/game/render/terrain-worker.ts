import { shadeRows } from './terrain-gen';

interface ChunkRequest {
  key: number;
  epoch: number;
  x0: number;
  y0: number;
  size: number;
  scale: number;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<ChunkRequest>) => void) | null;
  postMessage: (message: unknown, transfer: Transferable[]) => void;
};

scope.onmessage = (e) => {
  const { key, epoch, x0, y0, size, scale } = e.data;
  const data = new Uint8ClampedArray(size * size * 4);
  shadeRows(data, size, x0, y0, scale, 0, size);
  scope.postMessage({ key, epoch, size, buffer: data.buffer }, [data.buffer]);
};
