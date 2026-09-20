export enum ExitCode {
  Success = 0,
  Flagged = 1,
  Error = 2,
}

export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode = ExitCode.Error,
  ) {
    super(message);
    this.name = "CliError";
  }
}
