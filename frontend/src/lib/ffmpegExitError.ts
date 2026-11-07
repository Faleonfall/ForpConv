// FFmpeg ran and refused the job, eg an encoder rejected its settings. The
// core still works, unlike after a wasm fault that throws any other error.
export class FfmpegExitError extends Error {
  readonly exitCode: number;

  constructor(exitCode: number) {
    super(`FFmpeg exited with ${exitCode}`);
    this.name = "FfmpegExitError";
    this.exitCode = exitCode;
  }
}
