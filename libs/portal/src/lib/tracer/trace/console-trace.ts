import { Trace } from "../trace";
import { TraceFormatter } from "../trace-formatter";
import { TraceEntry } from "../trace-entry";

/**
 * A <code>ConsoleTrace</code> will emit trace entries to the console.
 */
export class ConsoleTrace extends Trace {
  // constructor

  constructor(messageFormat: string) {
    super(new TraceFormatter(messageFormat));
  }

  // implement Trace

  /**
   * @inheritDoc
   */
  trace(entry: TraceEntry): void {
    console.log(this.format(entry));
  }
}
