const path = require('path');

console.log = () => {};
console.error = () => {};

const Zkteco = require(path.resolve(__dirname, '../node_modules/zkteco-js'));

const describeError = (error) => {
  if (!error) {
    return 'Unknown device error.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object') {
    const nestedError = error;
    if (typeof nestedError.message === 'string' && nestedError.message.trim()) {
      return nestedError.message;
    }
    if (
      nestedError.err &&
      typeof nestedError.err.message === 'string' &&
      nestedError.err.message.trim()
    ) {
      return nestedError.err.message;
    }
    if (
      nestedError.err &&
      nestedError.err.err &&
      typeof nestedError.err.err.message === 'string' &&
      nestedError.err.err.message.trim()
    ) {
      return nestedError.err.err.message;
    }
  }

  return String(error);
};

const writeResultAndExit = (payload, exitCode = 0) => {
  process.stdout.write(JSON.stringify(payload));
  process.exit(exitCode);
};

process.on('uncaughtException', (error) => {
  writeResultAndExit(
    {
      ok: false,
      error: `UNCAUGHT: ${describeError(error)}`,
    },
    1,
  );
});

process.on('unhandledRejection', (error) => {
  writeResultAndExit(
    {
      ok: false,
      error: `UNHANDLED: ${describeError(error)}`,
    },
    1,
  );
});

const [host, portArg, operation] = process.argv.slice(2);
const port = Number(portArg || 4370);

if (!host || !operation) {
  writeResultAndExit(
    {
      ok: false,
      error: 'Runner requires host, port, and operation.',
    },
    1,
  );
}

(async () => {
  const client = new Zkteco(host, port, 15000, 5000);

  try {
    await client.createSocket();

    if (operation === 'getAttendances') {
      const response = await client.getAttendances();
      writeResultAndExit({
        ok: true,
        data: Array.isArray(response?.data) ? response.data : [],
      });
      return;
    }

    if (operation === 'clearAttendanceLog') {
      await client.clearAttendanceLog();
      let remainingLogCount = null;

      try {
        remainingLogCount = await client.getAttendanceSize();
      } catch {
        remainingLogCount = null;
      }

      writeResultAndExit({
        ok: true,
        remainingLogCount,
      });
      return;
    }

    writeResultAndExit(
      {
        ok: false,
        error: `Unsupported runner operation: ${operation}`,
      },
      1,
    );
  } catch (error) {
    writeResultAndExit(
      {
        ok: false,
        error: describeError(error),
      },
      1,
    );
  } finally {
    try {
      await client.disconnect();
    } catch {
      // noop
    }
  }
})();
