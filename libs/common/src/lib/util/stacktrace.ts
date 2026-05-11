/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { catchError, forkJoin, lastValueFrom, map, Observable, of, shareReplay, switchMap, tap } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { SourceMapConsumer } from 'source-map-js';

const UNKNOWN_FUNCTION = '<unknown>';

export interface StackFrame {
  file: string | null;
  methodName: string | null;
  arguments: any[] | null;
  lineNumber: number | null;
  column: number | null;
}

// parser interfaces

interface Parser {
  parse(line: string): StackFrame | null;
}

// ---------------- Chrome Parser ----------------
class ChromeParser implements Parser {
  chromeRe =
    /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/|[a-z]:\\|\\\\).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;
  chromeEvalRe = /\((\S*)(?::(\d+))(?::(\d+))\)/;

  parse(line: string): StackFrame | null {
    const parts = this.chromeRe.exec(line);
    if (!parts) return null;

    const isNative = parts[2] && parts[2].startsWith('native');
    const isEval = parts[2] && parts[2].startsWith('eval');

    const submatch = this.chromeEvalRe.exec(parts[2]);
    if (isEval && submatch) {
      parts[2] = submatch[1];
      parts[3] = submatch[2];
      parts[4] = submatch[3];
    }

    return {
      file: !isNative ? parts[2] : null,
      methodName: parts[1] || UNKNOWN_FUNCTION,
      arguments: isNative ? [parts[2]] : [],
      lineNumber: parts[3] ? +parts[3] : null,
      column: parts[4] ? +parts[4] : null,
    };
  }
}

// ---------------- Gecko Parser ----------------
class GeckoParser implements Parser {
  geckoRe =
    /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?|[^@]*bundle)(?::(\d+))?(?::(\d+))?\s*$/i;
  geckoEvalRe = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i;

  parse(line: string): StackFrame | null {
    const parts = this.geckoRe.exec(line);
    if (!parts) return null;

    const isEval = parts[3] && parts[3].includes(' > eval');
    const submatch = this.geckoEvalRe.exec(parts[3]);
    if (isEval && submatch) {
      parts[3] = submatch[1];
      parts[4] = submatch[2];
      parts[5] = ''; // no column for eval
    }

    return {
      file: parts[3],
      methodName: parts[1] || UNKNOWN_FUNCTION,
      arguments: parts[2] ? parts[2].split(',') : [],
      lineNumber: parts[4] ? +parts[4] : null,
      column: parts[5] ? +parts[5] : null,
    };
  }
}

// ---------------- Determine parser ----------------
function determineParser(): Parser {
  if (typeof navigator === 'undefined') return new ChromeParser(); // Node: use ChromeParser
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('chrome')) return new ChromeParser();
  if (ua.includes('gecko')) return new GeckoParser();
  return { parse: () => null };
}

// ---------------- Cross-environment helpers ----------------

/**
 * Decodes a base64 string in both browser (atob) and Node (Buffer).
 */
export function decodeBase64(encoded: string): string {
  if (typeof globalThis.atob === 'function') {
    return new TextDecoder().decode(
      Uint8Array.from(globalThis.atob(encoded), c => c.charCodeAt(0))
    );
  }
  throw new Error('Base64 decoding is not supported in this environment');
}

/**
 * Returns an Observable that fetches a URL as a Response, working in both
 * environments. In Node 18+ the global fetch is available; for older Node
 * versions jest tests typically mock fetch or use `jest-fetch-mock` /
 * `whatwg-fetch`. We fall back to fromFetch (which itself wraps fetch) so
 * there is a single code path — just ensure fetch is globally available in
 * your Jest setup (e.g. `global.fetch = require('node-fetch')`).
 */
function fetchObs(url: string): Observable<Response> {
  // fromFetch lazily calls fetch; as long as fetch is globally present at
  // call time this works in Node 18+ and in browsers.
  return fromFetch(url);
}

// ---------------- Stacktrace Class ----------------
export class Stacktrace {
  static parser = determineParser();
  static consumer: { [file: string]: SourceMapConsumer } = {};
  static loading: { [uri: string]: Observable<SourceMapConsumer> } = {};

  static createFrames(stack: string): StackFrame[] {
    return stack.split('\n').reduce<StackFrame[]>((acc, line) => {
      const frame = this.parser.parse(line);
      if (frame) acc.push(frame);
      return acc;
    }, []);
  }

  static async mapFrames(...frames: StackFrame[]): Promise<StackFrame[]> {
    const files: Record<string, boolean> = {};
    for (const f of frames) if (f.file && f.file.includes(':')) files[f.file] = true;

    const missing = Object.keys(files).filter((f) => !this.consumer[f]);
    if (missing.length > 0) {
      await lastValueFrom(forkJoin(missing.map((uri) => this.loadSourcemap(uri))));
    }

    for (const f of frames) {
      if (f.file && f.lineNumber && this.consumer[f.file]) {
        const pos = this.consumer[f.file].originalPositionFor({
          line: f.lineNumber!,
          column: f.column!,
        });
        f.file = pos.source;
        f.lineNumber = pos.line;
        f.column = pos.column;
      }
    }

    return frames;
  }

  // ---------------- Browser-friendly source map loader ----------------
  private static loadSourcemap(uri: string): Observable<SourceMapConsumer> {
    if (this.loading[uri]) return this.loading[uri];
    const uriQuery = new URL(uri).search;

    const request = fetchObs(uri).pipe(
      switchMap((res) => (res.ok ? res.text() : of(''))),
      switchMap((script) => {
        if (!script) return of({});

        // inline source map
        const inline = /\/\/# sourceMappingURL=data:application\/json;base64,(.*)/.exec(script);
        if (inline) {
          try {
            const map = JSON.parse(decodeBase64(inline[1])); // ← was atob()
            return of(map);
          } catch (e) {
            console.error('Failed to parse inline source map', e);
            return of({});
          }
        }

        // external source map
        //const external = /\/\/# sourceMappingURL=(.*)/.exec(script);

        const allMatches = [...script.matchAll(/\/\/# sourceMappingURL=(.*)/g)];
        const external = allMatches.length > 0 ? allMatches[allMatches.length - 1] : null;

        if (!external) return of({});
        const mapUri = new URL(external[1], uri).href + uriQuery;
        return fetchObs(mapUri).pipe(
          switchMap((res) => (res.ok ? res.json() : of({})))
        );
      }),
      map((sourceMap) => new SourceMapConsumer(sourceMap)),
      tap((consumer) => (this.consumer[uri] = consumer)),
      catchError((err) => {
        console.error('Failed to load source map for', uri, err);
        return of(new SourceMapConsumer({ version: "3", sources: [], names: [], mappings: '' }));
      }),
      shareReplay(1)
    );

    return (this.loading[uri] = request);
  }
}