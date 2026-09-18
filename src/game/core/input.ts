export type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export function detectDevice(): DeviceMode {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const touch = navigator.maxTouchPoints > 1;
  const w = Math.max(window.innerWidth, window.innerHeight);
  if (coarse || touch) return w >= 1024 ? 'tablet' : 'mobile';
  return 'desktop';
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export interface PointerState {
  x: number;
  y: number;
  down: boolean;
  button: number;
}

export class Input {
  keys = new Set<string>();
  pointer: PointerState = { x: 0, y: 0, down: false, button: -1 };
  wheelDelta = 0;
  private listeners: Array<() => void> = [];
  private keyDownHandlers = new Map<string, Array<(e: KeyboardEvent) => void>>();
  private target: HTMLElement;

  constructor(target: HTMLElement) {
    this.target = target;
    this.bind();
  }

  private bind() {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const code = e.code;
      if (!e.repeat) {
        this.keys.add(code);
        const handlers = this.keyDownHandlers.get(code);
        if (handlers) for (const h of handlers) h(e);
      }
      if (['Tab', 'Space', 'KeyB', 'KeyA', 'KeyS', 'KeyP', 'KeyY', 'F1'].includes(code)) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    const onBlur = () => this.keys.clear();
    const onContext = (e: Event) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      this.wheelDelta += e.deltaY;
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.target.addEventListener('contextmenu', onContext);
    this.target.addEventListener('wheel', onWheel, { passive: false });

    this.listeners.push(() => window.removeEventListener('keydown', onKeyDown));
    this.listeners.push(() => window.removeEventListener('keyup', onKeyUp));
    this.listeners.push(() => window.removeEventListener('blur', onBlur));
    this.listeners.push(() => this.target.removeEventListener('contextmenu', onContext));
    this.listeners.push(() => this.target.removeEventListener('wheel', onWheel));
  }

  onKey(code: string, handler: (e: KeyboardEvent) => void) {
    const list = this.keyDownHandlers.get(code) ?? [];
    list.push(handler);
    this.keyDownHandlers.set(code, list);
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  get ctrl(): boolean {
    return this.keys.has('ControlLeft') || this.keys.has('ControlRight');
  }

  get shift(): boolean {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  consumeWheel(): number {
    const d = this.wheelDelta;
    this.wheelDelta = 0;
    return d;
  }

  destroy() {
    for (const off of this.listeners) off();
    this.listeners.length = 0;
    this.keyDownHandlers.clear();
    this.keys.clear();
  }
}
