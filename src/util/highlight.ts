// Syntax highlighting for code tour tabs, so a source file reads the way it
// reads in a repository browser rather than as flat monospace text.
//
// The grammar is chosen per file from the card's own detected language and
// compiled on first use, so a tour of Python files never touches the Rust
// rules. That is the whole of the "dynamic" part: nothing is fetched and
// nothing is installed. Cards are self-contained documents served under a
// CSP that forbids remote scripts, and a server that reached the network -
// or ran a package manager - at render time could neither work offline nor
// be trusted with a language name a model made up.
//
// Coverage is deliberately shallow: comments, strings, numbers, keywords,
// and known type names. That is the layer that carries almost all of the
// readability, and it is the layer that cannot be got wrong in a way that
// corrupts the source. Anything without a grammar renders exactly as before.
import { escapeHtml } from "./html.js";

export interface Grammar {
  // Token that starts a comment running to end of line.
  lineComments: string[];
  // Paired block comment delimiters.
  blockComments: [string, string][];
  // Quote characters that open a string. Escapes with a backslash are
  // honored unless the language is listed in rawStrings.
  quotes: string[];
  // Triple-quoted or otherwise multi-line string delimiters, matched as
  // literal pairs before single quotes are considered.
  multilineQuotes: [string, string][];
  // Backslash does not escape inside strings (shell single quotes, SQL).
  noEscape?: boolean;
  keywords: string[];
  // Types, builtins, and constants - anything that reads as a name the
  // language knows about rather than one the author invented.
  types: string[];
}

const words = (list: string): string[] => list.split(/\s+/).filter(Boolean);

const C_BLOCK: [string, string][] = [["/*", "*/"]];

const JS_KEYWORDS =
  "as async await break case catch class const continue debugger default delete do else export " +
  "extends finally for from function get if import in instanceof let new of return set static " +
  "super switch this throw try typeof var void while with yield";
const JS_TYPES =
  "Array Boolean Date Error Function JSON Map Math Number Object Promise Proxy Reflect RegExp Set " +
  "String Symbol WeakMap WeakSet console document globalThis module process require window " +
  "true false null undefined NaN Infinity";
const TS_EXTRA =
  "abstract any asserts bigint boolean declare enum implements infer interface is keyof namespace " +
  "never number object override private protected public readonly satisfies string symbol type " +
  "unique unknown";

const PY_KEYWORDS =
  "and as assert async await break class continue def del elif else except finally for from global " +
  "if import in is lambda nonlocal not or pass raise return try while with yield match case";
const PY_TYPES =
  "True False None self cls bool bytes dict float int list object set str tuple print len range " +
  "enumerate zip open super isinstance Exception ValueError TypeError";

const RUST_KEYWORDS =
  "as async await break const continue crate dyn else enum extern fn for if impl in let loop match " +
  "mod move mut pub ref return self Self static struct super trait type unsafe use where while";
const RUST_TYPES =
  "bool char f32 f64 i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize str String Vec Option " +
  "Result Some None Ok Err Box Rc Arc HashMap true false";

const GO_KEYWORDS =
  "break case chan const continue default defer else fallthrough for func go goto if import " +
  "interface map package range return select struct switch type var";
const GO_TYPES =
  "bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string " +
  "uint uint8 uint16 uint32 uint64 uintptr any make new len cap append copy delete panic recover " +
  "nil true false iota";

const JAVA_KEYWORDS =
  "abstract assert break case catch class const continue default do else enum extends final " +
  "finally for goto if implements import instanceof interface native new package private " +
  "protected public return static strictfp super switch synchronized this throw throws transient " +
  "try var void volatile while yield record sealed permits";
const JAVA_TYPES =
  "boolean byte char double float int long short String Object Integer Double Boolean List Map " +
  "Set ArrayList HashMap Optional Stream System true false null";

const C_KEYWORDS =
  "alignas alignof auto break case catch class const constexpr continue default delete do else " +
  "enum explicit extern false for friend goto if inline namespace new noexcept nullptr operator " +
  "private protected public register return sizeof static struct switch template this throw true " +
  "try typedef typename union unsigned using virtual volatile while";
