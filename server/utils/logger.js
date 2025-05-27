// server/utils/logger.js

const getTimestamp = () => new Date().toISOString();

const log = (level, ...args) => {
  const timestamp = getTimestamp();
  switch (level.toUpperCase()) {
    case 'INFO':
      console.log(`[${timestamp}] [INFO]`, ...args);
      break;
    case 'WARN':
      console.warn(`[${timestamp}] [WARN]`, ...args);
      break;
    case 'ERROR':
      console.error(`[${timestamp}] [ERROR]`, ...args);
      break;
    case 'DEBUG':
      // You might want to enable debug logs only in development
      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[${timestamp}] [DEBUG]`, ...args);
      }
      break;
    default:
      console.log(`[${timestamp}] [${level.toUpperCase()}]`, ...args);
  }
};

const logger = {
  info: (...args) => log('INFO', ...args),
  warn: (...args) => log('WARN', ...args),
  error: (...args) => log('ERROR', ...args),
  debug: (...args) => log('DEBUG', ...args),
  // You can add a generic log method if needed
  custom: (level, ...args) => log(level, ...args),
};

module.exports = logger;