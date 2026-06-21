/**
 * Structured logger — output JSON lines สำหรับ production
 * dev mode แสดงเป็น human-readable แทน
 */

type LogLevel = 'info' | 'warn' | 'error';

type LogEntry = {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
};

const isDev = process.env.NODE_ENV !== 'production';

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };

  if (isDev) {
    let color = '\x1b[36m';
    if (level === 'error') color = '\x1b[31m';
    else if (level === 'warn') color = '\x1b[33m';
    const meta_str = meta ? ` ${  JSON.stringify(meta)}` : '';
    console.info(`${color}[${level.toUpperCase()}]\x1b[0m ${msg}${meta_str}`);
  } else {
    console.info(JSON.stringify(entry));
  }
}

export const logger = {
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};