const C_TYPES =
  "bool char double float int long short signed size_t std string vector map unique_ptr " +
  "shared_ptr uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t void NULL";

const CS_KEYWORDS =
  "abstract as async await base break case catch checked class const continue default delegate do " +
  "else enum event explicit extern finally fixed for foreach get goto if implicit in interface " +
  "internal is lock namespace new operator out override params private protected public readonly " +
  "record ref return sealed set sizeof stackalloc static struct switch this throw try typeof " +
  "unchecked unsafe using var virtual void volatile where while yield";
const CS_TYPES =
  "bool byte char decimal double float int long object sbyte short string uint ulong ushort " +
  "Console List Dictionary Task IEnumerable Nullable true false null";

const SHELL_KEYWORDS =
  "if then elif else fi for while until do done case esac function in select time coproc return " +
  "break continue local export readonly declare typeset unset shift trap exit source eval exec set";
const SHELL_TYPES =
  "echo printf cd pwd ls cat grep sed awk cut sort uniq head tail wc find xargs test read mkdir " +
  "rm mv cp chmod curl git npm node python true false";

const SQL_KEYWORDS =
  "add all alter and as asc between by case cast check column constraint create cross default " +
  "delete desc distinct drop else end exists foreign from full group having if in index inner " +
  "insert into is join key left like limit not null offset on or order outer primary references " +
  "right select set table then union unique update using values view when where with";
const SQL_TYPES =
  "bigint boolean bytea char date decimal double float int integer json jsonb numeric real serial " +
  "smallint text time timestamp uuid varchar count sum avg min max coalesce now true false";

const RUBY_KEYWORDS =
  "alias and begin break case class def defined do else elsif end ensure false for if in module " +
  "next nil not or redo rescue retry return self super then true undef unless until when while yield";
const RUBY_TYPES =
  "Array Hash String Symbol Integer Float Range Struct Proc Comparable Enumerable attr_accessor " +
  "attr_reader attr_writer require require_relative puts print raise new";

const PHP_KEYWORDS =
  "abstract and array as break callable case catch class clone const continue declare default do " +
  "echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum extends final " +
  "finally fn for foreach function global goto if implements include include_once instanceof " +
  "insteadof interface isset list match namespace new or print private protected public readonly " +
  "require require_once return static switch throw trait try unset use var while xor yield";
const PHP_TYPES =
  "bool float int iterable mixed null object string void self parent true false " +
  "array_map array_filter count strlen implode explode json_encode json_decode";

const CSS_KEYWORDS =
  "and charset else font-face import keyframes media namespace not only or supports from to";
const CSS_TYPES =
  "absolute auto block center fixed flex grid hidden inherit initial inline inline-block none " +
  "relative solid static transparent unset var rgb rgba hsl calc";

const YAML_KEYWORDS = "true false null yes no on off";
const YAML_TYPES = "";

const JSON_KEYWORDS = "true false null";
const JSON_TYPES = "";

// Word lists are written as space-separated strings because that is how they
// stay readable; the grammar holds them split.
interface GrammarSpec extends Omit<Partial<Grammar>, "keywords" | "types"> {
  keywords: string;
  types: string;
}

function grammar(spec: GrammarSpec): Grammar {
  return {
    lineComments: spec.lineComments ?? ["//"],
    blockComments: spec.blockComments ?? C_BLOCK,
    quotes: spec.quotes ?? ['"', "'", "`"],
    multilineQuotes: spec.multilineQuotes ?? [],
    noEscape: spec.noEscape,
    keywords: words(spec.keywords),
    types: words(spec.types),
  };
}

