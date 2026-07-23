import {
  autocompletion,
  completeAnyWord,
  completeFromList,
  snippetCompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { javaLanguage } from "@codemirror/lang-java";
import {
  javascriptLanguage,
  localCompletionSource as jsLocalCompletion,
  scopeCompletionSource,
  snippets as jsKeywordSnippets,
} from "@codemirror/lang-javascript";
import { pythonLanguage } from "@codemirror/lang-python";
import type { Extension } from "@codemirror/state";

import type { SupportedLanguage } from "@/server/execute/types";

/**
 * IntelliJ-style completion for the online editor.
 *
 *  - "basic": identifiers already in the document + language keywords
 *    (IntelliJ's Basic Completion / Ctrl+Space).
 *  - "smart": basic + live templates (sout, psvm, fori…), common stdlib
 *    symbols/members and scope-aware sources (IntelliJ's Smart Completion).
 *  - "off":   no popup at all.
 *
 * Everything is wired through CodeMirror's languageData so sources only fire
 * for their own language.
 */

export type CompletionMode = "off" | "basic" | "smart";

// ---------------------------------------------------------------------------
// Generic helpers

function keywordList(words: string[], boost = 0): Completion[] {
  return words.map((label) => ({ label, type: "keyword", boost }));
}

function typeList(words: string[]): Completion[] {
  return words.map((label) => ({ label, type: "class", boost: 1 }));
}

/** Completions offered right after a `.` — curated common member names. */
function memberSource(members: Completion[]): CompletionSource {
  return (context) => {
    const match = context.matchBefore(/\.[A-Za-z_$]*$/);
    if (!match) return null;
    return { from: match.from + 1, options: members, validFor: /^[\w$]*$/ };
  };
}

function methodList(names: string[]): Completion[] {
  return names.map((n) => ({
    label: n.endsWith("()") ? n.slice(0, -2) : n,
    apply: n.endsWith("()") ? `${n.slice(0, -2)}()` : n,
    detail: n.endsWith("()") ? "method" : "field",
    type: n.endsWith("()") ? "method" : "property",
  }));
}

// ---------------------------------------------------------------------------
// Java

const JAVA_KEYWORDS = [
  "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
  "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally",
  "float", "for", "if", "implements", "import", "instanceof", "int", "interface", "long",
  "native", "new", "package", "private", "protected", "public", "record", "return",
  "sealed", "short", "static", "super", "switch", "synchronized", "this", "throw",
  "throws", "transient", "try", "var", "void", "volatile", "while", "yield",
  "true", "false", "null",
];

const JAVA_TYPES = [
  // java.lang
  "String", "CharSequence", "System", "Math", "Object", "Objects", "Integer", "Long",
  "Double", "Boolean", "Character", "Byte", "Short", "Float", "Number", "StringBuilder",
  "StringBuffer", "Iterable", "Comparable", "Runnable", "Thread", "Enum", "Class",
  "Throwable", "Exception", "RuntimeException", "Error", "IllegalArgumentException",
  "IllegalStateException", "NullPointerException", "IndexOutOfBoundsException",
  "ArithmeticException", "NumberFormatException", "UnsupportedOperationException",
  "ClassCastException", "InterruptedException", "StackOverflowError", "OutOfMemoryError",
  // java.util
  "Scanner", "ArrayList", "LinkedList", "ArrayDeque", "PriorityQueue", "Stack",
  "List", "Map", "HashMap", "LinkedHashMap", "TreeMap", "Set", "HashSet",
  "LinkedHashSet", "TreeSet", "Deque", "Queue", "Collection", "Iterator",
  "ListIterator", "Arrays", "Collections", "Optional", "OptionalInt", "OptionalLong",
  "OptionalDouble", "Comparator", "Random", "UUID", "StringJoiner", "BitSet",
  "ConcurrentModificationException", "NoSuchElementException",
  // java.util.stream & function
  "Stream", "IntStream", "LongStream", "DoubleStream", "Collectors",
  "Function", "BiFunction", "Supplier", "Consumer", "BiConsumer", "Predicate",
  "BiPredicate", "UnaryOperator", "BinaryOperator",
  // java.util.regex, math, text
  "Pattern", "Matcher", "BigDecimal", "BigInteger", "MathContext", "RoundingMode",
  // java.time
  "LocalDate", "LocalDateTime", "LocalTime", "Instant", "Duration", "Period",
  "ZonedDateTime", "ZoneId", "DateTimeFormatter", "ChronoUnit", "DayOfWeek", "Month",
  // java.io / java.nio
  "Files", "Path", "Paths", "StandardCharsets", "BufferedReader", "BufferedWriter",
  "InputStreamReader", "OutputStreamWriter", "FileReader", "FileWriter",
  "PrintStream", "PrintWriter", "InputStream", "OutputStream", "IOException",
  "UncheckedIOException", "FileNotFoundException",
  // java.util.concurrent
  "Callable", "Executors", "ExecutorService", "CompletableFuture", "Future",
  "TimeUnit", "ThreadLocalRandom", "CountDownLatch", "ConcurrentHashMap",
  "AtomicInteger", "AtomicLong", "AtomicBoolean", "AtomicReference",
];

/** Build member Completions; a trailing `()` marks a method, ALL_CAPS a constant. */
function javaMembers(owner: string, names: string[], boost = 0): Completion[] {
  return names.map((n) => {
    const isMethod = n.endsWith("()");
    const label = isMethod ? n.slice(0, -2) : n;
    return {
      label,
      apply: isMethod ? `${label}()` : label,
      detail: owner,
      type: isMethod ? "method" : /^[A-Z][A-Z_0-9]*$/.test(label) ? "constant" : "property",
      boost,
    };
  });
}

/**
 * Static members per JDK class — served when the receiver before the dot is a
 * known class name (`Math.`, `Collectors.`, `System.out.`…), like IntelliJ.
 */
const JAVA_STATIC_MEMBERS: Record<string, string[]> = {
  System: [
    "out", "err", "in", "currentTimeMillis()", "nanoTime()", "arraycopy()", "exit()",
    "getenv()", "getProperty()", "setProperty()", "lineSeparator()", "identityHashCode()",
  ],
  "System.out": ["println()", "print()", "printf()", "format()", "append()", "flush()", "write()"],
  "System.err": ["println()", "print()", "printf()", "format()", "append()", "flush()", "write()"],
  Math: [
    "PI", "E", "abs()", "max()", "min()", "pow()", "sqrt()", "cbrt()", "floor()", "ceil()",
    "round()", "random()", "log()", "log10()", "exp()", "sin()", "cos()", "tan()", "asin()",
    "acos()", "atan()", "atan2()", "sinh()", "cosh()", "tanh()", "hypot()", "signum()",
    "toRadians()", "toDegrees()", "floorDiv()", "floorMod()", "addExact()", "subtractExact()",
    "multiplyExact()", "negateExact()", "toIntExact()", "clamp()", "fma()",
  ],
  String: ["valueOf()", "format()", "join()", "copyValueOf()", "CASE_INSENSITIVE_ORDER"],
  Integer: [
    "MAX_VALUE", "MIN_VALUE", "SIZE", "BYTES", "parseInt()", "parseUnsignedInt()",
    "toUnsignedString()", "valueOf()",
    "toString()", "toBinaryString()", "toOctalString()", "toHexString()", "compare()", "max()",
    "min()", "sum()", "signum()", "bitCount()", "reverse()", "highestOneBit()", "lowestOneBit()",
    "numberOfLeadingZeros()", "numberOfTrailingZeros()",
  ],
  Long: [
    "MAX_VALUE", "MIN_VALUE", "parseLong()", "valueOf()", "toString()", "toBinaryString()",
    "toHexString()", "compare()", "max()", "min()", "sum()", "bitCount()", "signum()",
  ],
  Double: [
    "MAX_VALUE", "MIN_VALUE", "POSITIVE_INFINITY", "NEGATIVE_INFINITY", "NaN",
    "parseDouble()", "valueOf()", "toString()", "compare()", "max()", "min()", "sum()",
    "isNaN()", "isInfinite()", "isFinite()",
  ],
  Float: [
    "MAX_VALUE", "MIN_VALUE", "NaN", "POSITIVE_INFINITY", "NEGATIVE_INFINITY",
    "parseFloat()", "valueOf()", "compare()", "isNaN()",
  ],
  Boolean: ["TRUE", "FALSE", "parseBoolean()", "valueOf()", "toString()", "logicalAnd()", "logicalOr()", "logicalXor()"],
  Character: [
    "MAX_VALUE", "MIN_VALUE", "isDigit()", "isLetter()", "isLetterOrDigit()", "isWhitespace()",
    "isUpperCase()", "isLowerCase()", "isAlphabetic()", "toUpperCase()", "toLowerCase()",
    "getNumericValue()", "valueOf()", "compare()",
  ],
  Byte: ["MAX_VALUE", "MIN_VALUE", "parseByte()", "valueOf()"],
  Short: ["MAX_VALUE", "MIN_VALUE", "parseShort()", "valueOf()"],
  Objects: [
    "equals()", "deepEquals()", "hash()", "hashCode()", "toString()", "isNull()", "nonNull()",
    "requireNonNull()", "requireNonNullElse()", "requireNonNullElseGet()", "checkIndex()",
  ],
  Arrays: [
    "asList()", "sort()", "parallelSort()", "binarySearch()", "fill()", "copyOf()",
    "copyOfRange()", "equals()", "deepEquals()", "toString()", "deepToString()", "stream()",
    "setAll()", "hashCode()", "deepHashCode()", "compare()", "mismatch()",
  ],
  Collections: [
    "sort()", "reverse()", "shuffle()", "swap()", "max()", "min()", "frequency()", "disjoint()",
    "binarySearch()", "fill()", "nCopies()", "rotate()", "addAll()", "emptyList()", "emptySet()",
    "emptyMap()", "singletonList()", "singleton()", "singletonMap()", "unmodifiableList()",
    "unmodifiableSet()", "unmodifiableMap()", "synchronizedList()", "synchronizedMap()",
    "reverseOrder()",
  ],
  List: ["of()", "copyOf()"],
  Set: ["of()", "copyOf()"],
  Map: ["of()", "ofEntries()", "entry()", "copyOf()"],
  Stream: ["of()", "empty()", "iterate()", "generate()", "concat()", "ofNullable()"],
  IntStream: ["range()", "rangeClosed()", "of()", "iterate()", "generate()", "concat()", "empty()"],
  LongStream: ["range()", "rangeClosed()", "of()", "iterate()", "generate()", "concat()", "empty()"],
  DoubleStream: ["of()", "iterate()", "generate()", "concat()", "empty()"],
  Collectors: [
    "toList()", "toUnmodifiableList()", "toSet()", "toUnmodifiableSet()", "toMap()",
    "toUnmodifiableMap()", "toCollection()", "joining()", "counting()", "groupingBy()",
    "partitioningBy()", "mapping()", "filtering()", "flatMapping()", "reducing()",
    "summingInt()", "summingLong()", "summingDouble()", "averagingInt()", "averagingLong()",
    "averagingDouble()", "summarizingInt()", "summarizingLong()", "summarizingDouble()",
    "minBy()", "maxBy()",
    "collectingAndThen()", "teeing()",
  ],
  Optional: ["of()", "ofNullable()", "empty()"],
  Comparator: [
    "comparing()", "comparingInt()", "comparingLong()", "comparingDouble()",
    "naturalOrder()", "reverseOrder()", "nullsFirst()", "nullsLast()",
  ],
  LocalDate: ["now()", "of()", "parse()", "ofEpochDay()", "ofYearDay()", "EPOCH", "MIN", "MAX"],
  LocalDateTime: ["now()", "of()", "parse()", "ofInstant()", "ofEpochSecond()", "MIN", "MAX"],
  LocalTime: ["now()", "of()", "parse()", "MIDNIGHT", "NOON", "MIN", "MAX"],
  Instant: ["now()", "parse()", "ofEpochMilli()", "ofEpochSecond()", "EPOCH", "MIN", "MAX"],
  Duration: [
    "of()", "ofDays()", "ofHours()", "ofMinutes()", "ofSeconds()", "ofMillis()", "ofNanos()",
    "between()", "parse()", "ZERO",
  ],
  Period: ["of()", "ofDays()", "ofMonths()", "ofYears()", "ofWeeks()", "between()", "parse()", "ZERO"],
  ZonedDateTime: ["now()", "of()", "parse()", "ofInstant()"],
  ZoneId: ["of()", "systemDefault()", "getAvailableZoneIds()"],
  DateTimeFormatter: [
    "ofPattern()", "ISO_DATE", "ISO_DATE_TIME", "ISO_LOCAL_DATE", "ISO_LOCAL_DATE_TIME",
    "ISO_LOCAL_TIME", "ISO_INSTANT", "ISO_OFFSET_DATE_TIME", "ISO_ZONED_DATE_TIME",
    "BASIC_ISO_DATE", "RFC_1123_DATE_TIME",
  ],
  ChronoUnit: [
    "NANOS", "MICROS", "MILLIS", "SECONDS", "MINUTES", "HOURS", "HALF_DAYS", "DAYS",
    "WEEKS", "MONTHS", "YEARS", "DECADES", "CENTURIES", "FOREVER",
  ],
  Files: [
    "exists()", "notExists()", "readAllLines()", "readAllBytes()", "readString()", "write()",
    "writeString()", "lines()", "list()", "walk()", "find()", "copy()", "move()", "delete()",
    "deleteIfExists()", "createFile()", "createDirectory()", "createDirectories()",
    "createTempFile()", "createTempDirectory()", "walkFileTree()", "newBufferedReader()",
    "newBufferedWriter()", "newInputStream()",
    "newOutputStream()", "size()", "isDirectory()", "isRegularFile()", "isReadable()",
    "isWritable()", "getLastModifiedTime()",
  ],
  Path: ["of()"],
  Paths: ["get()"],
  Pattern: ["compile()", "matches()", "quote()", "CASE_INSENSITIVE", "MULTILINE", "DOTALL", "UNICODE_CASE"],
  UUID: ["randomUUID()", "fromString()", "nameUUIDFromBytes()"],
  ThreadLocalRandom: ["current()"],
  BigDecimal: ["ZERO", "ONE", "TEN", "valueOf()"],
  BigInteger: ["ZERO", "ONE", "TWO", "TEN", "valueOf()", "probablePrime()"],
  Thread: [
    "sleep()", "currentThread()", "interrupted()", "yield()", "ofVirtual()", "ofPlatform()",
    "startVirtualThread()", "onSpinWait()", "MAX_PRIORITY", "MIN_PRIORITY", "NORM_PRIORITY",
  ],
  Executors: [
    "newFixedThreadPool()", "newCachedThreadPool()", "newSingleThreadExecutor()",
    "newScheduledThreadPool()", "newWorkStealingPool()", "newVirtualThreadPerTaskExecutor()",
  ],
  CompletableFuture: [
    "completedFuture()", "supplyAsync()", "runAsync()", "allOf()", "anyOf()", "failedFuture()",
  ],
  TimeUnit: ["NANOSECONDS", "MICROSECONDS", "MILLISECONDS", "SECONDS", "MINUTES", "HOURS", "DAYS"],
  StandardCharsets: ["UTF_8", "US_ASCII", "ISO_8859_1", "UTF_16", "UTF_16BE", "UTF_16LE"],
  Function: ["identity()"],
  Predicate: ["isEqual()", "not()"],
  UnaryOperator: ["identity()"],
  RoundingMode: ["HALF_UP", "HALF_DOWN", "HALF_EVEN", "UP", "DOWN", "CEILING", "FLOOR", "UNNECESSARY"],
};

/**
 * Instance members by API family — served when the receiver is a variable or a
 * call chain, deduplicated by label (first family wins the `detail` tag).
 */
const JAVA_INSTANCE_GROUPS: Array<[owner: string, names: string[]]> = [
  ["String", [
    "length()", "isEmpty()", "isBlank()", "charAt()", "substring()", "indexOf()",
    "lastIndexOf()", "contains()", "startsWith()", "endsWith()", "equals()",
    "equalsIgnoreCase()", "compareTo()", "compareToIgnoreCase()", "matches()", "replace()",
    "replaceAll()", "replaceFirst()", "split()", "trim()", "strip()", "stripLeading()",
    "stripTrailing()", "toLowerCase()", "toUpperCase()", "concat()", "repeat()", "lines()",
    "chars()", "toCharArray()", "getBytes()", "formatted()", "indent()", "intern()", "hashCode()",
  ]],
  ["List", [
    "add()", "addAll()", "addFirst()", "addLast()", "get()", "getFirst()", "getLast()",
    "set()", "remove()", "removeIf()", "removeAll()", "retainAll()", "clear()",
    "containsAll()", "size()", "sort()", "subList()", "toArray()", "iterator()", "forEach()",
    "stream()", "parallelStream()", "reversed()",
  ]],
  ["Map", [
    "put()", "putAll()", "putIfAbsent()", "getOrDefault()", "merge()", "compute()",
    "computeIfAbsent()", "computeIfPresent()", "containsKey()", "containsValue()",
    "keySet()", "values()", "entrySet()",
  ]],
  ["Map.Entry", ["getKey()", "getValue()", "setValue()"]],
  ["Deque", [
    "push()", "pop()", "poll()", "peek()", "offer()", "element()", "pollFirst()",
    "pollLast()", "peekFirst()", "peekLast()", "offerFirst()", "offerLast()",
    "removeFirst()", "removeLast()",
  ]],
  ["Stream", [
    "map()", "mapToInt()", "mapToLong()", "mapToDouble()", "mapToObj()", "filter()",
    "flatMap()", "flatMapToInt()", "flatMapToLong()", "flatMapToDouble()", "distinct()",
    "sorted()", "peek()", "limit()", "skip()", "takeWhile()",
    "dropWhile()", "forEachOrdered()", "collect()", "reduce()", "toList()", "count()",
    "sum()", "average()", "min()", "max()", "anyMatch()", "allMatch()", "noneMatch()",
    "findFirst()", "findAny()", "boxed()", "asLongStream()", "asDoubleStream()",
    "parallel()", "sequential()",
  ]],
  ["Optional", [
    "isPresent()", "ifPresent()", "ifPresentOrElse()", "orElse()", "orElseGet()",
    "orElseThrow()", "or()",
  ]],
  ["StringBuilder", [
    "append()", "insert()", "delete()", "deleteCharAt()", "setCharAt()", "setLength()",
    "reverse()", "capacity()", "toString()",
  ]],
  ["Scanner", [
    "next()", "nextLine()", "nextInt()", "nextLong()", "nextDouble()", "nextBoolean()",
    "nextBigDecimal()", "nextFloat()", "hasNext()", "hasNextLine()", "hasNextInt()",
    "hasNextLong()", "hasNextDouble()", "useDelimiter()", "close()",
  ]],
  ["Matcher", [
    "find()", "group()", "groupCount()", "start()", "end()", "lookingAt()", "reset()",
  ]],
  ["Pattern", ["matcher()", "pattern()", "asPredicate()", "splitAsStream()"]],
  ["Number", ["intValue()", "longValue()", "doubleValue()", "floatValue()", "byteValue()", "shortValue()"]],
  ["BigDecimal", [
    "add()", "subtract()", "multiply()", "divide()", "divideAndRemainder()", "remainder()",
    "negate()", "abs()", "pow()", "setScale()", "scale()", "precision()", "signum()",
    "stripTrailingZeros()", "toPlainString()", "toBigInteger()", "movePointLeft()",
    "movePointRight()",
  ]],
  ["java.time", [
    "plusDays()", "plusWeeks()", "plusMonths()", "plusYears()", "plusHours()",
    "plusMinutes()", "plusSeconds()", "minusDays()", "minusWeeks()", "minusMonths()",
    "minusYears()", "minusHours()", "minusMinutes()", "minusSeconds()", "getYear()",
    "getMonth()", "getMonthValue()", "getDayOfMonth()", "getDayOfWeek()", "getDayOfYear()",
    "getHour()", "getMinute()", "getSecond()", "format()", "isBefore()", "isAfter()",
    "isEqual()", "isLeapYear()", "atStartOfDay()", "atTime()", "atZone()", "withYear()",
    "withMonth()", "withDayOfMonth()", "until()", "toEpochDay()", "toLocalDate()",
    "toLocalTime()", "toLocalDateTime()", "toInstant()", "toEpochMilli()",
    "withZoneSameInstant()", "truncatedTo()", "lengthOfMonth()", "lengthOfYear()",
  ]],
  ["Duration", [
    "toDays()", "toHours()", "toMinutes()", "toSeconds()", "toMillis()", "toNanos()",
    "getSeconds()", "plus()", "minus()", "multipliedBy()", "dividedBy()", "isZero()",
    "isNegative()",
  ]],
  ["CompletableFuture", [
    "thenApply()", "thenApplyAsync()", "thenAccept()", "thenRun()", "thenCompose()",
    "thenCombine()", "exceptionally()", "handle()", "whenComplete()", "complete()",
    "completeExceptionally()", "cancel()", "isDone()", "isCancelled()", "join()",
    "getNow()", "orTimeout()", "completeOnTimeout()",
  ]],
  ["Thread", [
    "start()", "interrupt()", "isAlive()", "isInterrupted()", "setDaemon()", "setName()",
    "getName()", "setPriority()",
  ]],
  ["Random", ["nextGaussian()", "ints()", "doubles()", "longs()"]],
  ["Throwable", [
    "getMessage()", "getLocalizedMessage()", "getCause()", "getStackTrace()",
    "printStackTrace()", "initCause()", "addSuppressed()", "getSuppressed()",
  ]],
  ["Comparator", ["thenComparing()", "thenComparingInt()", "thenComparingLong()", "thenComparingDouble()"]],
  ["functional", ["apply()", "test()", "accept()", "andThen()", "compose()", "and()", "or()", "negate()"]],
  ["Iterator", ["hasNext()", "remove()", "forEachRemaining()"]],
  ["Enum", ["name()", "ordinal()", "compareTo()"]],
  ["Object", ["equals()", "getClass()", "wait()", "notify()", "notifyAll()"]],
  ["array", ["length", "clone()"]],
];

const JAVA_INSTANCE_CATALOG: Completion[] = (() => {
  const seen = new Map<string, Completion>();
  for (const [owner, names] of JAVA_INSTANCE_GROUPS) {
    for (const option of javaMembers(owner, names)) {
      if (!seen.has(option.label)) seen.set(option.label, option);
    }
  }
  return [...seen.values()];
})();

const javaStaticCompletions = new Map<string, Completion[]>();

function staticMembersOf(receiver: string): Completion[] | undefined {
  const names = JAVA_STATIC_MEMBERS[receiver];
  if (!names) return undefined;
  let cached = javaStaticCompletions.get(receiver);
  if (!cached) {
    cached = javaMembers(receiver, names, 2);
    javaStaticCompletions.set(receiver, cached);
  }
  return cached;
}

const STRING_LITERAL_MEMBERS = javaMembers("String", JAVA_INSTANCE_GROUPS[0][1], 2);

/**
 * Receiver-aware `.` completion: known class names get their static members
 * ("System.out" chains included), string literals get String members, and
 * everything else (variables, call chains) gets the instance catalog.
 */
const javaMemberSource: CompletionSource = (context) => {
  // "literal".<prefix> → String instance members
  const literal = context.matchBefore(/"\.[\w$]*$/);
  if (literal) {
    return { from: literal.from + 2, options: STRING_LITERAL_MEMBERS, validFor: /^[\w$]*$/ };
  }

  // identifier(.identifier)*.<prefix> → static members if the receiver is known
  const chain = context.matchBefore(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.[\w$]*$/);
  if (chain) {
    const lastDot = chain.text.lastIndexOf(".");
    const receiver = chain.text.slice(0, lastDot);
    const lastSegment = receiver.slice(receiver.lastIndexOf(".") + 1);
    const options =
      staticMembersOf(receiver) ?? staticMembersOf(lastSegment) ?? JAVA_INSTANCE_CATALOG;
    return { from: chain.from + lastDot + 1, options, validFor: /^[\w$]*$/ };
  }

  // any other `.` (after `)`, `]`…) → instance catalog, e.g. list.stream().<prefix>
  const dot = context.matchBefore(/\.[\w$]*$/);
  if (dot) {
    return { from: dot.from + 1, options: JAVA_INSTANCE_CATALOG, validFor: /^[\w$]*$/ };
  }
  return null;
};

/** IntelliJ live templates, same abbreviations (sout, psvm, fori, iter…). */
const JAVA_SNIPPETS: Completion[] = [
  snippetCompletion("System.out.println(${});", {
    label: "sout", detail: "System.out.println();", type: "function", boost: 3,
  }),
  snippetCompletion("System.err.println(${});", {
    label: "serr", detail: "System.err.println();", type: "function", boost: 2,
  }),
  snippetCompletion('System.out.printf("${format}"${});', {
    label: "souf", detail: "System.out.printf();", type: "function", boost: 2,
  }),
  snippetCompletion("public static void main(String[] args) {\n\t${}\n}", {
    label: "psvm", detail: "main() method", type: "function", boost: 3,
  }),
  snippetCompletion("public static void main(String[] args) {\n\t${}\n}", {
    label: "main", detail: "main() method", type: "function", boost: 2,
  }),
  snippetCompletion("for (int ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}", {
    label: "fori", detail: "indexed for loop", type: "keyword", boost: 2,
  }),
  snippetCompletion("for (${Type} ${item} : ${collection}) {\n\t${}\n}", {
    label: "iter", detail: "for-each loop", type: "keyword", boost: 2,
  }),
  snippetCompletion("if (${expr} == null) {\n\t${}\n}", {
    label: "ifn", detail: "if null", type: "keyword",
  }),
  snippetCompletion("if (${expr} != null) {\n\t${}\n}", {
    label: "inn", detail: "if not null", type: "keyword",
  }),
  snippetCompletion("try {\n\t${}\n} catch (${Exception} e) {\n\t${}\n}", {
    label: "try", detail: "try / catch", type: "keyword",
  }),
  snippetCompletion("while (${condition}) {\n\t${}\n}", {
    label: "wh", detail: "while loop", type: "keyword",
  }),
  snippetCompletion("switch (${value}) {\n\tcase ${} -> ${};\n\tdefault -> ${};\n}", {
    label: "sw", detail: "switch expression", type: "keyword",
  }),
  snippetCompletion("private ${Type} ${name};", {
    label: "prf", detail: "private field", type: "keyword",
  }),
];

// ---------------------------------------------------------------------------
// Python

const PYTHON_KEYWORDS = [
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
  "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
  "import", "in", "is", "lambda", "match", "nonlocal", "not", "or", "pass",
  "raise", "return", "try", "while", "with", "yield", "True", "False", "None",
];

const PYTHON_BUILTINS = [
  "print", "input", "len", "range", "enumerate", "zip", "map", "filter", "sorted",
  "reversed", "sum", "min", "max", "abs", "round", "int", "float", "str", "bool",
  "list", "tuple", "dict", "set", "frozenset", "type", "isinstance", "issubclass",
  "open", "repr", "format", "hash", "id", "iter", "next", "super", "any", "all",
  "divmod", "pow", "ord", "chr", "hex", "oct", "bin",
];

const PYTHON_MEMBERS = methodList([
  "append()", "extend()", "insert()", "remove()", "pop()", "clear()", "index()",
  "count()", "sort()", "reverse()", "copy()", "keys()", "values()", "items()",
  "get()", "update()", "setdefault()", "add()", "discard()", "union()",
  "intersection()", "join()", "split()", "rsplit()", "strip()", "lstrip()",
  "rstrip()", "upper()", "lower()", "title()", "capitalize()", "startswith()",
  "endswith()", "find()", "rfind()", "replace()", "format()", "encode()",
  "decode()", "isdigit()", "isalpha()", "read()", "readline()", "readlines()",
  "write()", "close()",
]);

const PYTHON_SNIPPETS: Completion[] = [
  snippetCompletion("def ${name}(${params}):\n\t${}", {
    label: "def", detail: "function definition", type: "function", boost: 2,
  }),
  snippetCompletion("class ${Name}:\n\tdef __init__(self${}):\n\t\t${}", {
    label: "class", detail: "class with __init__", type: "class", boost: 2,
  }),
  snippetCompletion('if __name__ == "__main__":\n\t${}', {
    label: "main", detail: 'if __name__ == "__main__"', type: "function", boost: 3,
  }),
  snippetCompletion("for ${item} in ${iterable}:\n\t${}", {
    label: "for", detail: "for loop", type: "keyword", boost: 1,
  }),
  snippetCompletion("while ${condition}:\n\t${}", {
    label: "while", detail: "while loop", type: "keyword",
  }),
  snippetCompletion("try:\n\t${}\nexcept ${Exception} as e:\n\t${}", {
    label: "try", detail: "try / except", type: "keyword",
  }),
  snippetCompletion('with open("${file}") as ${f}:\n\t${}', {
    label: "with", detail: "with open()", type: "keyword",
  }),
  snippetCompletion("lambda ${x}: ${}", {
    label: "lambda", detail: "lambda expression", type: "function",
  }),
];

// ---------------------------------------------------------------------------
// JavaScript

const JS_KEYWORDS = [
  "async", "await", "break", "case", "catch", "class", "const", "continue",
  "debugger", "default", "delete", "do", "else", "export", "extends", "finally",
  "for", "function", "if", "import", "in", "instanceof", "let", "new", "of",
  "return", "static", "super", "switch", "this", "throw", "try", "typeof", "var",
  "void", "while", "with", "yield", "true", "false", "null", "undefined",
];

const JS_SNIPPETS: Completion[] = [
  snippetCompletion("console.log(${});", {
    label: "log", detail: "console.log();", type: "function", boost: 3,
  }),
  snippetCompletion("const ${name} = (${params}) => {\n\t${}\n};", {
    label: "arrow", detail: "arrow function", type: "function", boost: 2,
  }),
  snippetCompletion("for (let ${i} = 0; ${i} < ${limit}; ${i}++) {\n\t${}\n}", {
    label: "fori", detail: "indexed for loop", type: "keyword", boost: 2,
  }),
  snippetCompletion("for (const ${item} of ${iterable}) {\n\t${}\n}", {
    label: "forof", detail: "for…of loop", type: "keyword", boost: 2,
  }),
  snippetCompletion("try {\n\t${}\n} catch (err) {\n\t${}\n}", {
    label: "try", detail: "try / catch", type: "keyword",
  }),
  snippetCompletion("async function ${name}(${params}) {\n\t${}\n}", {
    label: "asyncfn", detail: "async function", type: "function",
  }),
  snippetCompletion("JSON.stringify(${value}, null, 2)", {
    label: "jsons", detail: "JSON.stringify pretty", type: "function",
  }),
];

// ---------------------------------------------------------------------------
// Assembly

function basicSources(language: SupportedLanguage): CompletionSource[] {
  const keywords: Record<SupportedLanguage, string[]> = {
    java: JAVA_KEYWORDS,
    python: PYTHON_KEYWORDS,
    javascript: JS_KEYWORDS,
  };
  return [completeFromList(keywordList(keywords[language])), completeAnyWord];
}

function smartSources(language: SupportedLanguage): CompletionSource[] {
  switch (language) {
    case "java":
      return [
        completeFromList([...JAVA_SNIPPETS, ...typeList(JAVA_TYPES)]),
        javaMemberSource,
        ...basicSources(language),
      ];
    case "python":
      return [
        completeFromList([
          ...PYTHON_SNIPPETS,
          ...PYTHON_BUILTINS.map((label): Completion => ({ label, type: "function", boost: 1 })),
        ]),
        memberSource(PYTHON_MEMBERS),
        ...basicSources(language),
      ];
    case "javascript":
      return [
        completeFromList([...JS_SNIPPETS, ...jsKeywordSnippets]),
        jsLocalCompletion,
        // Real scope-aware member completion (console., Math., JSON.…)
        scopeCompletionSource(globalThis),
        ...basicSources(language),
      ];
  }
}

const LANGUAGE_OF: Record<SupportedLanguage, typeof javaLanguage> = {
  java: javaLanguage,
  python: pythonLanguage,
  javascript: javascriptLanguage,
};

/**
 * Build the completion extensions for a language + mode.
 * `basicSetup.autocompletion` must be disabled — this owns the whole feature.
 */
export function completionExtensions(language: SupportedLanguage, mode: CompletionMode): Extension[] {
  if (mode === "off") return [];

  const config = { activateOnTyping: true, maxRenderedOptions: 60, icons: true };

  if (mode === "basic") {
    // `override` bypasses languageData sources, so basic stays strictly
    // keywords + document words even where the language package ships
    // smarter sources (e.g. lang-python's builtins).
    return [autocompletion({ ...config, override: basicSources(language) })];
  }

  const lang = LANGUAGE_OF[language];
  return [
    ...smartSources(language).map((source) => lang.data.of({ autocomplete: source })),
    autocompletion(config),
  ];
}
