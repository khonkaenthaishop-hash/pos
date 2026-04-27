// Minimal Web Serial API typings for TS (avoids `navigator.serial` being `unknown`)

type SerialPortOpenOptions = {
  baudRate: number;
};

interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialPortOpenOptions): Promise<void>;
  close(): Promise<void>;
}

interface Serial {
  requestPort(options?: Record<string, unknown>): Promise<SerialPort>;
}

interface Navigator {
  serial: Serial;
}