// Language name -> grammar. Names match util/files.ts languageForFile output,
// plus the aliases a model is likely to pass by hand.
const GRAMMARS: Record<string, () => Grammar> = {
  javascript: () => grammar({ keywords: JS_KEYWORDS, types: JS_TYPES }),
  typescript: () => grammar({ keywords: `${JS_KEYWORDS} ${TS_EXTRA}`, types: JS_TYPES }),
  jsx: () => grammar({ keywords: JS_KEYWORDS, types: JS_TYPES }),
  tsx: () => grammar({ keywords: `${JS_KEYWORDS} ${TS_EXTRA}`, types: JS_TYPES }),
  python: () =>
    grammar({
      keywords: PY_KEYWORDS,
      types: PY_TYPES,
      lineComments: ["#"],
      blockComments: [],
      quotes: ['"', "'"],
      multilineQuotes: [['"""', '"""'], ["'''", "'''"]],
    }),
  rust: () => grammar({ keywords: RUST_KEYWORDS, types: RUST_TYPES, quotes: ['"'] }),
  go: () => grammar({ keywords: GO_KEYWORDS, types: GO_TYPES }),
  java: () => grammar({ keywords: JAVA_KEYWORDS, types: JAVA_TYPES, quotes: ['"', "'"] }),
  c: () => grammar({ keywords: C_KEYWORDS, types: C_TYPES, quotes: ['"', "'"] }),
  cpp: () => grammar({ keywords: C_KEYWORDS, types: C_TYPES, quotes: ['"', "'"] }),
  csharp: () => grammar({ keywords: CS_KEYWORDS, types: CS_TYPES, quotes: ['"', "'"] }),
  php: () => grammar({ keywords: PHP_KEYWORDS, types: PHP_TYPES, lineComments: ["//", "#"] }),
  ruby: () =>
    grammar({
      keywords: RUBY_KEYWORDS,
      types: RUBY_TYPES,
      lineComments: ["#"],
      blockComments: [],
      quotes: ['"', "'"],
    }),
  shell: () =>
    grammar({
      keywords: SHELL_KEYWORDS,
      types: SHELL_TYPES,
      lineComments: ["#"],
      blockComments: [],
      quotes: ['"', "'"],
    }),
  sql: () =>
    grammar({
      keywords: SQL_KEYWORDS,
      types: SQL_TYPES,
      lineComments: ["--"],
      quotes: ["'", '"'],
      noEscape: true,
    }),
  css: () => grammar({ keywords: CSS_KEYWORDS, types: CSS_TYPES, lineComments: [], quotes: ['"', "'"] }),
  json: () =>
    grammar({
      keywords: JSON_KEYWORDS,
      types: JSON_TYPES,
      lineComments: [],
      blockComments: [],
      quotes: ['"'],
    }),
  yaml: () =>
    grammar({
      keywords: YAML_KEYWORDS,
      types: YAML_TYPES,
      lineComments: ["#"],
      blockComments: [],
      quotes: ['"', "'"],
    }),
  toml: () =>
    grammar({
      keywords: "true false",
      types: "",
      lineComments: ["#"],
      blockComments: [],
      quotes: ['"', "'"],
    }),
};

const ALIASES: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  node: "javascript",
  "node.js": "javascript",
  nodejs: "javascript",
  ts: "typescript",
  py: "python",
  rs: "rust",
  golang: "go",
  "c++": "cpp",
  cc: "cpp",
  h: "c",
  hpp: "cpp",
  "c#": "csharp",
  cs: "csharp",
  rb: "ruby",
  bash: "shell",
  sh: "shell",
  zsh: "shell",
  yml: "yaml",
  postgres: "sql",
  postgresql: "sql",
  mysql: "sql",
  sqlite: "sql",
};

// Compiled grammars are cached: a tour of twenty JavaScript files builds the
// keyword sets once, and a language nobody passed is never built at all.
const compiled = new Map<string, Grammar | null>();

export function canonicalLanguage(language: string | undefined): string {
  const name = (language ?? "").trim().toLowerCase();
  return ALIASES[name] ?? name;
}

export function grammarFor(language: string | undefined): Grammar | null {
  const name = canonicalLanguage(language);
  if (compiled.has(name)) return compiled.get(name) ?? null;
  const factory = GRAMMARS[name];
  const built = factory ? factory() : null;
  compiled.set(name, built);
  return built;
}

