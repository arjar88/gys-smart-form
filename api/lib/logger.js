function log(level, scope, message, data = {}) {
  const entry = {
    level,
    scope,
    message,
    ...data,
    ts: new Date().toISOString(),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function createLogger(scope) {
  return {
    info(message, data) {
      log("info", scope, message, data);
    },
    warn(message, data) {
      log("warn", scope, message, data);
    },
    error(message, err, data = {}) {
      log("error", scope, message, {
        ...data,
        error: err?.message || String(err),
        stack: err?.stack,
      });
    },
  };
}
