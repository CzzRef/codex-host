import { watchParentProcess } from "./parent-process-watch.js";
import { parseDesktopControllerArguments, runDesktopController } from "./production-controller.js";

const abort = new AbortController();
const stop = (): void => abort.abort();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
// The Launcher is the only legitimate parent. If it disappears without
// stopping this Controller first, stop anyway rather than outliving it.
const stopParentWatch = watchParentProcess({
  onLost() {
    console.error("codexhost Desktop Controller: Launcher exited; stopping");
    stop();
  },
});

try {
  await runDesktopController(parseDesktopControllerArguments(process.argv.slice(2)), abort.signal);
} catch (error) {
  console.error(
    `codexhost Desktop Controller: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
} finally {
  stopParentWatch();
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