export function isHighlightable(language: string | undefined): boolean {
  return grammarFor(language) !== null;
}

// Every language this build can highlight, for tool descriptions and tests.
export function highlightableLanguages(): string[] {
  return Object.keys(GRAMMARS).sort();
}

const TOKEN_CLASS = {
  comment: "mcc-t-c",
  string: "mcc-t-s",
  number: "mcc-t-n",
  keyword: "mcc-t-k",
  type: "mcc-t-y",
} as const;

function span(kind: keyof typeof TOKEN_CLASS, text: string): string {
  return `<span class="${TOKEN_CLASS[kind]}">${escapeHtml(text)}</span>`;
}

const IDENT_START = /[A-Za-z_$]/;
const IDENT_PART = /[A-Za-z0-9_$]/;
const DIGIT = /[0-9]/;

// A single left-to-right scan over the SOURCE, never over markup: each token
// is escaped as it is emitted, so no pass can double-escape and no source
// text can close a tag it is sitting inside.
export function highlightCode(code: string, language: string | undefined): string {
  const rules = grammarFor(language);
  if (!rules) return escapeHtml(code);

  const keywords = new Set(rules.keywords);
  const types = new Set(rules.types);
  const out: string[] = [];
  let plain = "";
  const flush = (): void => {
    if (plain.length > 0) {
      out.push(escapeHtml(plain));
      plain = "";
    }
  };

  let i = 0;
  const n = code.length;
  while (i < n) {
    const rest = code.slice(i);

    // Comments run to end of line; block comments to their closing pair, or
    // to end of file when the author left one open.
    const line = rules.lineComments.find((token) => rest.startsWith(token));
    if (line) {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      flush();
      out.push(span("comment", code.slice(i, stop)));
      i = stop;
      continue;
    }
    const block = rules.blockComments.find(([open]) => rest.startsWith(open));
    if (block) {
      const close = code.indexOf(block[1], i + block[0].length);
      const stop = close === -1 ? n : close + block[1].length;
      flush();
      out.push(span("comment", code.slice(i, stop)));
      i = stop;
      continue;
    }

    const multi = rules.multilineQuotes.find(([open]) => rest.startsWith(open));
    if (multi) {
      const close = code.indexOf(multi[1], i + multi[0].length);
      const stop = close === -1 ? n : close + multi[1].length;
      flush();
      out.push(span("string", code.slice(i, stop)));
      i = stop;
      continue;
    }

    const quote = rules.quotes.find((q) => rest.startsWith(q));
    if (quote) {
      let j = i + quote.length;
      while (j < n) {
        if (!rules.noEscape && code[j] === "\\") {
          j += 2;
          continue;
        }
        if (code.startsWith(quote, j)) {
          j += quote.length;
          break;
        }
        // An unterminated single-quoted string ends at the line break rather
        // than swallowing the rest of the file.
        if (code[j] === "\n" && quote !== "`") {
          break;
        }
        j += 1;
      }
      flush();
      out.push(span("string", code.slice(i, Math.min(j, n))));
      i = Math.min(j, n);
      continue;
    }

    const char = code[i];
    if (DIGIT.test(char) && !(i > 0 && IDENT_PART.test(code[i - 1]))) {
      let j = i;
      while (j < n && /[0-9a-fA-FxXoObB._]/.test(code[j])) j += 1;
      flush();
      out.push(span("number", code.slice(i, j)));
      i = j;
      continue;
    }

    if (IDENT_START.test(char)) {
      let j = i;
      while (j < n && IDENT_PART.test(code[j])) j += 1;
      const word = code.slice(i, j);
      if (keywords.has(word)) {
        flush();
        out.push(span("keyword", word));
      } else if (types.has(word)) {
        flush();
        out.push(span("type", word));
      } else {
        plain += word;
      }
      i = j;
      continue;
    }

    plain += char;
    i += 1;
  }
  flush();
  return out.join("");
}
