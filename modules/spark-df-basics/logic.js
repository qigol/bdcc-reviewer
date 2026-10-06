// Qdigo module: spark-df-basics (Spark DataFrames I: notebooks, reading data and schemas).
// The shared mini-DataFrame engine is pasted verbatim at the top of register (engine/engine.js v1.0.0,
// 498/498 checks against real Spark 4.0.1). Module fns below it wrap the engine; see SOURCE_NOTES.md.
export default function register(sdk) {
  // ==========================================================================================
  // ENGINE: Spark 4 mini-DataFrame engine for Qdigo logic.js files. Paste VERBATIM inside
  //   export default function register(sdk) { ...ENGINE... your fns ... return { fns, generators }; }
  // Version 1.0.0 (2026-10-06). Ground truth: real Spark 4.0.1 runs (Spark Connect, ANSI mode on,
  // session time zone UTC, case-insensitive names) in SCRATCH/truth/truth.json + engine/probe/*.json.
  // Plain function declarations and consts only. Deterministic: no Math.random, no Date.
  // Values a module returns must be JSON-serializable: tables are {columns, rows, source, pending*}.
  // API reference: engine/README.md. Every public name starts with df / DF_.
  // ==========================================================================================

  const DF_ENGINE_VERSION = '1.0.0';
  const DF_SHUFFLE_PARTITIONS = 200; // spark.sql.shuffle.partitions (group order emulation)
  const DF_HASH_SEED = 42; // Murmur3Hash seed used by HashPartitioning
  const DF_CONNECT_MODULE = 'pyspark.errors.exceptions.connect';
  const DF_VOLUME = '/Volumes/workspace/default/bdcc';

  // The two lesson datasets, byte-identical to SCRATCH/truth/taxi12.csv and gh8.jsonl.
  const DF_TAXI12_CSV = [
    'VendorID,lpep_pickup_datetime,store_and_fwd_flag,PULocationID,DOLocationID,passenger_count,trip_distance,fare_amount,tip_amount,total_amount',
    '2,2017-10-02 08:00:03,N,41,238,1,1.94,11.5,2.46,14.76',
    '2,2017-10-02 08:00:06,N,97,137,1,5.08,22,2,24.8',
    '1,2017-10-02 08:00:14,N,7,261,1,9.8,34.5,6,41.3',
    '2,2017-10-02 08:00:15,N,7,179,1,0.37,4,0.96,5.76',
    '2,2017-10-02 08:00:16,N,74,166,1,1.4,8.5,1.86,11.16',
    '2,2017-10-02 08:00:30,N,33,140,1,8.1,29,4.47,34.27',
    '2,2017-10-02 08:00:38,N,41,238,1,1.76,12,0,12.8',
    '2,2017-10-02 08:00:51,N,7,260,1,1.51,8,0,8.8',
    '2,2017-10-02 08:01:03,N,75,41,1,1.56,8,0,8.8',
    '1,2017-10-02 08:01:08,N,74,75,1,1,6,0,6.8',
    '2,2017-10-02 08:01:38,N,7,223,2,2.15,10.5,0,11.3',
    '1,2017-10-02 10:47:29,Y,33,143,1,7.1,31,6.35,38.15',
    '',
  ].join('\n');
  const DF_GH8_JSONL = [
    '{"id": "2489651045", "type": "CreateEvent", "actor": {"login": "petroav"}, "repo": {"name": "petroav/6.828"}, "created_at": "2015-01-01T15:00:00Z"}',
    '{"id": "2489651051", "type": "PushEvent", "actor": {"login": "rspt"}, "repo": {"name": "rspt/rspt-theme"}, "payload": {"commits": [{"author": {"name": "rspt"}, "message": "Fix main header height on mobile"}]}, "created_at": "2015-01-01T15:00:01Z"}',
    '{"id": "2489651057", "type": "WatchEvent", "actor": {"login": "SametSisartenep"}, "repo": {"name": "visionmedia/debug"}, "created_at": "2015-01-01T15:00:03Z"}',
    '{"id": "2489651078", "type": "WatchEvent", "actor": {"login": "comcxx11"}, "repo": {"name": "phpsysinfo/phpsysinfo"}, "created_at": "2015-01-01T15:00:05Z"}',
    '{"id": "2489651128", "type": "ForkEvent", "actor": {"login": "Soufien"}, "repo": {"name": "wasabeef/awesome-android-libraries"}, "created_at": "2015-01-01T15:00:10Z"}',
    '{"id": "2489651405", "type": "PushEvent", "actor": {"login": "hex7c0"}, "repo": {"name": "hex7c0/json-decrypt"}, "payload": {"commits": [{"author": {"name": "hex7c0"}, "message": "travis docker"}, {"author": {"name": "hex7c0"}, "message": "update devDependencies"}]}, "created_at": "2015-01-01T15:00:39Z"}',
    '{"id": "2489651591", "type": "WatchEvent", "actor": {"login": "mhparker23"}, "repo": {"name": "vinta/awesome-python"}, "created_at": "2015-01-01T15:01:05Z"}',
    '{"id": "2489661785", "type": "WatchEvent", "actor": {"login": "x2bool"}, "repo": {"name": "vinta/awesome-python"}, "created_at": "2015-01-01T15:23:34Z"}',
    '',
  ].join('\n');
  // DDL of the notebook's schema under "Giving Spark a schema", adapted to the 10 taxi12 columns (flag INT = the bug).
  const DF_TAXI12_DDL_INT = 'VendorID INT, lpep_pickup_datetime TIMESTAMP, store_and_fwd_flag INT, PULocationID INT, DOLocationID INT, passenger_count INT, trip_distance FLOAT, fare_amount FLOAT, tip_amount FLOAT, total_amount FLOAT';
  const DF_TAXI12_DDL_STRING = DF_TAXI12_DDL_INT.replace('store_and_fwd_flag INT', 'store_and_fwd_flag STRING');

  // ------------------------------------------------------------------------------------------
  // Errors. Engine functions THROW an Error whose .df holds a JSON-serializable description.
  // Use dfTry(() => ...) to get { ok, value, error } instead.
  // ------------------------------------------------------------------------------------------
  function dfMakeError(info) {
    const e = new Error(info.message);
    e.df = {
      cls: info.cls || 'AnalysisException',
      module: info.module === undefined ? DF_CONNECT_MODULE : info.module,
      errorClass: info.errorClass || null,
      sqlState: info.sqlState || null,
      message: info.message,
      plan: info.plan || null,
      context: info.context || null,
      causes: info.causes || null,
      suggestions: info.suggestions || null,
    };
    return e;
  }
  function dfSparkMessage(errorClass, text, sqlState) {
    return '[' + errorClass + '] ' + text + ' SQLSTATE: ' + sqlState;
  }
  function dfTry(fn) {
    try {
      return { ok: true, value: fn(), error: null };
    } catch (e) {
      if (e && e.df) return { ok: false, value: null, error: e.df };
      throw e;
    }
  }
  // The final line(s) of a Python traceback for an engine error, exactly as pyspark prints them.
  //   opts.plan: array of plan lines (AnalysisException adds ';' then the plan, e.g. "'Project ['x]")
  //   opts.callSite: e.g. '<cell 4>:1' -> appends the "== DataFrame ==" context of CAST_INVALID_INPUT
  function dfErrorText(err, opts) {
    const d = err && err.df ? err.df : err;
    opts = opts || {};
    let s = (d.module ? d.module + '.' : '') + d.cls + ': ' + d.message;
    const plan = opts.plan || d.plan;
    if (plan && plan.length) s += ';\n' + plan.join('\n');
    if (d.context && opts.callSite) s += '\n== DataFrame ==\n"' + d.context + '" was called from\n' + opts.callSite;
    return s;
  }
  // Trimmed traceback in the house style (blueprint section 4).
  //   { cell, line, code, caret?, skipped = true, error | text }
  function dfTraceback(o) {
    const out = ['Traceback (most recent call last):', '  File "<cell ' + o.cell + '>", line ' + (o.line || 1) + ', in <module>', '    ' + o.code];
    if (o.caret) out.push('    ' + o.caret);
    if (o.skipped !== false) out.push('  ...');
    out.push(o.text != null ? o.text : dfErrorText(o.error, o));
    return out.join('\n');
  }
  // What type(x) prints on Spark Connect (Databricks serverless) for the objects the lessons inspect.
  const DF_PY_TYPES = {
    SparkSession: "<class 'pyspark.sql.connect.session.SparkSession'>",
    DataFrame: "<class 'pyspark.sql.connect.dataframe.DataFrame'>",
    Column: "<class 'pyspark.sql.connect.column.Column'>",
    GroupedData: "<class 'pyspark.sql.connect.group.GroupedData'>",
    Row: "<class 'pyspark.sql.types.Row'>",
    list: "<class 'list'>", int: "<class 'int'>", float: "<class 'float'>", str: "<class 'str'>",
    tuple: "<class 'tuple'>", NoneType: "<class 'NoneType'>", module: "<class 'module'>",
  };
  // Final line of the Python-side errors the lessons show (exact text from real runs):
  //   'NameError' {name}  'AttributeError' {type, attr}  'compare' {op, left, right} (e.g. "total_amount" > 1000)
  //   'columnBool' (Python and/or/not on Columns)  'shadowedMax' (max(3, 7) after a wildcard import)
  //   'shadowedBuiltin' (round(4.567, 1) / sum([1, 2, 3]) after a wildcard import)
  function dfPyErrorText(kind, o) {
    o = o || {};
    if (kind === 'NameError') return "NameError: name '" + o.name + "' is not defined";
    if (kind === 'AttributeError') return "AttributeError: '" + o.type + "' object has no attribute '" + o.attr + "'";
    if (kind === 'compare') return "TypeError: '" + o.op + "' not supported between instances of '" + o.left + "' and '" + o.right + "'";
    if (kind === 'columnBool') return "pyspark.errors.exceptions.base.PySparkValueError: [CANNOT_CONVERT_COLUMN_INTO_BOOL] Cannot convert column into bool: please use '&' for 'and', '|' for 'or', '~' for 'not' when building DataFrame boolean expressions.";
    if (kind === 'shadowedMax') return 'TypeError: max() takes 1 positional argument but 2 were given';
    if (kind === 'shadowedBuiltin') return 'AssertionError';
    throw new Error('dfPyErrorText: unknown kind ' + kind);
  }
  function dfCastInvalidInput(value, fromType, toType, context) {
    const text = "The value '" + value + "' of the type \"" + dfSqlTypeName(fromType) + '" cannot be cast to "' + dfSqlTypeName(toType) +
      '" because it is malformed. Correct the value as per the syntax, or change its target type. Use `try_cast` to tolerate malformed input and return NULL instead.';
    return dfMakeError({
      cls: dfTypeKind(toType) === 'timestamp' || dfTypeKind(toType) === 'date' ? 'SparkDateTimeException' : 'NumberFormatException',
      errorClass: 'CAST_INVALID_INPUT', sqlState: '22018', message: dfSparkMessage('CAST_INVALID_INPUT', text, '22018'), context: context || null,
    });
  }

  // ------------------------------------------------------------------------------------------
  // Identifiers, Levenshtein, the UNRESOLVED_COLUMN message (StringUtils.orderSuggestedIdentifiersBySimilarity:
  // candidates are back-quoted, sorted stably by Levenshtein distance to the typed name; first 5 shown).
  // ------------------------------------------------------------------------------------------
  function dfParseAttributeName(name) {
    const parts = [];
    let cur = '', inQ = false, i = 0;
    const s = String(name);
    while (i < s.length) {
      const ch = s[i];
      if (inQ) {
        if (ch === '`') {
          if (s[i + 1] === '`') { cur += '`'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        cur += ch; i++; continue;
      }
      if (ch === '`') { inQ = true; i++; continue; }
      if (ch === '.') { parts.push(cur); cur = ''; i++; continue; }
      cur += ch; i++;
    }
    parts.push(cur);
    return parts;
  }
  function dfQuoteIdent(part) { return '`' + String(part).replace(/`/g, '``') + '`'; }
  function dfQuoteIfNeeded(part) {
    return /^[A-Za-z0-9_]+$/.test(part) && !/^\d+$/.test(part) ? part : dfQuoteIdent(part);
  }
  function dfToSQLId(parts) { return (Array.isArray(parts) ? parts : dfParseAttributeName(parts)).map(dfQuoteIdent).join('.'); }
  function dfLevenshtein(a, b) {
    const m = a.length, n = b.length;
    let prev = [];
    for (let j = 0; j <= n; j++) prev.push(j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
      }
      prev = cur;
    }
    return prev[n];
  }
  // Ordered suggestion list (all candidates, best first). candidates: top-level column names (any order).
  // Verified on 51 real messages: distance = Levenshtein(`candidate` WITH back-quotes, typed name), ties broken
  // by candidate name in code-point order (uppercase before lowercase).
  function dfSuggestColumns(name, candidates) {
    const parts = Array.isArray(name) ? name : dfParseAttributeName(name);
    const base = parts.map(dfQuoteIfNeeded).join('.');
    const keyed = candidates.slice().sort(dfCmpStr).map((c, i) => ({ c, i, d: dfLevenshtein(dfQuoteIdent(c), base) }));
    keyed.sort((x, y) => x.d - y.d || x.i - y.i);
    return keyed.map((k) => k.c);
  }
  function dfUnresolvedColumnMessage(name, candidates) {
    const parts = Array.isArray(name) ? name : dfParseAttributeName(name);
    const obj = dfToSQLId(parts);
    const sugg = dfSuggestColumns(parts, candidates || []).slice(0, 5);
    const head = 'A column, variable, or function parameter with name ' + obj + ' cannot be resolved.';
    if (!sugg.length) return '[UNRESOLVED_COLUMN.WITHOUT_SUGGESTION] ' + head + '  SQLSTATE: 42703';
    return '[UNRESOLVED_COLUMN.WITH_SUGGESTION] ' + head + ' Did you mean one of the following? [' + sugg.map(dfQuoteIdent).join(', ') + ']. SQLSTATE: 42703';
  }
  function dfUnresolvedColumnError(name, candidates, plan) {
    const parts = Array.isArray(name) ? name : dfParseAttributeName(name);
    const sugg = dfSuggestColumns(parts, candidates || []).slice(0, 5);
    return dfMakeError({
      cls: 'AnalysisException', errorClass: sugg.length ? 'UNRESOLVED_COLUMN.WITH_SUGGESTION' : 'UNRESOLVED_COLUMN.WITHOUT_SUGGESTION',
      sqlState: '42703', message: dfUnresolvedColumnMessage(parts, candidates), suggestions: sugg, plan: plan || null,
    });
  }
  function dfFieldNotFoundError(field, fieldNames) {
    return dfMakeError({
      cls: 'AnalysisException', errorClass: 'FIELD_NOT_FOUND', sqlState: '42704',
      message: dfSparkMessage('FIELD_NOT_FOUND', 'No such struct field ' + dfQuoteIdent(field) + ' in ' + fieldNames.map(dfQuoteIdent).join(', ') + '.', '42704'),
    });
  }
  // Illustrative plan lines for an unresolved select (ids change on every real run; pass startId to copy a truth entry).
  function dfPlanLines(kind, table, names, opts) {
    opts = opts || {};
    const start = opts.startId == null ? 0 : opts.startId;
    const rel = '+- Relation [' + table.columns.map((c, i) => c.name + '#' + (start + i)).join(',') + '] ' + ((table.source && table.source.format) || 'csv');
    if (kind === 'select') return ["'Project [" + names.map((n) => "'" + dfParseAttributeName(n).map(dfQuoteIfNeeded).join('.')).join(', ') + ']', rel];
    return [rel];
  }

  // ------------------------------------------------------------------------------------------
  // Types. Atomic types are strings: 'string','int','bigint','smallint','tinyint','double','float',
  // 'boolean','timestamp','date','null','decimal(p,s)'. Complex: {type:'struct', fields:[{name,type,nullable}]},
  // {type:'array', elementType, containsNull}.
  // ------------------------------------------------------------------------------------------
  const DF_TYPE_WORDS = {
    int: 'int', integer: 'int', bigint: 'bigint', long: 'bigint', smallint: 'smallint', short: 'smallint', tinyint: 'tinyint', byte: 'tinyint',
    double: 'double', float: 'float', real: 'float', string: 'string', varchar: 'string', char: 'string', text: 'string',
    boolean: 'boolean', bool: 'boolean', timestamp: 'timestamp', timestamp_ltz: 'timestamp', date: 'date', void: 'null', null: 'null',
  };
  function dfTypeKind(t) {
    if (t && typeof t === 'object') return t.type;
    if (typeof t === 'string' && t.indexOf('decimal') === 0) return 'decimal';
    return t;
  }
  function dfIsIntegral(t) { const k = dfTypeKind(t); return k === 'int' || k === 'bigint' || k === 'smallint' || k === 'tinyint'; }
  function dfIsNumericType(t) { const k = dfTypeKind(t); return dfIsIntegral(t) || k === 'double' || k === 'float' || k === 'decimal'; }
  function dfDecimalPS(t) { const m = /^decimal\((\d+),(-?\d+)\)$/.exec(t); return m ? [+m[1], +m[2]] : [10, 0]; }
  // printSchema() names
  function dfTypeName(t) {
    const k = dfTypeKind(t);
    const map = { int: 'integer', bigint: 'long', smallint: 'short', tinyint: 'byte', null: 'void' };
    if (k === 'struct' || k === 'array' || k === 'map') return k;
    return map[k] || t;
  }
  // dtypes / DataFrame repr names
  function dfSimpleString(t) {
    const k = dfTypeKind(t);
    if (k === 'struct') return 'struct<' + t.fields.map((f) => f.name + ':' + dfSimpleString(f.type)).join(',') + '>';
    if (k === 'array') return 'array<' + dfSimpleString(t.elementType) + '>';
    if (k === 'map') return 'map<' + dfSimpleString(t.keyType) + ',' + dfSimpleString(t.valueType) + '>';
    if (k === 'null') return 'void';
    return t;
  }
  // SQL type names used in error messages and CAST(...) column names
  function dfSqlTypeName(t) {
    const k = dfTypeKind(t);
    if (k === 'struct') return 'STRUCT<' + t.fields.map((f) => f.name + ': ' + dfSqlTypeName(f.type)).join(', ') + '>';
    if (k === 'array') return 'ARRAY<' + dfSqlTypeName(t.elementType) + '>';
    if (k === 'decimal') return t.toUpperCase();
    return String(t).toUpperCase();
  }
  // Parse one type: 'INT', 'array<struct<a:int>>', 'decimal(10,2)', 'STRUCT<a: INT, b STRING>'
  function dfParseType(src) {
    const p = { s: String(src), i: 0 };
    const t = dfParseTypeAt(p);
    dfSkipWs(p);
    if (p.i < p.s.length) throw dfMakeError({ cls: 'ParseException', errorClass: 'PARSE_SYNTAX_ERROR', sqlState: '42601', message: dfSparkMessage('PARSE_SYNTAX_ERROR', 'Syntax error at or near \'' + p.s.slice(p.i) + '\'.', '42601') });
    return t;
  }
  function dfSkipWs(p) { while (p.i < p.s.length && /\s/.test(p.s[p.i])) p.i++; }
  function dfReadIdent(p) {
    dfSkipWs(p);
    if (p.s[p.i] === '`') {
      let out = '';
      p.i++;
      while (p.i < p.s.length) {
        if (p.s[p.i] === '`') { if (p.s[p.i + 1] === '`') { out += '`'; p.i += 2; continue; } p.i++; break; }
        out += p.s[p.i++];
      }
      return out;
    }
    const m = /^[A-Za-z0-9_$]+/.exec(p.s.slice(p.i));
    if (!m) return null;
    p.i += m[0].length;
    return m[0];
  }
  function dfParseTypeAt(p) {
    const w = dfReadIdent(p);
    if (!w) throw dfMakeError({ cls: 'ParseException', errorClass: 'PARSE_SYNTAX_ERROR', sqlState: '42601', message: 'Cannot parse type at: ' + p.s.slice(p.i) });
    const lw = w.toLowerCase();
    dfSkipWs(p);
    if (lw === 'struct') {
      p.i++; // <
      const fields = dfParseFieldList(p, '>');
      p.i++; // >
      return { type: 'struct', fields };
    }
    if (lw === 'array') {
      p.i++;
      const el = dfParseTypeAt(p);
      dfSkipWs(p); p.i++;
      return { type: 'array', elementType: el, containsNull: true };
    }
    if (lw === 'map') {
      p.i++;
      const kt = dfParseTypeAt(p); dfSkipWs(p); p.i++; // ,
      const vt = dfParseTypeAt(p); dfSkipWs(p); p.i++;
      return { type: 'map', keyType: kt, valueType: vt, valueContainsNull: true };
    }
    if (lw === 'decimal' || lw === 'dec' || lw === 'numeric') {
      let prec = 10, sc = 0;
      if (p.s[p.i] === '(') {
        const m = /^\(\s*(\d+)\s*(?:,\s*(-?\d+)\s*)?\)/.exec(p.s.slice(p.i));
        prec = +m[1]; sc = m[2] != null ? +m[2] : 0; p.i += m[0].length;
      }
      return 'decimal(' + prec + ',' + sc + ')';
    }
    if ((lw === 'varchar' || lw === 'char') && p.s[p.i] === '(') {
      const m = /^\(\s*\d+\s*\)/.exec(p.s.slice(p.i)); p.i += m[0].length;
    }
    const t = DF_TYPE_WORDS[lw];
    if (!t) throw dfMakeError({ cls: 'ParseException', errorClass: 'UNSUPPORTED_DATATYPE', sqlState: '0A000', message: dfSparkMessage('UNSUPPORTED_DATATYPE', 'Unsupported data type "' + w.toUpperCase() + '".', '0A000') });
    return t;
  }
  function dfParseFieldList(p, stop) {
    const fields = [];
    for (;;) {
      dfSkipWs(p);
      if (p.i >= p.s.length || p.s[p.i] === stop) break;
      const name = dfReadIdent(p);
      dfSkipWs(p);
      if (p.s[p.i] === ':') p.i++;
      const type = dfParseTypeAt(p);
      let nullable = true;
      dfSkipWs(p);
      let rest = p.s.slice(p.i);
      let m = /^NOT\s+NULL/i.exec(rest);
      if (m) { nullable = false; p.i += m[0].length; dfSkipWs(p); rest = p.s.slice(p.i); }
      m = /^COMMENT\s+'(?:[^'\\]|\\.)*'/i.exec(rest);
      if (m) { p.i += m[0].length; dfSkipWs(p); }
      fields.push({ name, type, nullable });
      dfSkipWs(p);
      if (p.s[p.i] === ',') { p.i++; continue; }
      break;
    }
    return fields;
  }
  // "VendorID INT, lpep_pickup_datetime TIMESTAMP, ..." -> [{name, type, nullable}]
  function dfParseDDL(ddl) {
    const p = { s: String(ddl), i: 0 };
    const f = dfParseFieldList(p, '\u0000');
    dfSkipWs(p);
    return f;
  }
  // Accepts a DDL string, [{name,type}], [[name,type]] or [name,...] (string columns).
  function dfColumnsFrom(spec) {
    if (typeof spec === 'string') return dfParseDDL(spec);
    return spec.map((c) => {
      if (typeof c === 'string') return { name: c, type: 'string', nullable: true };
      if (Array.isArray(c)) return { name: c[0], type: dfNormType(c[1]), nullable: true };
      return { name: c.name, type: dfNormType(c.type), nullable: c.nullable !== false };
    });
  }
  function dfNormType(t) {
    if (t == null) return 'string';
    if (typeof t === 'object') {
      if (t.type === 'struct') return { type: 'struct', fields: t.fields.map((f) => ({ name: f.name, type: dfNormType(f.type), nullable: f.nullable !== false })) };
      if (t.type === 'array') return { type: 'array', elementType: dfNormType(t.elementType), containsNull: t.containsNull !== false };
      return t;
    }
    return dfParseType(t);
  }

  // ------------------------------------------------------------------------------------------
  // Number formatting: Java Double.toString / Float.toString (as Spark casts to string), Python repr.
  // ------------------------------------------------------------------------------------------
  function dfDigitsExp(x) {
    const m = /^(\d)(?:\.(\d+))?e([+-]\d+)$/.exec(x.toExponential());
    return { digits: m[1] + (m[2] || ''), exp: +m[3] };
  }
  function dfJavaLayout(neg, digits, exp) {
    const sign = neg ? '-' : '';
    if (exp >= -3 && exp < 7) {
      if (exp >= 0) {
        const ip = digits.length > exp + 1 ? digits.slice(0, exp + 1) : digits + '0'.repeat(exp + 1 - digits.length);
        const fp = digits.length > exp + 1 ? digits.slice(exp + 1) : '0';
        return sign + ip + '.' + fp;
      }
      return sign + '0.' + '0'.repeat(-exp - 1) + digits;
    }
    return sign + digits[0] + '.' + (digits.length > 1 ? digits.slice(1) : '0') + 'E' + exp;
  }
  // JDK 17 FloatingDecimal "easy case": an integer value below 2^63 prints its exact digits, minus
  // insignificantDigitsForPow2(binExp - nSignificantBits - 1) rounded-off low digits (e.g. 2^31 as a float
  // prints 2.14748365E9, 123456789 as a float prints 1.23456792E8). Other values use the shortest digits.
  const DF_INSIGNIFICANT = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 17, 17, 17, 18, 18, 18, 19];
  function dfJavaEasyDigits(a, nSig) {
    if (!Number.isInteger(a) || a < 1 || a >= 9223372036854775808) return null;
    let v = BigInt(a);
    const binExp = v.toString(2).length - 1;
    let insignificant = 0;
    if (binExp > nSig) { const p2 = binExp - nSig - 1; insignificant = p2 > 1 && p2 < DF_INSIGNIFICANT.length ? DF_INSIGNIFICANT[p2] : 0; }
    if (insignificant) {
      const pow10 = 10n ** BigInt(insignificant);
      const residue = v % pow10;
      v = v / pow10;
      if (residue >= pow10 / 2n) v += 1n;
    }
    const s = v.toString();
    return { digits: s.replace(/0+$/, '') || '0', exp: s.length - 1 + insignificant };
  }
  function dfJavaDouble(x) {
    if (x === null || x === undefined) return null;
    if (Number.isNaN(x)) return 'NaN';
    if (x === Infinity) return 'Infinity';
    if (x === -Infinity) return '-Infinity';
    if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
    if (Math.abs(x) === 5e-324) return (x < 0 ? '-' : '') + '4.9E-324';
    const de = dfJavaEasyDigits(Math.abs(x), 53) || dfDigitsExp(Math.abs(x));
    return dfJavaLayout(x < 0, de.digits, de.exp);
  }
  function dfJavaFloat(x) {
    if (x === null || x === undefined) return null;
    if (Number.isNaN(x)) return 'NaN';
    if (x === Infinity) return 'Infinity';
    if (x === -Infinity) return '-Infinity';
    if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
    const a = Math.abs(x);
    if (a === Math.fround(1.401298464324817e-45)) return (x < 0 ? '-' : '') + '1.4E-45';
    const easy = dfJavaEasyDigits(a, 24);
    if (easy) return dfJavaLayout(x < 0, easy.digits, easy.exp);
    for (let p = 1; p <= 9; p++) {
      const s = a.toPrecision(p);
      if (Math.fround(+s) === a) {
        const de = dfDigitsExp(+s);
        return dfJavaLayout(x < 0, de.digits, de.exp);
      }
    }
    return dfJavaDouble(x);
  }
  function dfPyFloat(x) {
    if (Number.isNaN(x)) return 'nan';
    if (x === Infinity) return 'inf';
    if (x === -Infinity) return '-inf';
    if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0';
    const de = dfDigitsExp(Math.abs(x));
    const sign = x < 0 ? '-' : '';
    if (de.exp >= -4 && de.exp < 16) return dfJavaLayout(x < 0, de.digits, de.exp).replace(/E.*$/, '');
    return sign + de.digits[0] + (de.digits.length > 1 ? '.' + de.digits.slice(1) : '') + 'e' + (de.exp < 0 ? '-' : '+') + String(Math.abs(de.exp)).padStart(2, '0');
  }
  function dfPad(n, w) { return String(n).padStart(w, '0'); }
  // Exact decimal expansion of a finite double -> { neg, int: BigInt, scale } with |x| = int * 10^-scale.
  function dfExactDecimal(x) {
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, x);
    const hi = dv.getUint32(0), lo = dv.getUint32(4);
    const neg = (hi >>> 31) === 1;
    const be = (hi >>> 20) & 0x7ff;
    let mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);
    let e;
    if (be === 0) e = -1074; else { mant |= 1n << 52n; e = be - 1075; }
    if (e >= 0) return { neg, int: mant << BigInt(e), scale: 0 };
    return { neg, int: mant * 5n ** BigInt(-e), scale: -e };
  }
  // Round an exact decimal (int * 10^-scale) to `d` decimals, half-even (Python's float formatting).
  function dfRoundDecimal(ex, d) {
    if (ex.scale <= d) return ex.int * 10n ** BigInt(d - ex.scale);
    const div = 10n ** BigInt(ex.scale - d);
    let q = ex.int / div;
    const r2 = (ex.int % div) * 2n;
    if (r2 > div || (r2 === div && q % 2n === 1n)) q += 1n;
    return q;
  }
  // Python '%.{d}f' % x (exact, half-even), e.g. dfPyFixed(24.799999237060547, 6) -> '24.799999'
  function dfPyFixed(x, d) {
    if (Number.isNaN(x)) return 'nan';
    if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
    const ex = dfExactDecimal(x);
    let s = dfRoundDecimal(ex, d).toString().padStart(d + 1, '0');
    if (d > 0) s = s.slice(0, -d) + '.' + s.slice(-d);
    return (ex.neg ? '-' : '') + s;
  }
  // Python '%.{d}e' % x, e.g. dfPyExp(1e20, 6) -> '1.000000e+20'
  function dfPyExp(x, d) {
    if (Number.isNaN(x)) return 'nan';
    if (!Number.isFinite(x)) return x > 0 ? 'inf' : '-inf';
    const ex = dfExactDecimal(x);
    if (ex.int === 0n) return (ex.neg ? '-' : '') + '0.' + '0'.repeat(d) + 'e+00';
    const len = ex.int.toString().length;
    let exp = len - 1 - ex.scale;
    let q = dfRoundDecimal({ int: ex.int, scale: len - 1 }, d); // mantissa digits as an integer
    if (q.toString().length > d + 1) { q /= 10n; exp += 1; }
    const s = q.toString();
    return (ex.neg ? '-' : '') + s[0] + (d > 0 ? '.' + s.slice(1) : '') + 'e' + (exp < 0 ? '-' : '+') + String(Math.abs(exp)).padStart(2, '0');
  }

  // ------------------------------------------------------------------------------------------
  // Dates and timestamps (UTC). Stored as canonical strings: 'yyyy-MM-dd HH:mm:ss[.ffffff]' (fraction
  // trimmed of trailing zeros, exactly as show() prints) and 'yyyy-MM-dd'.
  // ------------------------------------------------------------------------------------------
  function dfDaysFromCivil(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    const era = Math.floor(y / 400);
    const yoe = y - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }
  function dfCivilFromDays(z) {
    z += 719468;
    const era = Math.floor(z / 146097);
    const doe = z - era * 146097;
    const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    const mp = Math.floor((5 * doy + 2) / 153);
    const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    const m = mp + (mp < 10 ? 3 : -9);
    return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
  }
  function dfMonthDays(y, m) {
    return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  }
  function dfMicrosToTs(us) {
    const days = Math.floor(us / 86400e6);
    let rem = us - days * 86400e6;
    const ymd = dfCivilFromDays(days);
    const hh = Math.floor(rem / 3600e6); rem -= hh * 3600e6;
    const mi = Math.floor(rem / 60e6); rem -= mi * 60e6;
    const ss = Math.floor(rem / 1e6); rem -= ss * 1e6;
    let s = dfPad(ymd[0], 4) + '-' + dfPad(ymd[1], 2) + '-' + dfPad(ymd[2], 2) + ' ' + dfPad(hh, 2) + ':' + dfPad(mi, 2) + ':' + dfPad(ss, 2);
    if (rem) s += '.' + dfPad(Math.round(rem), 6).replace(/0+$/, '');
    return s;
  }
  function dfTsToMicros(ts) {
    const m = /^(-?\d{4,6})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?)?$/.exec(ts);
    if (!m) return null;
    const days = dfDaysFromCivil(+m[1], +m[2], +m[3]);
    const frac = m[7] ? +(m[7] + '000000').slice(0, 6) : 0;
    return days * 86400e6 + (+(m[4] || 0)) * 3600e6 + (+(m[5] || 0)) * 60e6 + (+(m[6] || 0)) * 1e6 + frac;
  }
  function dfDateToDays(d) { const m = /^(-?\d{4,6})-(\d{2})-(\d{2})$/.exec(d); return m ? dfDaysFromCivil(+m[1], +m[2], +m[3]) : null; }
  function dfDaysToDate(z) { const c = dfCivilFromDays(z); return dfPad(c[0], 4) + '-' + dfPad(c[1], 2) + '-' + dfPad(c[2], 2); }
  function dfTrimAll(s) { return String(s).replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, ''); }
  // Spark's flexible string -> timestamp parser (stringToTimestamp). Returns canonical string or null.
  function dfParseTimestamp(str) {
    if (str == null) return null;
    const t = dfTrimAll(str);
    const m = /^([+-]?\d{4,6})(?:-(\d{1,2})(?:-(\d{1,2})(?:[ T](?:(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{0,9}))?)?)?\s*(Z|UTC|GMT|[+-]\d{1,2}(?::?\d{2})?|(?:UTC|GMT)[+-]\d{1,2}(?::?\d{2})?)?)?)?)?$/i.exec(t);
    if (!m) return null;
    const y = +m[1], mo = m[2] ? +m[2] : 1, d = m[3] ? +m[3] : 1;
    if (mo < 1 || mo > 12 || d < 1 || d > dfMonthDays(y, mo)) return null;
    const hh = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0, ss = m[6] ? +m[6] : 0;
    if (hh > 23 || mi > 59 || ss > 59) return null;
    const frac = m[7] ? +((m[7] + '000000').slice(0, 6)) : 0;
    let off = 0;
    if (m[8]) {
      const z = m[8].toUpperCase().replace(/^(UTC|GMT)/, '');
      if (z && z !== 'Z') {
        const zm = /^([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(z);
        if (!zm) return null;
        off = (zm[1] === '-' ? -1 : 1) * ((+zm[2]) * 60 + (+(zm[3] || 0)));
      }
    }
    const us = dfDaysFromCivil(y, mo, d) * 86400e6 + hh * 3600e6 + mi * 60e6 + ss * 1e6 + frac - off * 60e6;
    return dfMicrosToTs(us);
  }
  // Spark's string -> date parser (stringToDate): 'yyyy', 'yyyy-[m]m', 'yyyy-[m]m-[d]d', then ' ' or 'T' + anything.
  function dfParseDate(str) {
    if (str == null) return null;
    const t = dfTrimAll(str);
    const m = /^([+-]?\d{4,6})(?:-(\d{1,2})(?:-(\d{1,2})(?:[ T].*)?)?)?$/.exec(t);
    if (!m) return null;
    const y = +m[1], mo = m[2] ? +m[2] : 1, d = m[3] ? +m[3] : 1;
    if (mo < 1 || mo > 12 || d < 1 || d > dfMonthDays(y, mo)) return null;
    return dfPad(y, 4) + '-' + dfPad(mo, 2) + '-' + dfPad(d, 2);
  }
  // date_trunc(unit, ts) for 'year','quarter','month','week','day','hour','minute','second','millisecond','microsecond'
  function dfDateTrunc(unit, ts) {
    if (ts == null) return null;
    const us = dfTsToMicros(ts);
    const u = String(unit).toLowerCase();
    const days = Math.floor(us / 86400e6);
    const c = dfCivilFromDays(days);
    if (u === 'year' || u === 'yyyy' || u === 'yy') return dfMicrosToTs(dfDaysFromCivil(c[0], 1, 1) * 86400e6);
    if (u === 'quarter') return dfMicrosToTs(dfDaysFromCivil(c[0], Math.floor((c[1] - 1) / 3) * 3 + 1, 1) * 86400e6);
    if (u === 'month' || u === 'mon' || u === 'mm') return dfMicrosToTs(dfDaysFromCivil(c[0], c[1], 1) * 86400e6);
    if (u === 'week') { const dow = ((days % 7) + 7 + 3) % 7; return dfMicrosToTs((days - dow) * 86400e6); }
    const unitUs = { day: 86400e6, dd: 86400e6, hour: 3600e6, minute: 60e6, second: 1e6, millisecond: 1e3, microsecond: 1 }[u];
    if (!unitUs) return null;
    return dfMicrosToTs(Math.floor(us / unitUs) * unitUs);
  }

  // ------------------------------------------------------------------------------------------
  // Value formatting. Pretty (show) form: null -> 'NULL', structs '{a, b}', arrays '[a, b]'.
  // Cast form (describe min/max, CAST(x AS STRING)): same, but a top-level null stays null.
  // ------------------------------------------------------------------------------------------
  function dfFormatValue(v, t, pretty) {
    if (v === null || v === undefined) return pretty === false ? null : 'NULL';
    const k = dfTypeKind(t);
    if (k === 'double') return dfJavaDouble(v);
    if (k === 'float') return dfJavaFloat(v);
    if (k === 'boolean') return v ? 'true' : 'false';
    if (k === 'struct') return '{' + t.fields.map((f) => dfFormatValue(v[f.name], f.type, true)).join(', ') + '}';
    if (k === 'array') return '[' + v.map((e) => dfFormatValue(e, t.elementType, true)).join(', ') + ']';
    if (k === 'map') return '{' + Object.keys(v).map((key) => key + ' -> ' + dfFormatValue(v[key], t.valueType, true)).join(', ') + '}';
    return String(v);
  }
  function dfEscapeMeta(s) {
    return s.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\f/g, '\\f').replace(/\u0008/g, '\\b').replace(/\u000B/g, '\\v').replace(/\u0007/g, '\\a');
  }
  // Python repr of a cell value of a known Spark type (Row(...) reprs, collect()).
  //   o.tzOffsetMinutes: the Python client shows TIMESTAMPs in ITS local time zone. 0 (default) = UTC, as on
  //   Databricks; the local harness that produced the probes ran at UTC+8 (480).
  function dfPyValue(v, t, o) {
    if (v === null || v === undefined) return 'None';
    const k = dfTypeKind(t);
    if (k === 'double' || k === 'float') return dfPyFloat(v);
    if (k === 'boolean') return v ? 'True' : 'False';
    if (k === 'string') return dfPyStr(v);
    if (k === 'timestamp') {
      if (o && o.tzOffsetMinutes) v = dfMicrosToTs(dfTsToMicros(v) + o.tzOffsetMinutes * 60e6);
      const m = /^(\d+)-(\d+)-(\d+) (\d+):(\d+):(\d+)(?:\.(\d+))?$/.exec(v);
      const parts = [+m[1], +m[2], +m[3], +m[4], +m[5]];
      if (+m[6] || m[7]) parts.push(+m[6]);
      if (m[7]) parts.push(+(m[7] + '000000').slice(0, 6));
      return 'datetime.datetime(' + parts.join(', ') + ')';
    }
    if (k === 'date') { const m = /^(\d+)-(\d+)-(\d+)$/.exec(v); return 'datetime.date(' + (+m[1]) + ', ' + (+m[2]) + ', ' + (+m[3]) + ')'; }
    if (k === 'decimal') return "Decimal('" + v + "')";
    if (k === 'struct') return 'Row(' + t.fields.map((f) => f.name + '=' + dfPyValue(v[f.name], f.type, o)).join(', ') + ')';
    if (k === 'array') return '[' + v.map((e) => dfPyValue(e, t.elementType, o)).join(', ') + ']';
    return String(v);
  }
  function dfPyStr(s) {
    s = String(s);
    const q = s.indexOf("'") >= 0 && s.indexOf('"') < 0 ? '"' : "'";
    let out = '';
    for (const ch of s) {
      if (ch === '\\') out += '\\\\';
      else if (ch === q) out += '\\' + q;
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else if (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127) out += '\\x' + dfPad(ch.charCodeAt(0).toString(16), 2);
      else out += ch;
    }
    return q + out + q;
  }
  // Python repr of plain JS data: strings -> 'x', numbers -> 12 / 1.5, null -> None, booleans -> True/False,
  // arrays -> lists, { tuple: [...] } -> tuples.
  function dfPyRepr(v) {
    if (v === null || v === undefined) return 'None';
    if (typeof v === 'string') return dfPyStr(v);
    if (typeof v === 'boolean') return v ? 'True' : 'False';
    if (typeof v === 'number') return Number.isInteger(v) && !Object.is(v, -0) ? String(v) : dfPyFloat(v);
    if (Array.isArray(v)) return '[' + v.map(dfPyRepr).join(', ') + ']';
    if (v.tuple) return '(' + v.tuple.map(dfPyRepr).join(', ') + (v.tuple.length === 1 ? ',' : '') + ')';
    return String(v);
  }
  // IPython-style pretty repr (Jupyter Out[]): one line if it fits in 79 chars, else one item per line.
  function dfPyPretty(v, width) {
    const one = dfPyRepr(v);
    if (one.length <= (width || 79) || !Array.isArray(v) || v.length < 2) return one;
    return '[' + v.map(dfPyRepr).join(',\n ') + ']';
  }

  // ------------------------------------------------------------------------------------------
  // Tables. { columns: [{name, type, nullable}], rows: [[v, ...]], source: {format, path}|null,
  //           partitions: null | [sizes of contiguous row slices], pendingError, pendingColumns }
  // partitions = null means ONE input partition (any small CSV/JSON file). spark.createDataFrame(rows)
  // in local[4] splits rows over min(n, 4) slices: use dfFromRows(..., { partitions: 'local' }).
  // Partitions only change group order and the last bits of sums/means/stddevs (merge order).
  // ------------------------------------------------------------------------------------------
  function dfTable(columns, rows, source, opts) {
    return dfFromRows(columns, rows || [], source, opts);
  }
  // ParallelCollectionRDD slicing used by LocalTableScan: min(max(n,1), parallelism) slices.
  function dfLocalPartitions(n, parallelism) {
    const p = Math.min(Math.max(n, 1), parallelism || 4);
    const out = [];
    for (let i = 0; i < p; i++) out.push(Math.floor(((i + 1) * n) / p) - Math.floor((i * n) / p));
    return out;
  }
  function dfPartRanges(table) {
    const n = table.rows.length;
    if (!table.partitions || !table.partitions.length) return [[0, n]];
    const out = [];
    let s = 0;
    for (const k of table.partitions) { out.push([s, s + k]); s += k; }
    return out;
  }
  // rows of each input partition (arrays of rows)
  function dfRowsByPartition(table, rows) {
    rows = rows || table.rows;
    return dfPartRanges(table).map((r) => rows.slice(r[0], r[1]));
  }
  function dfNormalizeValue(v, t) {
    if (v === null || v === undefined) return null;
    const k = dfTypeKind(t);
    if (dfIsIntegral(t)) return typeof v === 'number' ? v : +v;
    if (k === 'double') return +v;
    if (k === 'float') return Math.fround(+v);
    if (k === 'boolean') return typeof v === 'boolean' ? v : /^true$/i.test(String(v));
    if (k === 'timestamp') return dfParseTimestamp(String(v));
    if (k === 'date') return dfParseDate(String(v));
    if (k === 'string') return String(v);
    if (k === 'struct') {
      const o = {};
      for (const f of t.fields) {
        let fv = null;
        if (Array.isArray(v)) fv = v[t.fields.indexOf(f)];
        else for (const key of Object.keys(v)) if (key.toLowerCase() === f.name.toLowerCase()) fv = v[key];
        o[f.name] = dfNormalizeValue(fv, f.type);
      }
      return o;
    }
    if (k === 'array') return v.map((e) => dfNormalizeValue(e, t.elementType));
    return v;
  }
  // rows: arrays in column order, or objects keyed by column name.
  // opts.partitions: 'local' (emulate spark.createDataFrame in local[4]) or an array of slice sizes.
  function dfFromRows(columns, rows, source, opts) {
    const cols = dfColumnsFrom(columns);
    const out = rows.map((r) => cols.map((c, i) => dfNormalizeValue(Array.isArray(r) ? r[i] : r[c.name], c.type)));
    let parts = opts && opts.partitions ? opts.partitions : null;
    if (parts === 'local') parts = dfLocalPartitions(out.length);
    return { columns: cols, rows: out, source: source || null, partitions: parts, pendingError: null, pendingColumns: null };
  }
  // New table derived from `table`. o.partitions: sizes to keep (default null = single partition);
  // o.keepPending === false drops a FAILFAST pending error.
  function dfWithRows(table, columns, rows, o) {
    o = o || {};
    const keep = o.keepPending !== false;
    return { columns, rows, source: table.source, partitions: o.partitions || null, pendingError: keep ? table.pendingError : null, pendingColumns: keep ? table.pendingColumns : null };
  }
  function dfColumns(table) { return table.columns.map((c) => c.name); }
  function dfDtypes(table) { return table.columns.map((c) => [c.name, dfSimpleString(c.type)]); }
  function dfDtypesRepr(table) { return dfPyPretty(dfDtypes(table).map((d) => ({ tuple: d }))); }
  function dfColumnsRepr(table) { return dfPyPretty(dfColumns(table)); }
  function dfRepr(table) { return 'DataFrame[' + table.columns.map((c) => c.name + ': ' + dfSimpleString(c.type)).join(', ') + ']'; }
  function dfCount(table) { return table.rows.length; }
  function dfLimit(table, n) { return dfWithRows(table, table.columns, table.rows.slice(0, Math.max(0, n))); } // limit -> one partition
  function dfCheckPending(table) {
    if (table.pendingError) throw dfMakeError(table.pendingError);
  }
  // Rows as plain objects {colName: value} (JSON-friendly).
  function dfCollect(table) {
    dfCheckPending(table);
    return table.rows.map((r) => { const o = {}; table.columns.forEach((c, i) => { o[c.name] = r[i]; }); return o; });
  }
  function dfFirst(table) { const r = dfCollect(dfLimit(table, 1)); return r.length ? r[0] : null; }
  // repr(df.first()) / repr(df.collect()[i]): 'Row(VendorID=2, ...)'. opts: { tzOffsetMinutes } (see dfPyValue)
  function dfRowRepr(table, i, opts) {
    dfCheckPending(table);
    const r = table.rows[i || 0];
    if (!r) return 'None';
    return 'Row(' + table.columns.map((c, j) => c.name + '=' + dfPyValue(r[j], c.type, opts)).join(', ') + ')';
  }
  // tuple(row): '(7, 7, 38832)'
  function dfTupleRepr(table, i, opts) {
    const r = table.rows[i || 0];
    return '(' + table.columns.map((c, j) => dfPyValue(r[j], c.type, opts)).join(', ') + (r.length === 1 ? ',' : '') + ')';
  }
  // What a notebook shows for df.collect() / df.take(n) / df.head(n): pprint of the Row list (width 79:
  // one line if it fits, else one Row per line). opts: { n?, tzOffsetMinutes? }
  function dfRowsRepr(table, opts) {
    opts = opts || {};
    dfCheckPending(table);
    const n = opts.n == null ? table.rows.length : Math.max(0, Math.min(opts.n, table.rows.length));
    const items = [];
    for (let i = 0; i < n; i++) items.push(dfRowRepr(table, i, opts));
    const one = '[' + items.join(', ') + ']';
    return one.length <= 79 || items.length < 2 ? one : '[' + items.join(',\n ') + ']';
  }

  // ------------------------------------------------------------------------------------------
  // printSchema (StructType.treeString)
  // ------------------------------------------------------------------------------------------
  function dfTreeLines(t, prefix, out) {
    const k = dfTypeKind(t);
    if (k === 'struct') for (const f of t.fields) dfTreeField(f.name, f.type, f.nullable !== false, prefix, out, 'nullable');
    else if (k === 'array') dfTreeField('element', t.elementType, t.containsNull !== false, prefix, out, 'containsNull');
    else if (k === 'map') {
      dfTreeField('key', t.keyType, false, prefix, out, 'nullable');
      dfTreeField('value', t.valueType, t.valueContainsNull !== false, prefix, out, 'valueContainsNull');
    }
  }
  function dfTreeField(name, type, nullable, prefix, out, word) {
    out.push(prefix + '-- ' + dfEscapeMeta(name) + ': ' + dfTypeName(type) + ' (' + word + ' = ' + nullable + ')');
    dfTreeLines(type, prefix + '    |', out);
  }
  // Exactly df.schema.treeString() (ends with '\n'); the notebook prints it plus one more '\n'.
  function dfPrintSchemaString(table) {
    const cols = Array.isArray(table) ? table : table.columns;
    const out = ['root'];
    for (const c of cols) dfTreeField(c.name, c.type, c.nullable !== false, ' |', out, 'nullable');
    return out.join('\n') + '\n';
  }
  // Nested object for a Tree widget: { label, children }
  function dfSchemaTree(table) {
    const node = (name, t, nullable) => {
      const k = dfTypeKind(t);
      const kids = k === 'struct' ? t.fields.map((f) => node(f.name, f.type, f.nullable !== false)) : k === 'array' ? [node('element', t.elementType, true)] : [];
      const n = { label: name + ': ' + dfTypeName(t), type: dfSimpleString(t), nullable };
      if (kids.length) n.children = kids;
      return n;
    };
    return { label: 'root', children: table.columns.map((c) => node(c.name, c.type, c.nullable !== false)) };
  }

  // ------------------------------------------------------------------------------------------
  // show(): byte-exact Dataset.showString (Spark 4). Returns the string Spark builds (ends with '\n').
  // What a notebook prints is that string + '\n' (print adds one).
  //   opts: { n = 20, truncate = true | false | number, vertical = false }
  // ------------------------------------------------------------------------------------------
  const DF_FULLWIDTH = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/g;
  function dfHalfWidth(s) { const m = s.match(DF_FULLWIDTH); return s.length + (m ? m.length : 0); }
  function dfPadLeft(s, w) { return w > s.length ? ' '.repeat(w - s.length) + s : s; }
  function dfPadRight(s, w, ch) { return w > s.length ? s + (ch || ' ').repeat(w - s.length) : s; }
  function dfShowString(table, opts) {
    dfCheckPending(table);
    opts = opts || {};
    const numRows = Math.max(0, opts.n == null ? 20 : Math.trunc(opts.n));
    let truncate = opts.truncate;
    if (truncate === undefined || truncate === null || truncate === true) truncate = 20;
    else if (truncate === false) truncate = 0;
    else truncate = Math.trunc(truncate);
    const vertical = !!opts.vertical;
    const take = table.rows.slice(0, numRows + 1);
    const hasMore = take.length > numRows;
    const data = take.slice(0, numRows).map((r) => table.columns.map((c, i) => {
      const s = dfEscapeMeta(dfFormatValue(r[i], c.type, true));
      if (truncate > 0 && s.length > truncate) return truncate < 4 ? s.slice(0, truncate) : s.slice(0, truncate - 3) + '...';
      return s;
    }));
    const header = table.columns.map((c) => c.name);
    let sb = '';
    if (!vertical) {
      const w = header.map(() => 3);
      for (const row of [header].concat(data)) row.forEach((cell, i) => { w[i] = Math.max(w[i], dfHalfWidth(cell)); });
      const pad = (cell, i) => {
        const width = w[i] - dfHalfWidth(cell) + cell.length;
        return truncate > 0 ? dfPadLeft(cell, width) : dfPadRight(cell, width);
      };
      const sep = '+' + w.map((x) => '-'.repeat(x)).join('+') + '+\n';
      sb += sep;
      sb += '|' + header.map(pad).join('|') + '|\n';
      sb += sep;
      for (const row of data) sb += '|' + row.map(pad).join('|') + '|\n';
      sb += sep;
    } else {
      const fw = header.reduce((m, h) => Math.max(m, dfHalfWidth(h)), 3);
      const dw = data.reduce((m, row) => Math.max(m, row.reduce((mm, c) => Math.max(mm, dfHalfWidth(c)), 0)), 3);
      data.forEach((row, i) => {
        sb += dfPadRight('-RECORD ' + i, fw + dw + 5, '-') + '\n';
        sb += row.map((cell, j) => {
          const f = dfPadRight(header[j], fw - dfHalfWidth(header[j]) + header[j].length);
          const d = dfPadRight(cell, dw - dfHalfWidth(cell) + cell.length);
          return ' ' + f + ' | ' + d + ' ';
        }).join('\n') + '\n';
      });
    }
    // Spark 4 adds the footer WITHOUT a trailing newline
    if (vertical && data.length === 0) sb += '(0 rows)';
    else if (hasMore) sb += 'only showing top ' + numRows + ' ' + (numRows === 1 ? 'row' : 'rows');
    return sb;
  }
  // What the notebook cell displays for df.show(...): showString + the newline print() adds.
  function dfShowOutput(table, opts) { return dfShowString(table, opts) + '\n'; }

  // ------------------------------------------------------------------------------------------
  // CSV reading (Spark CSV source; univocity defaults: sep ',', quote '"', escape '\', nullValue '').
  // ------------------------------------------------------------------------------------------
  function dfSplitCsvLine(line, sep) {
    sep = sep || ',';
    const out = [];
    let i = 0;
    const n = line.length;
    for (;;) {
      if (i >= n) { out.push(null); break; }
      if (line[i] === '"') {
        let j = i + 1, val = '', closed = false, bad = false;
        while (j < n) {
          const ch = line[j];
          if (ch === '\\' && line[j + 1] === '"') { val += '"'; j += 2; continue; }
          if (ch === '"') {
            if (j + 1 >= n || line.slice(j + 1, j + 1 + sep.length) === sep) { closed = true; j++; break; }
            bad = true; break;
          }
          val += ch; j++;
        }
        if (bad) {
          // unescaped quote inside a quoted value: STOP_AT_DELIMITER keeps the raw text up to the next delimiter
          let k = line.indexOf(sep, j);
          if (k < 0) k = n;
          out.push(line.slice(i, k));
          i = k + sep.length;
          if (k >= n) break;
          continue;
        }
        out.push(val === '' && closed ? '' : val);
        if (j >= n) break;
        i = j + sep.length;
        if (i > n) break;
        if (i === n) { out.push(null); break; }
        continue;
      }
      let k = line.indexOf(sep, i);
      if (k < 0) { out.push(line.slice(i)); break; }
      out.push(line.slice(i, k));
      i = k + sep.length;
      if (i === n) { out.push(null); break; }
    }
    return out.map((v) => (v === '' ? null : v));
  }
  const DF_JAVA_DOUBLE_RE = /^[+-]?(NaN|Infinity|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fFdD]?)$/;
  // Java Double.parseDouble semantics (trims chars <= ' ', accepts 1.5f, NaN, Infinity). null if invalid.
  function dfJavaParseDouble(s) {
    const t = String(s).replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
    if (!DF_JAVA_DOUBLE_RE.test(t)) return null;
    if (/NaN/.test(t)) return NaN;
    if (/Infinity/.test(t)) return t[0] === '-' ? -Infinity : Infinity;
    return +t.replace(/[fFdD]$/, '');
  }
  function dfIntRange(t) {
    const k = dfTypeKind(t);
    if (k === 'tinyint') return [-128, 127];
    if (k === 'smallint') return [-32768, 32767];
    if (k === 'int') return [-2147483648, 2147483647];
    return null;
  }
  function dfParseIntegral(s, t) {
    if (!/^[+-]?\d+$/.test(s)) return null;
    const r = dfIntRange(t);
    if (r) { const v = +s; return v >= r[0] && v <= r[1] ? (Object.is(v, -0) ? 0 : v) : null; }
    const b = BigInt(s);
    if (b > 9223372036854775807n || b < -9223372036854775808n) return null;
    const v = Number(b);
    return Object.is(v, -0) ? 0 : v;
  }
  function dfParseDecimalStr(s, t) {
    const ps = dfDecimalPS(t);
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(dfTrimAll(s));
    if (!m || (m[2] === '' && (m[3] == null || m[3] === ''))) return null;
    let digits = (m[2] || '') + (m[3] || '');
    let scale = (m[3] || '').length - (m[4] ? +m[4] : 0);
    let big = BigInt(digits || '0');
    const target = ps[1];
    if (scale > target) {
      const div = 10n ** BigInt(scale - target);
      const q = big / div, r = big % div;
      big = q + (r * 2n >= div ? 1n : 0n);
    } else if (scale < target) big *= 10n ** BigInt(target - scale);
    let str = big.toString();
    if (str.length > ps[0]) return null;
    if (target > 0) { str = str.padStart(target + 1, '0'); str = str.slice(0, -target) + '.' + str.slice(-target); }
    return (m[1] === '-' && big !== 0n ? '-' : '') + str;
  }
  // One CSV field -> typed value with Spark PERMISSIVE semantics.
  // Returns { value, error } where error = { exception, message } (the JVM "Caused by" exception) or null.
  function dfCsvConvert(raw, type) {
    if (raw === null || raw === undefined || raw === '') return { value: null, error: null };
    const k = dfTypeKind(type);
    const nfe = (cls) => ({ value: null, error: { exception: cls || 'java.lang.NumberFormatException', message: 'For input string: "' + raw + '"' } });
    if (k === 'string') return { value: raw, error: null };
    if (dfIsIntegral(type)) { const v = dfParseIntegral(raw, type); return v === null ? nfe() : { value: v, error: null }; }
    if (k === 'double' || k === 'float') {
      let v;
      if (raw === 'NaN') v = NaN; else if (raw === 'Inf') v = Infinity; else if (raw === '-Inf') v = -Infinity; else v = dfJavaParseDouble(raw);
      if (v === null) return nfe();
      return { value: k === 'float' ? Math.fround(v) : v, error: null };
    }
    if (k === 'boolean') {
      if (/^true$/i.test(raw)) return { value: true, error: null };
      if (/^false$/i.test(raw)) return { value: false, error: null };
      return nfe('java.lang.IllegalArgumentException');
    }
    if (k === 'timestamp' || k === 'date') {
      const v = k === 'timestamp' ? dfParseTimestamp(raw) : dfParseDate(raw);
      if (v !== null) return { value: v, error: null };
      const e = dfCastInvalidInput(raw, 'string', k);
      return { value: null, error: { exception: 'org.apache.spark.SparkDateTimeException', message: e.df.message } };
    }
    if (k === 'decimal') { const v = dfParseDecimalStr(raw, type); return v === null ? nfe() : { value: v, error: null }; }
    return { value: raw, error: null };
  }
  // CSVInferSchema.inferField for one value
  function dfInferCsvField(typeSoFar, field) {
    if (field === null || field === undefined || field === '') return typeSoFar;
    const tryBoolean = () => (/^(true|false)$/i.test(field) ? 'boolean' : 'string');
    const tryTimestamp = () => (dfParseTimestamp(field) !== null ? 'timestamp' : tryBoolean());
    // prefersDate (default true): strict yyyy-MM-dd values infer as date, everything else falls to timestamp
    const tryDate = () => (/^\d{4}-\d{2}-\d{2}$/.test(field) && dfParseDate(field) !== null ? 'date' : tryTimestamp());
    const tryDouble = () => (dfJavaParseDouble(field) !== null || field === 'NaN' || field === 'Inf' || field === '-Inf' ? 'double' : tryDate());
    const tryDecimal = () => {
      const m = /^[+-]?(\d+)\.?$/.exec(field);
      if (m) { const p = m[1].replace(/^0+(?=\d)/, '').length; if (p <= 38) return 'decimal(' + p + ',0)'; }
      return tryDouble();
    };
    const tryLong = () => (dfParseIntegral(field, 'bigint') !== null ? 'bigint' : tryDecimal());
    const tryInt = () => (dfParseIntegral(field, 'int') !== null ? 'int' : tryLong());
    const k = dfTypeKind(typeSoFar);
    let t;
    if (k === 'null' || k === 'int') t = tryInt();
    else if (k === 'bigint') t = tryLong();
    else if (k === 'decimal') t = tryDecimal();
    else if (k === 'double') t = tryDouble();
    else if (k === 'date') t = tryDate();
    else if (k === 'timestamp') t = tryTimestamp();
    else if (k === 'boolean') t = tryBoolean();
    else return 'string';
    return dfCompatibleCsvType(typeSoFar, t) || 'string';
  }
  function dfCompatibleCsvType(a, b) {
    if (a === b) return a;
    const ka = dfTypeKind(a), kb = dfTypeKind(b);
    if (ka === 'null') return b;
    if (kb === 'null') return a;
    if (ka === 'string' || kb === 'string') return 'string';
    if ((ka === 'date' && kb === 'timestamp') || (ka === 'timestamp' && kb === 'date')) return 'timestamp';
    const rank = { int: 1, bigint: 2, double: 4 };
    if (rank[ka] && rank[kb]) return rank[ka] > rank[kb] ? a : b;
    const asDec = (t) => (dfTypeKind(t) === 'decimal' ? dfDecimalPS(t) : t === 'int' ? [10, 0] : t === 'bigint' ? [20, 0] : null);
    if ((ka === 'double' && kb === 'decimal') || (ka === 'decimal' && kb === 'double')) return 'double';
    const da = asDec(a), db = asDec(b);
    if (da && db) {
      const s = Math.max(da[1], db[1]);
      const p = Math.min(38, Math.max(da[0] - da[1], db[0] - db[1]) + s);
      return 'decimal(' + p + ',' + s + ')';
    }
    return null;
  }
  // Header names: empty -> _c<i>; duplicates (case-insensitive) -> name + index (CSVUtils.makeSafeHeader).
  function dfSafeHeader(tokens) {
    const names = tokens.map((t, i) => (t === null || t === '' ? '_c' + i : t));
    const lower = names.map((x) => x.toLowerCase());
    return names.map((x, i) => (lower.filter((y) => y === lower[i]).length > 1 ? x + i : x));
  }
  // Read CSV text (string or array of lines) like spark.read.csv(path, header=..., inferSchema=..., schema=..., mode=...).
  //   opts: { header=false, inferSchema=false, schema (DDL string or columns), mode='PERMISSIVE'|'FAILFAST', sep=',', path }
  // FAILFAST: the read itself succeeds (lazy); the table carries pendingError, thrown by actions that read the bad column.
  function dfReadCsv(input, opts) {
    opts = opts || {};
    const lines = (Array.isArray(input) ? input : String(input).split(/\r?\n/)).filter((l) => l !== '');
    const tokens = lines.map((l) => dfSplitCsvLine(l, opts.sep || ','));
    let names = null;
    if (opts.header && tokens.length) names = dfSafeHeader(tokens.shift());
    let columns;
    if (opts.schema) columns = dfColumnsFrom(opts.schema);
    else {
      const width = names ? names.length : tokens.length ? tokens[0].length : 0;
      if (!names) names = Array.from({ length: width }, (_, i) => '_c' + i);
      let types = names.map(() => 'string');
      if (opts.inferSchema) {
        types = names.map(() => 'null');
        for (const tk of tokens) for (let i = 0; i < names.length; i++) types[i] = dfInferCsvField(types[i], tk[i] === undefined ? null : tk[i]);
        types = types.map((t) => (t === 'null' ? 'string' : t));
      }
      columns = names.map((n, i) => ({ name: n, type: types[i], nullable: true }));
    }
    const failfast = String(opts.mode || 'PERMISSIVE').toUpperCase() === 'FAILFAST';
    const path = opts.path || null;
    let pending = null, pendingCols = [];
    const rows = tokens.map((tk) => {
      const errs = [];
      const row = columns.map((c, i) => {
        const r = dfCsvConvert(tk[i] === undefined ? null : tk[i], c.type);
        if (r.error) errs.push({ col: c.name, error: r.error });
        return r.value;
      });
      if (failfast && errs.length) {
        for (const e of errs) if (pendingCols.indexOf(e.col) < 0) pendingCols.push(e.col);
        if (!pending) pending = dfFailFastError(path, columns, row, errs[0].error);
      }
      return row;
    });
    const t = { columns, rows, source: { format: 'csv', path }, partitions: null, pendingError: pending ? pending.df : null, pendingColumns: pending ? pendingCols : null };
    return t;
  }
  function dfVolumeUri(path) {
    if (!path) return 'dbfs:' + DF_VOLUME + '/data.csv';
    return /^\/Volumes\//.test(path) ? 'dbfs:' + path : path;
  }
  // InternalRow.toString of the partial row: timestamps as microseconds, dates as days, null as null.
  function dfInternalRowString(columns, row) {
    return '[' + row.map((v, i) => {
      if (v === null) return 'null';
      const k = dfTypeKind(columns[i].type);
      if (k === 'timestamp') return String(dfTsToMicros(v));
      if (k === 'date') return String(dfDateToDays(v));
      return dfFormatValue(v, columns[i].type, true);
    }).join(',') + ']';
  }
  function dfFailFastError(path, columns, row, cause) {
    return dfMakeError({
      cls: 'SparkException', errorClass: 'FAILED_READ_FILE.NO_HINT', sqlState: 'KD001',
      message: '[FAILED_READ_FILE.NO_HINT] Encountered error while reading file ' + dfVolumeUri(path) + '.  SQLSTATE: KD001',
      causes: [
        'Caused by: org.apache.spark.SparkException: [MALFORMED_RECORD_IN_PARSING.WITHOUT_SUGGESTION] Malformed records are detected in record parsing: ' +
          dfInternalRowString(columns, row) + ".\nParse Mode: FAILFAST. To process malformed records as null result, try setting the option 'mode' as 'PERMISSIVE'.  SQLSTATE: 22023",
        'Caused by: ' + cause.exception + ': ' + cause.message,
      ],
    });
  }

  // ------------------------------------------------------------------------------------------
  // JSON Lines reading with Spark's schema inference (fields sorted by name; integers -> bigint,
  // other numbers -> double; null-only -> string).
  // ------------------------------------------------------------------------------------------
  function dfJsonParse(text) {
    const p = { s: text, i: 0 };
    const ws = () => { while (p.i < p.s.length && /\s/.test(p.s[p.i])) p.i++; };
    const val = () => {
      ws();
      const ch = p.s[p.i];
      if (ch === '{') {
        p.i++; const o = {}; ws();
        if (p.s[p.i] === '}') { p.i++; return { $obj: o }; }
        for (;;) {
          ws(); const k = str(); ws(); p.i++; // :
          o[k] = val(); ws();
          if (p.s[p.i] === ',') { p.i++; continue; }
          p.i++; break;
        }
        return { $obj: o };
      }
      if (ch === '[') {
        p.i++; const a = []; ws();
        if (p.s[p.i] === ']') { p.i++; return { $arr: a }; }
        for (;;) { a.push(val()); ws(); if (p.s[p.i] === ',') { p.i++; continue; } p.i++; break; }
        return { $arr: a };
      }
      if (ch === '"') return str();
      if (p.s.startsWith('true', p.i)) { p.i += 4; return true; }
      if (p.s.startsWith('false', p.i)) { p.i += 5; return false; }
      if (p.s.startsWith('null', p.i)) { p.i += 4; return null; }
      const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(p.s.slice(p.i));
      if (!m) throw new Error('bad JSON at ' + p.i);
      p.i += m[0].length;
      return { $num: +m[0], $int: !m[1] && !m[2] };
    };
    const str = () => {
      let out = ''; p.i++;
      while (p.s[p.i] !== '"') {
        if (p.s[p.i] === '\\') {
          const e = p.s[p.i + 1];
          if (e === 'u') { out += String.fromCharCode(parseInt(p.s.slice(p.i + 2, p.i + 6), 16)); p.i += 6; continue; }
          out += { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '/': '/', '\\': '\\', '"': '"' }[e];
          p.i += 2; continue;
        }
        out += p.s[p.i++];
      }
      p.i++;
      return out;
    };
    return val();
  }
  function dfJsonInfer(v) {
    if (v === null) return 'null';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'boolean') return 'boolean';
    if (v.$num !== undefined) return v.$int && Number.isSafeInteger(v.$num) ? 'bigint' : 'double';
    if (v.$arr) return { type: 'array', elementType: v.$arr.reduce((t, e) => dfJsonMerge(t, dfJsonInfer(e)), 'null'), containsNull: true };
    const keys = Object.keys(v.$obj).sort(dfCmpStr);
    return { type: 'struct', fields: keys.map((k) => ({ name: k, type: dfJsonInfer(v.$obj[k]), nullable: true })) };
  }
  function dfJsonMerge(a, b) {
    const ka = dfTypeKind(a), kb = dfTypeKind(b);
    if (ka === 'null') return b;
    if (kb === 'null') return a;
    if (ka === 'struct' && kb === 'struct') {
      const names = [];
      for (const f of a.fields.concat(b.fields)) if (names.indexOf(f.name) < 0) names.push(f.name);
      names.sort(dfCmpStr);
      return { type: 'struct', fields: names.map((n) => {
        const fa = a.fields.find((f) => f.name === n), fb = b.fields.find((f) => f.name === n);
        return { name: n, type: fa && fb ? dfJsonMerge(fa.type, fb.type) : (fa || fb).type, nullable: true };
      }) };
    }
    if (ka === 'array' && kb === 'array') return { type: 'array', elementType: dfJsonMerge(a.elementType, b.elementType), containsNull: true };
    if (ka === kb) return a;
    if ((ka === 'bigint' && kb === 'double') || (ka === 'double' && kb === 'bigint')) return 'double';
    return 'string';
  }
  function dfJsonCanon(t) {
    const k = dfTypeKind(t);
    if (k === 'null') return 'string';
    if (k === 'array') return { type: 'array', elementType: dfJsonCanon(t.elementType), containsNull: true };
    if (k === 'struct') return { type: 'struct', fields: t.fields.map((f) => ({ name: f.name, type: dfJsonCanon(f.type), nullable: true })) };
    return t;
  }
  function dfJsonToValue(v, t) {
    if (v === null || v === undefined) return null;
    const k = dfTypeKind(t);
    if (k === 'string') {
      if (typeof v === 'string') return v;
      return dfJsonText(v);
    }
    if (k === 'bigint' || k === 'double') return v.$num !== undefined ? v.$num : null;
    if (k === 'boolean') return typeof v === 'boolean' ? v : null;
    if (k === 'array') return v.$arr ? v.$arr.map((e) => dfJsonToValue(e, t.elementType)) : null;
    if (k === 'struct') {
      if (!v.$obj) return null;
      const o = {};
      for (const f of t.fields) o[f.name] = dfJsonToValue(v.$obj[f.name], f.type);
      return o;
    }
    return null;
  }
  function dfJsonText(v) {
    if (v === null) return 'null';
    if (typeof v === 'string') return JSON.stringify(v);
    if (typeof v === 'boolean') return String(v);
    if (v.$num !== undefined) return String(v.$num);
    if (v.$arr) return '[' + v.$arr.map(dfJsonText).join(',') + ']';
    return '{' + Object.keys(v.$obj).map((k) => JSON.stringify(k) + ':' + dfJsonText(v.$obj[k])).join(',') + '}';
  }
  // spark.read.json(path) on JSON Lines text (one object per line). opts: { path, schema? }
  function dfReadJson(input, opts) {
    opts = opts || {};
    const lines = (Array.isArray(input) ? input : String(input).split(/\r?\n/)).filter((l) => l.trim() !== '');
    const parsed = lines.map(dfJsonParse);
    let columns;
    if (opts.schema) columns = dfColumnsFrom(opts.schema);
    else {
      const t = dfJsonCanon(parsed.reduce((acc, v) => dfJsonMerge(acc, dfJsonInfer(v)), 'null'));
      columns = t.fields || [];
    }
    const st = { type: 'struct', fields: columns };
    const rows = parsed.map((v) => { const o = dfJsonToValue(v, st) || {}; return columns.map((c) => (o[c.name] === undefined ? null : o[c.name])); });
    return { columns, rows, source: { format: 'json', path: opts.path || null }, partitions: null, pendingError: null, pendingColumns: null };
  }

  // ------------------------------------------------------------------------------------------
  // Comparison, hashing (group order), casts
  // ------------------------------------------------------------------------------------------
  function dfCmpStr(a, b) {
    if (a === b) return 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = a.codePointAt(i), y = b.codePointAt(i);
      if (x !== y) return x < y ? -1 : 1;
      if (x > 0xffff) i++;
    }
    return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
  }
  // Total order used by orderBy/min/max (nulls handled by callers). NaN is the largest double; -0.0 == 0.0.
  function dfCompareValues(a, b, t) {
    const k = dfTypeKind(t);
    if (k === 'string' || k === 'timestamp' || k === 'date') return dfCmpStr(a, b);
    if (k === 'boolean') return a === b ? 0 : a ? 1 : -1;
    if (k === 'decimal') { const x = +a, y = +b; return x < y ? -1 : x > y ? 1 : 0; }
    if (k === 'struct') {
      for (const f of t.fields) { const c = dfCompareNullable(a[f.name], b[f.name], f.type, true); if (c) return c; }
      return 0;
    }
    if (k === 'array') {
      for (let i = 0; i < Math.min(a.length, b.length); i++) { const c = dfCompareNullable(a[i], b[i], t.elementType, true); if (c) return c; }
      return a.length - b.length;
    }
    const an = Number.isNaN(a), bn = Number.isNaN(b);
    if (an || bn) return an && bn ? 0 : an ? 1 : -1;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function dfCompareNullable(a, b, t, nullsFirst) {
    const an = a === null || a === undefined, bn = b === null || b === undefined;
    if (an || bn) return an && bn ? 0 : an ? (nullsFirst ? -1 : 1) : nullsFirst ? 1 : -1;
    return dfCompareValues(a, b, t);
  }
  // Murmur3 x86_32 exactly as org.apache.spark.unsafe.hash.Murmur3_x86_32 (incl. the legacy byte tail).
  function dfMixK1(k1) { k1 = Math.imul(k1, 0xcc9e2d51 | 0); k1 = (k1 << 15) | (k1 >>> 17); return Math.imul(k1, 0x1b873593); }
  function dfMixH1(h1, k1) { h1 ^= k1; h1 = (h1 << 13) | (h1 >>> 19); return (Math.imul(h1, 5) + (0xe6546b64 | 0)) | 0; }
  function dfFmix(h1, len) {
    h1 ^= len; h1 ^= h1 >>> 16; h1 = Math.imul(h1, 0x85ebca6b | 0); h1 ^= h1 >>> 13; h1 = Math.imul(h1, 0xc2b2ae35 | 0); h1 ^= h1 >>> 16;
    return h1;
  }
  function dfHashInt(v, seed) { return dfFmix(dfMixH1(seed, dfMixK1(v | 0)), 4); }
  function dfHashLongParts(lo, hi, seed) { return dfFmix(dfMixH1(dfMixH1(seed, dfMixK1(lo)), dfMixK1(hi)), 8); }
  function dfHashLong(v, seed) {
    const b = BigInt.asUintN(64, BigInt(v));
    return dfHashLongParts(Number(b & 0xffffffffn) | 0, Number(b >> 32n) | 0, seed);
  }
  function dfUtf8(s) {
    const out = [];
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function dfHashBytes(bytes, seed) {
    const n = bytes.length, aligned = n - (n % 4);
    let h1 = seed;
    for (let i = 0; i < aligned; i += 4) h1 = dfMixH1(h1, dfMixK1(bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24)));
    for (let i = aligned; i < n; i++) h1 = dfMixH1(h1, dfMixK1((bytes[i] << 24) >> 24));
    return dfFmix(h1, n);
  }
  function dfHashValue(v, t, seed) {
    if (v === null || v === undefined) return seed;
    const k = dfTypeKind(t);
    if (k === 'int' || k === 'smallint' || k === 'tinyint') return dfHashInt(v, seed);
    if (k === 'boolean') return dfHashInt(v ? 1 : 0, seed);
    if (k === 'date') return dfHashInt(dfDateToDays(v), seed);
    if (k === 'bigint') return dfHashLong(v, seed);
    if (k === 'timestamp') return dfHashLong(dfTsToMicros(v), seed);
    if (k === 'double') {
      const dv = new DataView(new ArrayBuffer(8));
      dv.setFloat64(0, v === 0 ? 0 : Number.isNaN(v) ? NaN : v, true);
      return dfHashLongParts(dv.getInt32(0, true), dv.getInt32(4, true), seed);
    }
    if (k === 'float') {
      const dv = new DataView(new ArrayBuffer(4));
      dv.setFloat32(0, v === 0 ? 0 : Number.isNaN(v) ? NaN : v, true);
      return dfHashInt(dv.getInt32(0, true), seed);
    }
    if (k === 'string') return dfHashBytes(dfUtf8(v), seed);
    if (k === 'decimal') return dfHashLong(BigInt(String(v).replace('.', '')), seed);
    if (k === 'struct') return t.fields.reduce((h, f) => dfHashValue(v[f.name], f.type, h), seed);
    if (k === 'array') return v.reduce((h, e) => dfHashValue(e, t.elementType, h), seed);
    return dfHashBytes(dfUtf8(String(v)), seed);
  }
  // Partition id of a grouping key under HashPartitioning(keys, 200)
  function dfHashPartition(values, types, numPartitions) {
    let h = DF_HASH_SEED;
    values.forEach((v, i) => { h = dfHashValue(v, types[i], h); });
    const n = numPartitions || DF_SHUFFLE_PARTITIONS;
    return ((h % n) + n) % n;
  }
  function dfKeyString(values, types) {
    return JSON.stringify(values.map((v, i) => {
      if (v === null || v === undefined) return null;
      const k = dfTypeKind(types[i]);
      if ((k === 'double' || k === 'float') && Number.isNaN(v)) return 'NaN';
      if ((k === 'double' || k === 'float') && v === 0) return 0;
      return v;
    }));
  }
  // ANSI cast of one value (withColumn(..., col.cast(t)), implicit casts). try=true -> null instead of an error.
  function dfCastValue(v, from, to, opt) {
    opt = opt || {};
    if (v === null || v === undefined) return null;
    const kf = dfTypeKind(from), kt = dfTypeKind(to);
    const fail = () => { if (opt.try) return null; throw dfCastInvalidInput(dfFormatValue(v, from, false), from, to, opt.context); };
    if (kf === kt && kf !== 'decimal') return v;
    if (kt === 'string') return dfFormatValue(v, from, false);
    if (kf === 'string') {
      const s = dfTrimAll(v);
      if (dfIsIntegral(to)) { const r = dfParseIntegral(s, to); return r === null ? fail() : r; }
      if (kt === 'double' || kt === 'float') {
        let d = dfJavaParseDouble(s);
        if (d === null) { const l = s.toLowerCase(); d = l === 'inf' || l === '+inf' || l === 'infinity' || l === '+infinity' ? Infinity : l === '-inf' || l === '-infinity' ? -Infinity : l === 'nan' ? NaN : null; }
        if (d === null) return fail();
        return kt === 'float' ? Math.fround(d) : d;
      }
      if (kt === 'boolean') {
        const l = s.toLowerCase();
        if (['t', 'true', 'y', 'yes', '1'].indexOf(l) >= 0) return true;
        if (['f', 'false', 'n', 'no', '0'].indexOf(l) >= 0) return false;
        return fail();
      }
      if (kt === 'timestamp') { const r = dfParseTimestamp(s); return r === null ? fail() : r; }
      if (kt === 'date') { const r = dfParseDate(s); return r === null ? fail() : r; }
      if (kt === 'decimal') { const r = dfParseDecimalStr(s, to); return r === null ? fail() : r; }
    }
    if (dfIsNumericType(from) || kf === 'boolean') {
      const x = kf === 'boolean' ? (v ? 1 : 0) : +v;
      if (dfIsIntegral(to)) {
        if (Number.isNaN(x) || !Number.isFinite(x)) return opt.try ? null : fail();
        const r = Math.trunc(x);
        const range = dfIntRange(to);
        if (range && (r < range[0] || r > range[1])) return opt.try ? null : fail();
        return r === 0 ? 0 : r;
      }
      if (kt === 'double') return x;
      if (kt === 'float') return Math.fround(x);
      if (kt === 'boolean') return x !== 0;
      if (kt === 'decimal') return dfParseDecimalStr(String(x), to);
    }
    if (kf === 'timestamp' && kt === 'date') return v.slice(0, 10);
    if (kf === 'date' && kt === 'timestamp') return v + ' 00:00:00';
    if (kf === 'timestamp' && (kt === 'bigint' || kt === 'int')) return Math.floor(dfTsToMicros(v) / 1e6);
    return fail();
  }

  // ------------------------------------------------------------------------------------------
  // Expressions. A column expression is:
  //   'name' | 'a.b.c' (nested path, case-insensitive) | '*' | 'a.*'
  //   { col: 'a.b', alias? }            { lit: value, type?, alias? }
  //   { cast: 'float', col | expr, alias? } -> default name CAST(x AS FLOAT)
  //   { explode: 'payload.commits' | expr, alias? } -> default name 'col'
  //   { dateTrunc: 'hour', col, alias? } -> default name date_trunc(hour, col)
  //   { op: '+'|'-'|'*'|'/', left, right, alias? } -> default name (a * 2)
  //   { js: function(rowObj), type, name } (escape hatch; rowObj = {colName: value})
  // ------------------------------------------------------------------------------------------
  function dfFindColumn(columns, name) {
    const l = String(name).toLowerCase();
    for (let i = 0; i < columns.length; i++) if (columns[i].name === name) return i;
    for (let i = 0; i < columns.length; i++) if (columns[i].name.toLowerCase() === l) return i;
    return -1;
  }
  function dfResolvePath(table, path) {
    const parts = Array.isArray(path) ? path : dfParseAttributeName(path);
    const cols = table.columns;
    const idx = dfFindColumn(cols, parts[0]);
    if (idx < 0) {
      if (parts[0].toLowerCase() === '_metadata' && table.source && table.source.path) {
        const meta = { file_path: dfVolumeUri(table.source.path), file_name: table.source.path.split('/').pop() };
        const f = (parts[1] || 'file_path').toLowerCase();
        if (meta[f] === undefined) throw dfFieldNotFoundError(parts[1], ['file_path', 'file_name', 'file_size', 'file_block_start', 'file_block_length', 'file_modification_time']);
        return { name: parts[1] || '_metadata', type: 'string', eval: () => meta[f], ref: parts };
      }
      throw dfUnresolvedColumnError(parts, cols.map((c) => c.name));
    }
    let type = cols[idx].type;
    let getter = (row) => row[idx];
    for (let k = 1; k < parts.length; k++) {
      const p = parts[k];
      let kind = dfTypeKind(type);
      let inArray = false;
      let st = type;
      if (kind === 'array' && dfTypeKind(type.elementType) === 'struct') { inArray = true; st = type.elementType; kind = 'struct'; }
      if (kind !== 'struct') {
        throw dfMakeError({ cls: 'AnalysisException', errorClass: 'INVALID_EXTRACT_BASE_FIELD_TYPE', sqlState: '42000',
          message: dfSparkMessage('INVALID_EXTRACT_BASE_FIELD_TYPE', 'Can\'t extract a value from "' + parts.slice(0, k).join('.') + '". Need a complex type [STRUCT, ARRAY, MAP] but got "' + dfSqlTypeName(type) + '".', '42000') });
      }
      let fi = st.fields.findIndex((f) => f.name === p);
      if (fi < 0) fi = st.fields.findIndex((f) => f.name.toLowerCase() === p.toLowerCase());
      if (fi < 0) throw dfFieldNotFoundError(p, st.fields.map((f) => f.name));
      const fname = st.fields[fi].name;
      const prev = getter;
      if (inArray) {
        getter = (row) => { const a = prev(row); return a == null ? null : a.map((e) => (e == null ? null : e[fname])); };
        type = { type: 'array', elementType: st.fields[fi].type, containsNull: true };
      } else {
        getter = (row) => { const o = prev(row); return o == null ? null : o[fname]; };
        type = st.fields[fi].type;
      }
    }
    return { name: parts[parts.length - 1], type, eval: getter, ref: parts };
  }
  function dfLitType(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'string') return 'string';
    if (Number.isInteger(v)) return v >= -2147483648 && v <= 2147483647 ? 'int' : 'bigint';
    return 'double';
  }
  function dfExprLabel(e) {
    if (typeof e === 'string') return e;
    if (typeof e === 'number' || typeof e === 'boolean' || e === null) return String(e);
    if (e.alias) return e.alias;
    if (e.col !== undefined && e.cast === undefined && e.dateTrunc === undefined) return e.col;
    if (e.lit !== undefined) return String(e.lit);
    return dfCompileExpr({ columns: [], rows: [] }, e).name;
  }
  function dfArithType(a, b, op) {
    if (op === '/') return 'double';
    const ka = dfTypeKind(a), kb = dfTypeKind(b);
    if (ka === 'double' || kb === 'double' || ka === 'string' || kb === 'string') return 'double';
    if (ka === 'float' || kb === 'float') return 'float';
    if (ka === 'bigint' || kb === 'bigint') return 'bigint';
    return 'int';
  }
  function dfCompileExpr(table, e) {
    if (typeof e === 'number' || typeof e === 'boolean' || e === null) return { name: String(e), type: dfLitType(e), eval: () => e };
    if (typeof e === 'string') { const r = dfResolvePath(table, e); return { name: r.name, type: r.type, eval: r.eval }; }
    let out;
    if (e.js) out = { name: e.name || 'js', type: dfNormType(e.type || 'string'), eval: (row) => e.js(dfRowObject(table, row)) };
    else if (e.lit !== undefined) out = { name: String(e.lit), type: e.type ? dfNormType(e.type) : dfLitType(e.lit), eval: () => e.lit };
    else if (e.cast) {
      const src = dfCompileExpr(table, e.expr || e.col);
      const to = dfNormType(e.cast);
      out = { name: 'CAST(' + src.name + ' AS ' + dfSqlTypeName(to) + ')', type: to, eval: (row) => dfCastValue(src.eval(row), src.type, to, { context: 'cast', try: !!e.try }) };
    } else if (e.explode) {
      const src = dfCompileExpr(table, e.explode);
      out = { name: 'col', type: dfTypeKind(src.type) === 'array' ? src.type.elementType : 'string', eval: src.eval, explode: true };
    } else if (e.dateTrunc) {
      const src = dfCompileExpr(table, e.col);
      out = { name: 'date_trunc(' + e.dateTrunc + ', ' + (typeof e.col === 'string' ? e.col : src.name) + ')', type: 'timestamp', eval: (row) => dfDateTrunc(e.dateTrunc, dfCastValue(src.eval(row), src.type, 'timestamp', { try: true })) };
    } else if (e.op) {
      const l = dfCompileExpr(table, e.left), r = dfCompileExpr(table, e.right);
      const t = dfArithType(l.type, r.type, e.op);
      out = { name: '(' + l.name + ' ' + e.op + ' ' + r.name + ')', type: t, eval: (row) => {
        const a = l.eval(row), b = r.eval(row);
        if (a === null || a === undefined || b === null || b === undefined) return null;
        const x = dfTypeKind(l.type) === 'string' ? dfCastValue(a, 'string', 'double') : +a;
        const y = dfTypeKind(r.type) === 'string' ? dfCastValue(b, 'string', 'double') : +b;
        let v;
        if (e.op === '+') v = x + y; else if (e.op === '-') v = x - y; else if (e.op === '*') v = x * y;
        else { if (y === 0) return null; v = x / y; }
        if (t === 'float') return Math.fround(v);
        if (dfIsIntegral(t)) return Math.trunc(v);
        return v;
      } };
    } else if (e.col !== undefined) { const r = dfResolvePath(table, e.col); out = { name: r.name, type: r.type, eval: r.eval }; }
    else throw new Error('dfCompileExpr: unknown expression ' + JSON.stringify(e));
    if (e.alias) out.name = e.alias;
    return out;
  }
  function dfRowObject(table, row) { const o = {}; table.columns.forEach((c, i) => { o[c.name] = row[i]; }); return o; }
  function dfExpandStar(table, exprs) {
    const out = [];
    for (const e of exprs) {
      if (e === '*') { for (const c of table.columns) out.push(c.name); continue; }
      if (typeof e === 'string' && /\.\*$/.test(e)) {
        const r = dfResolvePath(table, e.slice(0, -2));
        const st = r.type;
        if (dfTypeKind(st) !== 'struct') throw dfMakeError({ cls: 'AnalysisException', errorClass: 'CANNOT_RESOLVE_STAR_EXPAND', sqlState: '42704', message: 'Cannot expand ' + e });
        for (const f of st.fields) out.push({ js: null, _star: { base: e.slice(0, -2), field: f.name } });
        continue;
      }
      out.push(e);
    }
    return out.map((e) => (e && e._star ? { col: dfParseAttributeName(e._star.base).concat([e._star.field]).map(dfQuoteIdent).join('.'), alias: e._star.field } : e));
  }
  // df.select(*exprs)
  function dfSelect(table, exprs) {
    exprs = dfExpandStar(table, Array.isArray(exprs) ? exprs : [exprs]);
    const comp = exprs.map((e) => dfCompileExpr(table, e));
    const columns = comp.map((c) => ({ name: c.name, type: c.type, nullable: true }));
    const ex = comp.findIndex((c) => c.explode);
    const rows = [];
    const sizes = [];
    for (const part of dfRowsByPartition(table)) {
      const before = rows.length;
      for (const r of part) {
        if (ex < 0) { rows.push(comp.map((c) => c.eval(r))); continue; }
        const arr = comp[ex].eval(r);
        if (!arr || !arr.length) continue;
        for (const el of arr) rows.push(comp.map((c, i) => (i === ex ? el : c.eval(r))));
      }
      sizes.push(rows.length - before);
    }
    const out = dfWithRows(table, columns, rows, { partitions: table.partitions ? sizes : null });
    if (out.pendingColumns) {
      const keep = out.pendingColumns.filter((pc) => exprs.some((e) => typeof e === 'string' && dfParseAttributeName(e)[0].toLowerCase() === pc.toLowerCase()));
      if (!keep.length) { out.pendingError = null; out.pendingColumns = null; } else out.pendingColumns = keep;
    }
    return out;
  }
  // df.withColumn(name, expr): replaces a same-named column in place, else appends.
  function dfWithColumn(table, name, expr) {
    const c = dfCompileExpr(table, expr);
    const idx = dfFindColumn(table.columns, name);
    const columns = table.columns.slice();
    const col = { name, type: c.type, nullable: true };
    if (c.explode) {
      const exprs = table.columns.map((x) => dfQuoteIdent(x.name));
      const e2 = Object.assign({}, typeof expr === 'object' ? expr : { col: expr }, { alias: name });
      if (idx >= 0) exprs[idx] = e2; else exprs.push(e2);
      return dfSelect(table, exprs);
    }
    if (idx >= 0) columns[idx] = col; else columns.push(col);
    const rows = table.rows.map((r) => { const v = c.eval(r); const nr = r.slice(); if (idx >= 0) nr[idx] = v; else nr.push(v); return nr; });
    return dfWithRows(table, columns, rows, { partitions: table.partitions });
  }
  function dfWithColumnRenamed(table, from, to) {
    const idx = dfFindColumn(table.columns, from);
    if (idx < 0) return table;
    const columns = table.columns.slice();
    columns[idx] = Object.assign({}, columns[idx], { name: to });
    return dfWithRows(table, columns, table.rows, { partitions: table.partitions });
  }
  // df.drop(*names): unknown names are ignored, like Spark.
  function dfDrop(table, names) {
    names = Array.isArray(names) ? names : [names];
    const keep = table.columns.map((c, i) => i).filter((i) => !names.some((n) => n.toLowerCase() === table.columns[i].name.toLowerCase()));
    const out = dfWithRows(table, keep.map((i) => table.columns[i]), table.rows.map((r) => keep.map((i) => r[i])), { partitions: table.partitions });
    if (out.pendingColumns) {
      out.pendingColumns = out.pendingColumns.filter((pc) => keep.some((i) => table.columns[i].name === pc));
      if (!out.pendingColumns.length) { out.pendingError = null; out.pendingColumns = null; }
    }
    return out;
  }

  // ------------------------------------------------------------------------------------------
  // Filters. Predicate spec:
  //   { col, op, value, valueType? }  op: '==' '=' '!=' '<>' '>' '>=' '<' '<=' 'isNull' 'isNotNull'
  //                                       'contains' 'startswith' 'endswith' 'like' 'rlike' 'isin'
  //   { and: [p, ...] }  { or: [p, ...] }  { not: p }  or a SQL string like "total_amount > 30 AND VendorID = 1"
  // Comparisons follow Spark 4 ANSI coercion: string vs integer -> both BIGINT (malformed string = CAST_INVALID_INPUT
  // error), string vs double -> DOUBLE, string vs timestamp -> TIMESTAMP (malformed -> NULL). 3-valued logic.
  // ------------------------------------------------------------------------------------------
  const DF_OP_DUNDER = { '==': '__eq__', '=': '__eq__', '!=': '__ne__', '<>': '__ne__', '>': '__gt__', '>=': '__ge__', '<': '__lt__', '<=': '__le__' };
  function dfCommonType(a, b) {
    const ka = dfTypeKind(a), kb = dfTypeKind(b);
    if (ka === kb && ka !== 'decimal') return a;
    if (ka === 'null') return b;
    if (kb === 'null') return a;
    const rank = { tinyint: 1, smallint: 2, int: 3, bigint: 4, decimal: 5, float: 6, double: 7 };
    if (rank[ka] && rank[kb]) {
      if (ka === 'decimal' || kb === 'decimal') return rank[ka] >= 6 || rank[kb] >= 6 ? 'double' : 'decimal(38,18)';
      return rank[ka] > rank[kb] ? a : b;
    }
    const other = ka === 'string' ? b : kb === 'string' ? a : null;
    if (other !== null) {
      const ko = dfTypeKind(other);
      if (dfIsIntegral(other)) return 'bigint';
      if (ko === 'double' || ko === 'float' || ko === 'decimal') return 'double';
      if (ko === 'timestamp' || ko === 'date' || ko === 'boolean') return other;
    }
    return 'string';
  }
  function dfCompilePred(table, p) {
    if (typeof p === 'string') return dfCompilePred(table, dfParseSqlPredicate(p));
    if (p.and) { const fs = p.and.map((q) => dfCompilePred(table, q)); return (row) => { let res = true; for (const f of fs) { const v = f(row); if (v === false) return false; if (v === null) res = null; } return res; }; }
    if (p.or) { const fs = p.or.map((q) => dfCompilePred(table, q)); return (row) => { let res = false; for (const f of fs) { const v = f(row); if (v === true) return true; if (v === null) res = null; } return res; }; }
    if (p.not) { const f = dfCompilePred(table, p.not); return (row) => { const v = f(row); return v === null ? null : !v; }; }
    const left = dfCompileExpr(table, p.left !== undefined ? p.left : p.col);
    const op = p.op || '==';
    if (op === 'isNull') return (row) => { const v = left.eval(row); return v === null || v === undefined; };
    if (op === 'isNotNull') return (row) => { const v = left.eval(row); return !(v === null || v === undefined); };
    const right = p.right !== undefined ? dfCompileExpr(table, p.right) : { name: String(p.value), type: p.valueType ? dfNormType(p.valueType) : dfLitType(p.value), eval: () => p.value };
    const asStr = (v, t) => (v === null || v === undefined ? null : dfTypeKind(t) === 'string' ? v : dfFormatValue(v, t, false));
    if (op === 'contains' || op === 'startswith' || op === 'endswith' || op === 'like' || op === 'rlike') {
      let re = null;
      if (op === 'like') re = new RegExp('^' + String(p.value).replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c).replace(/%/g, '[\\s\\S]*').replace(/_/g, '[\\s\\S]') + '$');
      if (op === 'rlike') re = new RegExp(String(p.value), p.flags || '');
      return (row) => {
        const s = asStr(left.eval(row), left.type), q = asStr(right.eval(row), right.type);
        if (s === null || q === null) return null;
        if (op === 'contains') return s.indexOf(q) >= 0;
        if (op === 'startswith') return s.startsWith(q);
        if (op === 'endswith') return s.endsWith(q);
        return re.test(s);
      };
    }
    if (op === 'isin') {
      const vals = p.value;
      return (row) => {
        const v = left.eval(row);
        if (v === null || v === undefined) return null;
        let sawNull = false;
        for (const x of vals) {
          if (x === null) { sawNull = true; continue; }
          const ct = dfCommonType(left.type, dfLitType(x));
          if (dfCompareValues(dfCastValue(v, left.type, ct), dfCastValue(x, dfLitType(x), ct), ct) === 0) return true;
        }
        return sawNull ? null : false;
      };
    }
    const ct = dfCommonType(left.type, right.type);
    const ctx = DF_OP_DUNDER[op] || op;
    const lenient = dfTypeKind(ct) === 'timestamp' || dfTypeKind(ct) === 'date';
    // A literal is cast once, up front (Spark constant-folds it: col == "Y" on an INT column fails even when
    // every value of the column is NULL).
    const isLit = p.right === undefined;
    const litVal = isLit && p.value !== null && p.value !== undefined ? dfCastValue(p.value, right.type, ct, { context: ctx, try: lenient }) : null;
    return (row) => {
      let a = left.eval(row), b = isLit ? litVal : right.eval(row);
      if (a === null || a === undefined || b === null || b === undefined) return null;
      a = dfCastValue(a, left.type, ct, { context: ctx, try: lenient });
      if (!isLit) b = dfCastValue(b, right.type, ct, { context: ctx, try: lenient });
      if (a === null || b === null) return null;
      const c = dfCompareValues(a, b, ct);
      const nan = dfTypeKind(ct) === 'double' && (Number.isNaN(a) || Number.isNaN(b));
      switch (op) {
        case '==': case '=': return c === 0;
        case '!=': case '<>': return c !== 0;
        case '>': return c > 0;
        case '>=': return c >= 0;
        case '<': return nan ? !Number.isNaN(a) : c < 0;
        case '<=': return c <= 0;
        default: throw new Error('dfFilter: unknown op ' + op);
      }
    };
  }
  // df.filter(pred) / df.where(pred)
  function dfFilter(table, pred) {
    const f = dfCompilePred(table, pred);
    const rows = [];
    const sizes = [];
    for (const part of dfRowsByPartition(table)) {
      const before = rows.length;
      for (const r of part) if (f(r) === true) rows.push(r);
      sizes.push(rows.length - before);
    }
    return dfWithRows(table, table.columns, rows, { partitions: table.partitions ? sizes : null });
  }
  // Minimal Spark SQL predicate parser: comparisons, IS [NOT] NULL, [NOT] LIKE, RLIKE, IN (...), AND/OR/NOT, ().
  function dfParseSqlPredicate(src) {
    const toks = [];
    const re = /\s*(?:(`(?:[^`]|``)+`(?:\.(?:`(?:[^`]|``)+`|[A-Za-z_][A-Za-z0-9_]*))*|[A-Za-z_][A-Za-z0-9_]*(?:\.(?:`(?:[^`]|``)+`|[A-Za-z_][A-Za-z0-9_]*))*)|(-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(==|!=|<>|<=|>=|=|<|>|\(|\)|,))/y;
    let m, pos = 0;
    while (pos < src.length) {
      re.lastIndex = pos;
      m = re.exec(src);
      if (!m) { if (/^\s*$/.test(src.slice(pos))) break; throw new Error('dfParseSqlPredicate: cannot parse at ' + src.slice(pos)); }
      pos = re.lastIndex;
      if (m[1]) {
        const up = m[1].toUpperCase();
        if (['AND', 'OR', 'NOT', 'IS', 'NULL', 'LIKE', 'RLIKE', 'IN', 'TRUE', 'FALSE'].indexOf(up) >= 0) toks.push({ k: up });
        else toks.push({ k: 'id', v: m[1] });
      } else if (m[2]) toks.push({ k: 'num', v: +m[2], t: /[.eE]/.test(m[2]) ? 'double' : undefined });
      else if (m[3]) toks.push({ k: 'str', v: m[3].slice(1, -1).replace(/\\(.)/g, '$1') });
      else if (m[4]) toks.push({ k: m[4] });
    }
    let i = 0;
    const peek = () => toks[i] || { k: 'eof' };
    const next = () => toks[i++];
    const operand = () => {
      const t = next();
      if (t.k === 'id') return { isCol: true, v: t.v };
      if (t.k === 'num') return { v: t.v, t: t.t };
      if (t.k === 'str') return { v: t.v };
      if (t.k === 'TRUE' || t.k === 'FALSE') return { v: t.k === 'TRUE' };
      if (t.k === 'NULL') return { v: null };
      throw new Error('dfParseSqlPredicate: unexpected ' + t.k);
    };
    const flip = { '>': '<', '<': '>', '>=': '<=', '<=': '>=' };
    const cmp = () => {
      if (peek().k === '(') { next(); const e = or(); next(); return e; }
      const a = operand();
      const t = peek();
      if (t.k === 'IS') {
        next(); let neg = false; if (peek().k === 'NOT') { next(); neg = true; } next();
        return { col: a.v, op: neg ? 'isNotNull' : 'isNull' };
      }
      let neg = false;
      if (t.k === 'NOT') { next(); neg = true; }
      const o = next();
      if (o.k === 'LIKE' || o.k === 'RLIKE') { const b = operand(); const pr = { col: a.v, op: o.k.toLowerCase(), value: b.v }; return neg ? { not: pr } : pr; }
      if (o.k === 'IN') {
        next(); const vals = [];
        while (peek().k !== ')') { vals.push(operand().v); if (peek().k === ',') next(); }
        next();
        const pr = { col: a.v, op: 'isin', value: vals };
        return neg ? { not: pr } : pr;
      }
      const b = operand();
      if (a.isCol && b.isCol) return { left: a.v, op: o.k, right: b.v };
      if (a.isCol) return { col: a.v, op: o.k, value: b.v, valueType: b.t };
      return { col: b.v, op: flip[o.k] || o.k, value: a.v, valueType: a.t };
    };
    const not = () => { if (peek().k === 'NOT') { next(); return { not: not() }; } return cmp(); };
    const and = () => { const xs = [not()]; while (peek().k === 'AND') { next(); xs.push(not()); } return xs.length === 1 ? xs[0] : { and: xs }; };
    const or = () => { const xs = [and()]; while (peek().k === 'OR') { next(); xs.push(and()); } return xs.length === 1 ? xs[0] : { or: xs }; };
    return or();
  }

  // ------------------------------------------------------------------------------------------
  // groupBy / agg. Row order of an un-sorted aggregate emulates local Spark 4 (verified on 40+ real outputs):
  //  - HashAggregate (count/sum/avg/stddev, min/max/first of fixed-width types): every group goes to shuffle
  //    partition pmod(murmur3(keys, seed 42), 200). The reducer reads map partition 0's groups in partition-id
  //    order, then map partition 1's, ... (first occurrence wins). One input file = one map partition.
  //  - SortAggregate (min/max/first of a STRING/struct/array column): groups come out sorted by the keys
  //    (asc, NULLS FIRST).
  //  - { order: 'first' }: first-occurrence order (no Spark equivalent; for explanations).
  // Aggregates: { fn: 'count'|'sum'|'avg'|'mean'|'min'|'max'|'countDistinct'|'stddev'|'stddev_samp'|
  //               'variance'|'var_samp'|'first', col: 'x'|'*'|[cols], alias? }
  // Spark never guarantees this order: lessons should say "order not guaranteed" and add orderBy.
  // ------------------------------------------------------------------------------------------
  function dfGroupBy(table, keys, opts) {
    keys = Array.isArray(keys) ? keys : [keys];
    const comp = keys.map((k) => dfCompileExpr(table, k));
    return { kind: 'grouped', table, keys, comp, order: (opts && opts.order) || 'spark' };
  }
  function dfNormKey(v, t) {
    const k = dfTypeKind(t);
    if ((k === 'double' || k === 'float') && v === 0) return 0; // -0.0 groups (and prints) as 0.0
    return v;
  }
  function dfVarWidth(t) {
    const k = dfTypeKind(t);
    if (k === 'string' || k === 'struct' || k === 'array' || k === 'map') return true;
    return k === 'decimal' && dfDecimalPS(t)[0] > 18;
  }
  // HashAggregate's first-level "fast" hash map takes keys of these types only, and only keys with no NULL part;
  // other keys go to the regular map, which is emitted after the fast map.
  function dfFastMapKeys(types) {
    return types.every((t) => { const k = dfTypeKind(t); return k !== 'struct' && k !== 'array' && k !== 'map'; });
  }
  // -> [{ vals, parts: [rows of partition 0, rows of partition 1, ...] }] in Spark output order
  //   noAggs (distinct / dropDuplicates()): the FINAL aggregate also uses the fast map, so groups whose key has a
  //   NULL come out after all the others (verified on 9 real outputs, engine/probe/probe8.json).
  function dfGroups(g, sortBased, noAggs) {
    const table = g.table;
    const types = g.comp.map((c) => c.type);
    const ranges = dfPartRanges(table);
    const index = new Map();
    const groups = [];
    const perPart = ranges.map(() => []);
    ranges.forEach((rg, p) => {
      for (let i = rg[0]; i < rg[1]; i++) {
        const r = table.rows[i];
        const vals = g.comp.map((c, j) => dfNormKey(c.eval(r), types[j]));
        const key = dfKeyString(vals, types);
        let grp = index.get(key);
        if (!grp) { grp = { vals, parts: ranges.map(() => []), first: groups.length, seen: {} }; index.set(key, grp); groups.push(grp); }
        if (!grp.seen[p]) { grp.seen[p] = true; perPart[p].push(grp); }
        grp.parts[p].push(r);
      }
    });
    if (g.order === 'first') return groups;
    if (sortBased) {
      return groups.slice().sort((a, b) => {
        for (let j = 0; j < types.length; j++) { const c = dfCompareNullable(a.vals[j], b.vals[j], types[j], true); if (c) return c; }
        return a.first - b.first;
      });
    }
    const fast = dfFastMapKeys(types);
    for (const grp of groups) {
      grp.part = dfHashPartition(grp.vals, types);
      grp.slow = fast && grp.vals.some((v) => v === null || v === undefined) ? 1 : 0;
    }
    const out = [];
    const done = new Set();
    // map side: inside one shuffle partition, the partial aggregate emits fast-map (non-NULL) keys first
    perPart.forEach((list) => {
      list.map((grp, i) => ({ grp, i })).sort((a, b) => a.grp.part - b.grp.part || a.grp.slow - b.grp.slow || a.i - b.i)
        .forEach((x) => { if (!done.has(x.grp)) { done.add(x.grp); out.push(x.grp); } });
    });
    if (noAggs && fast) return out.filter((grp) => !grp.slow).concat(out.filter((grp) => grp.slow));
    return out;
  }
  function dfAggName(a) {
    if (a.alias) return a.alias;
    const fn = a.fn === 'mean' ? 'avg' : a.fn;
    const colName = (c) => (c === '*' || c === 1 ? '1' : dfExprLabel(c));
    if (fn === 'countDistinct') return 'count(DISTINCT ' + (Array.isArray(a.col) ? a.col : [a.col]).map(colName).join(', ') + ')';
    return fn + '(' + colName(a.col) + ')';
  }
  // CentralMomentAgg: Welford update inside a partition, then Spark's merge formula across partitions.
  function dfMoments(nums) {
    let n = 0, avg = 0, m2 = 0;
    for (const x of nums) {
      const newN = n + 1;
      const delta = x - avg;
      const deltaN = delta / newN;
      avg = avg + deltaN;
      m2 = m2 + delta * (delta - deltaN);
      n = newN;
    }
    return { n, avg, m2 };
  }
  function dfMergeMoments(a, b) {
    const n = a.n + b.n;
    const delta = b.avg - a.avg;
    const deltaN = n === 0 ? 0 : delta / n;
    return { n, avg: a.avg + deltaN * b.n, m2: a.m2 + b.m2 + delta * deltaN * a.n * b.n };
  }
  function dfMomentsParts(parts) {
    let acc = { n: 0, avg: 0, m2: 0 };
    for (const p of parts) if (p.length) acc = dfMergeMoments(acc, dfMoments(p));
    return acc;
  }
  // Sum/avg: partial sums per partition (0 + x1 + x2 ...), merged in partition order.
  function dfSumParts(parts) {
    let total = null, n = 0;
    for (const p of parts) {
      if (!p.length) continue;
      let s = 0;
      for (const x of p) s += x;
      total = (total === null ? 0 : total) + s;
      n += p.length;
    }
    return { sum: total, n };
  }
  function dfAggOne(table, a, parts) {
    const fn = a.fn === 'mean' ? 'avg' : a.fn;
    const rows = [].concat.apply([], parts);
    if (fn === 'count' && (a.col === '*' || a.col === 1 || a.col === undefined)) return { type: 'bigint', value: rows.length };
    if (fn === 'countDistinct') {
      const cs = (Array.isArray(a.col) ? a.col : [a.col]).map((c) => dfCompileExpr(table, c));
      const seen = new Set();
      for (const r of rows) {
        const vals = cs.map((c) => c.eval(r));
        if (vals.some((v) => v === null || v === undefined)) continue;
        seen.add(dfKeyString(vals, cs.map((c) => c.type)));
      }
      return { type: 'bigint', value: seen.size };
    }
    const c = dfCompileExpr(table, a.col);
    const valsOf = (rs) => rs.map((r) => c.eval(r)).filter((v) => v !== null && v !== undefined);
    const vals = valsOf(rows);
    if (fn === 'count') return { type: 'bigint', value: vals.length };
    if (fn === 'min' || fn === 'max') {
      if (!vals.length) return { type: c.type, value: null };
      let best = vals[0];
      for (const v of vals) { const cmp = dfCompareValues(v, best, c.type); if (fn === 'min' ? cmp < 0 : cmp > 0) best = v; }
      return { type: c.type, value: best };
    }
    if (fn === 'first') return { type: c.type, value: rows.length ? c.eval(rows[0]) : null };
    if (fn === 'sum' && dfIsIntegral(c.type)) return { type: 'bigint', value: vals.length ? vals.reduce((s, v) => s + v, 0) : null };
    const toNum = (v) => (dfTypeKind(c.type) === 'string' ? dfCastValue(v, 'string', 'double') : dfTypeKind(c.type) === 'decimal' ? +v : v);
    const numParts = parts.map((p) => valsOf(p).map(toNum).filter((v) => v !== null));
    if (fn === 'sum') return { type: 'double', value: dfSumParts(numParts).sum };
    if (fn === 'avg') { const s = dfSumParts(numParts); return { type: 'double', value: s.n ? s.sum / s.n : null }; }
    if (fn === 'stddev' || fn === 'stddev_samp' || fn === 'variance' || fn === 'var_samp') {
      const m = dfMomentsParts(numParts);
      if (m.n < 2) return { type: 'double', value: null };
      const variance = m.m2 / (m.n - 1);
      return { type: 'double', value: fn.indexOf('std') === 0 ? Math.sqrt(variance) : variance };
    }
    throw new Error('dfAgg: unknown function ' + a.fn);
  }
  // grouped.agg(...) or df.agg(...)
  function dfAgg(src, aggs, opts) {
    aggs = Array.isArray(aggs) ? aggs : [aggs];
    if (!src || src.kind !== 'grouped') src = dfGroupBy(src, [], opts);
    const table = src.table;
    const sortBased = aggs.some((a) => (a.fn === 'min' || a.fn === 'max' || a.fn === 'first') && a.col !== '*' && dfVarWidth(dfCompileExpr(table, a.col).type));
    const groups = src.keys.length ? dfGroups(src, sortBased, aggs.length === 0) : [{ vals: [], parts: dfRowsByPartition(table) }];
    const keyCols = src.comp.map((c) => ({ name: c.name, type: c.type, nullable: true }));
    const outRows = [];
    let aggCols = null;
    for (const g of groups) {
      const res = aggs.map((a) => dfAggOne(table, a, g.parts));
      if (!aggCols) aggCols = res.map((r, i) => ({ name: dfAggName(aggs[i]), type: r.type, nullable: true }));
      outRows.push(g.vals.concat(res.map((r) => r.value)));
    }
    if (!aggCols) aggCols = aggs.map((a) => ({ name: dfAggName(a), type: dfAggOne(table, a, [[]]).type, nullable: true }));
    return dfWithRows(table, keyCols.concat(aggCols), outRows);
  }
  // grouped.count() -> column 'count'
  function dfGroupCount(g) {
    return dfAgg(g, [{ fn: 'count', col: '*', alias: 'count' }]);
  }
  // GroupedData.sum/avg/mean/min/max('a', 'b'): numeric columns only (client-side PySparkTypeError otherwise).
  function dfGroupedAgg(g, fn, cols) {
    cols = Array.isArray(cols) ? cols : [cols];
    const bad = cols.filter((c) => !dfIsNumericType(dfCompileExpr(g.table, c).type));
    if (bad.length) {
      throw dfMakeError({ cls: 'PySparkTypeError', module: 'pyspark.errors.exceptions.base', errorClass: 'NOT_NUMERIC_COLUMNS',
        message: '[NOT_NUMERIC_COLUMNS] Numeric aggregation function can only be applied on numeric columns, got [' + bad.map((b) => dfPyStr(b)).join(', ') + '].' });
    }
    return dfAgg(g, cols.map((c) => ({ fn, col: c })));
  }
  // df.freqItems(cols, support = 0.01): Spark's one-pass frequent-items counter (CollectFrequentItems, capacity
  // floor(1/support)); approximate, so it can include false positives. The array lists the keys in Scala
  // mutable.HashMap iteration order: bucket improveHash(key.##) & (capacity - 1), then hash. Result: one row,
  // columns '<col>_freqItems' of type array<col type>.
  function dfScalaHash(v, t) {
    const k = dfTypeKind(t);
    const longHash = (x) => { if (Number.isSafeInteger(x) && (x | 0) === x) return x; const b = BigInt.asUintN(64, BigInt(x)); return Number((b ^ (b >> 32n)) & 0xffffffffn) | 0; };
    let h;
    if (k === 'string') h = dfHashBytes(dfUtf8(v), 42);
    else if (k === 'boolean') h = v ? 1231 : 1237;
    else if (k === 'bigint') h = longHash(v);
    else if (k === 'timestamp') h = longHash(dfTsToMicros(v));
    else if (k === 'date') h = dfDateToDays(v) | 0;
    else if (k === 'double' || k === 'float') {
      if (Number.isInteger(v) && Number.isSafeInteger(v)) h = longHash(v);
      else {
        const dv = new DataView(new ArrayBuffer(8));
        if (k === 'float' || Math.fround(v) === v) { dv.setFloat32(0, v, true); h = dv.getInt32(0, true); }
        else { dv.setFloat64(0, v, true); h = dv.getInt32(0, true) ^ dv.getInt32(4, true); }
      }
    } else h = v | 0;
    return h ^ (h >>> 16);
  }
  function dfFreqCounter(entries, size, t) {
    const m = new Map();
    let cap = 16;
    const put = (ks, v, c) => { if (m.size + 1 >= Math.floor(cap * 0.75)) cap *= 2; m.set(ks, { v, c }); };
    const add = (v, count) => {
      const ks = dfKeyString([v], [t]);
      const e = m.get(ks);
      if (e) { put(ks, v, e.c + count); return; }
      if (m.size < size) { put(ks, v, count); return; }
      let min = 0;
      if (m.size) { min = Infinity; for (const x of m.values()) min = Math.min(min, x.c); }
      if (count - min >= 0) {
        put(ks, v, count);
        for (const [key, x] of Array.from(m.entries())) if (!(x.c > min)) m.delete(key);
        for (const x of m.values()) x.c -= min;
      } else for (const x of m.values()) x.c -= count;
    };
    for (const en of entries) add(en.v, en.c);
    const order = Array.from(m.values()).map((x) => ({ v: x.v, c: x.c, h: dfScalaHash(x.v, t) }));
    order.sort((a, b) => ((a.h & (cap - 1)) - (b.h & (cap - 1))) || (a.h - b.h));
    return order;
  }
  function dfFreqItems(table, cols, support) {
    cols = Array.isArray(cols) ? cols : [cols];
    const s = support == null ? 0.01 : support;
    const size = Math.floor(1 / s);
    const outCols = [], vals = [];
    for (const col of cols) {
      const c = dfCompileExpr(table, col);
      const partials = dfRowsByPartition(table).map((rows) => dfFreqCounter(rows.map((r) => c.eval(r)).filter((v) => v !== null && v !== undefined).map((v) => ({ v, c: 1 })), size, c.type));
      const final = dfFreqCounter([].concat.apply([], partials), size, c.type);
      outCols.push({ name: c.name + '_freqItems', type: { type: 'array', elementType: c.type, containsNull: true }, nullable: true });
      vals.push(final.map((x) => x.v));
    }
    return dfWithRows(table, outCols, [vals]);
  }
  // df.distinct() / dropDuplicates(): hash order like groupBy, except that keys with a NULL part come last.
  function dfDistinct(table) {
    const g = dfGroupBy(table, table.columns.map((c) => dfQuoteIdent(c.name)));
    const out = dfAgg(g, []);
    return dfWithRows(table, table.columns, out.rows);
  }
  // ------------------------------------------------------------------------------------------
  // orderBy / sort: keys are 'col' | { col, desc?: true, nulls?: 'first'|'last' } | { desc: 'col' } | { asc: 'col' }.
  // Stable (equal keys keep their current order). asc -> NULLS FIRST, desc -> NULLS LAST.
  // ------------------------------------------------------------------------------------------
  function dfOrderBy(table, keys) {
    keys = Array.isArray(keys) ? keys : [keys];
    const specs = keys.map((k) => {
      let expr = k, desc = false, nulls = null;
      if (k && typeof k === 'object') {
        if (typeof k.desc === 'string' || (typeof k.desc === 'object' && k.desc !== null)) { expr = k.desc; desc = true; }
        else if (k.asc !== undefined && typeof k.asc !== 'boolean') { expr = k.asc; }
        else { expr = k.expr !== undefined ? k.expr : k.col; desc = !!k.desc; }
        nulls = k.nulls || null;
      }
      const c = dfCompileExpr(table, expr);
      return { c, desc, nullsFirst: nulls ? nulls === 'first' : !desc };
    });
    const idx = table.rows.map((r, i) => i);
    const vals = table.rows.map((r) => specs.map((s) => s.c.eval(r)));
    idx.sort((x, y) => {
      for (let j = 0; j < specs.length; j++) {
        const s = specs[j];
        const a = vals[x][j], b = vals[y][j];
        const an = a === null || a === undefined, bn = b === null || b === undefined;
        let c;
        if (an || bn) c = an && bn ? 0 : an ? (s.nullsFirst ? -1 : 1) : s.nullsFirst ? 1 : -1;
        else { c = dfCompareValues(a, b, s.c.type); if (s.desc) c = -c; }
        if (c) return c;
      }
      return x - y;
    });
    return dfWithRows(table, table.columns, idx.map((i) => table.rows[i]));
  }

  // ------------------------------------------------------------------------------------------
  // describe() / summary(): Spark's StatFunctions.summary. Numeric and string columns only.
  // count = non-null count; mean/stddev on the column cast to double (try_cast for strings, sample stddev n-1,
  // Welford); min/max on the ORIGINAL values (strings compare alphabetically!); percentiles = approx_percentile
  // with accuracy 10000 (exact at lesson sizes: the value at rank ceil(q*n) of the sorted non-null values).
  // All cells are strings (null -> NULL in show()).
  // ------------------------------------------------------------------------------------------
  function dfDescribe(table, cols) {
    return dfSummaryCore(table, ['count', 'mean', 'stddev', 'min', 'max'], cols && cols.length ? cols : null);
  }
  function dfSummary(table, stats) {
    return dfSummaryCore(table, stats && stats.length ? stats : ['count', 'mean', 'stddev', 'min', '25%', '50%', '75%', 'max'], null);
  }
  function dfSummaryCore(table, stats, cols) {
    dfCheckPending(table);
    let src = table;
    if (cols) src = dfSelect(table, cols);
    const use = src.columns.map((c, i) => ({ c, i })).filter((x) => dfIsNumericType(x.c.type) || dfTypeKind(x.c.type) === 'string');
    const outCols = [{ name: 'summary', type: 'string', nullable: true }].concat(use.map((x) => ({ name: x.c.name, type: 'string', nullable: true })));
    const byPart = dfRowsByPartition(src);
    const per = use.map((x) => {
      const t = x.c.type;
      const isStr = dfTypeKind(t) === 'string';
      const castOne = (v) => (isStr ? dfCastValue(v, 'string', 'double', { try: true }) : dfTypeKind(t) === 'decimal' ? +v : v);
      const rawParts = byPart.map((rows) => rows.map((r) => r[x.i]).filter((v) => v !== null && v !== undefined));
      const castedParts = rawParts.map((vs) => vs.map(castOne).filter((v) => v !== null));
      const raw = [].concat.apply([], rawParts);
      const casted = [].concat.apply([], castedParts);
      const castedType = isStr ? 'double' : t;
      return { t, raw, casted, castedParts, castedType };
    });
    const rows = stats.map((st) => {
      const s = String(st).toLowerCase();
      return [st].concat(per.map((p) => {
        if (s === 'count') return String(p.raw.length);
        if (s === 'mean') {
          if (!p.casted.length) return null;
          const sm = dfSumParts(p.castedParts);
          // avg(decimal(p,s)) is decimal(p+4, s+4) (approximated through doubles here)
          if (dfTypeKind(p.t) === 'decimal') return (sm.sum / sm.n).toFixed(dfDecimalPS(p.t)[1] + 4);
          return dfJavaDouble(sm.sum / sm.n);
        }
        if (s === 'stddev') { const m = dfMomentsParts(p.castedParts); return m.n < 2 ? null : dfJavaDouble(Math.sqrt(m.m2 / (m.n - 1))); }
        if (s === 'min' || s === 'max') {
          if (!p.raw.length) return null;
          let best = p.raw[0];
          for (const v of p.raw) { const c = dfCompareValues(v, best, p.t); if (s === 'min' ? c < 0 : c > 0) best = v; }
          return dfFormatValue(best, p.t, false);
        }
        if (/%$/.test(s)) {
          const q = parseFloat(s) / 100;
          const v = dfApproxPercentile(p.casted, q, p.castedType);
          return v === null ? null : dfFormatValue(v, p.castedType, false);
        }
        if (s === 'count_distinct') return String(new Set(p.raw.map((v) => JSON.stringify(v))).size);
        throw new Error('dfSummary: unknown statistic ' + st);
      }));
    });
    return dfWithRows(table, outCols, rows, { keepPending: false });
  }
  // approx_percentile(x, q, 10000) on small data (QuantileSummaries with no compression).
  function dfApproxPercentile(values, q, type) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => dfCompareValues(a, b, type));
    const relErr = 1 / 10000;
    if (q <= relErr) return sorted[0];
    if (q >= 1 - relErr) return sorted[sorted.length - 1];
    const rank = Math.ceil(q * sorted.length);
    return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
  }

  // ------------------------------------------------------------------------------------------
  // toPandas(): the text a notebook shows for df.toPandas() / df.limit(n).toPandas() (repr of a pandas 3
  // DataFrame, display.width 80, max_colwidth 50; Spark Connect's Arrow conversion decides the dtypes):
  //   int/bigint -> int32/int64 ('7'; with NULLs -> float64 'NaN'), double/float -> float64/float32 (6-digit
  //   fixed point, trailing zeros trimmed equally per column), timestamp -> datetime64 ('NaT'; date only when
  //   every time is 00:00:00), string -> str ('NaN'), boolean -> bool (with NULLs -> object 'None'),
  //   date/decimal/struct/array -> object (str() of the Python value, 'None').
  // Wide frames wrap into blocks ending in ' \'. Frames over 60 rows are printed in full (pandas would
  // truncate them; lessons never show that many).
  // ------------------------------------------------------------------------------------------
  function dfPandasKind(table, ci) {
    const t = table.columns[ci].type;
    const k = dfTypeKind(t);
    const hasNull = table.rows.some((r) => r[ci] === null || r[ci] === undefined);
    if (dfIsIntegral(t)) return hasNull ? 'float' : 'int';
    if (k === 'double' || k === 'float') return 'float';
    if (k === 'timestamp') return 'datetime';
    if (k === 'string') return 'str';
    if (k === 'boolean') return hasNull ? 'object' : 'bool';
    return 'object';
  }
  // str() of a value inside an object column (Python dict/list/date/Decimal/bool reprs)
  function dfPandasObjStr(v, t, top) {
    if (v === null || v === undefined) return 'None';
    const k = dfTypeKind(t);
    if (k === 'struct') return '{' + t.fields.map((f) => dfPyStr(f.name) + ': ' + dfPandasObjStr(v[f.name], f.type, false)).join(', ') + '}';
    if (k === 'array') return '[' + v.map((e) => dfPandasObjStr(e, t.elementType, false)).join(', ') + ']';
    if (k === 'date') return top ? v : dfPyValue(v, t);
    if (k === 'decimal') return top ? String(v) : "Decimal('" + v + "')";
    return dfPyValue(v, t);
  }
  function dfPandasFloatCells(vals, exp) {
    const num = /^\s*[+-]?[0-9]+\.[0-9]*$/;
    let out = vals.map((v) => {
      if (v === null || v === undefined || Number.isNaN(v)) return 'NaN';
      const s = exp ? dfPyExp(v, 6) : dfPyFixed(v, 6);
      return s[0] === '-' ? s : ' ' + s; // '{value: .6f}' leaves a space for the sign
    });
    if (exp) return out;
    // _trim_zeros_float: drop trailing zeros while EVERY fixed-point number ends in 0, keep one decimal
    for (;;) {
      const nums = out.filter((x) => num.test(x));
      if (!nums.length || !nums.every((x) => x.endsWith('0'))) break;
      out = out.map((x) => (num.test(x) ? x.slice(0, -1) : x));
    }
    return out.map((x) => (num.test(x) && x.endsWith('.') ? x + '0' : x));
  }
  function dfPandasFloats(vals) {
    const out = dfPandasFloatCells(vals, false);
    const live = vals.filter((v) => v !== null && v !== undefined && !Number.isNaN(v)).map(Math.abs);
    const tooLong = out.some((x) => x.length > 12);
    if (live.some((a) => a > 0 && a < 1e-6) || (tooLong && live.some((a) => a > 1e6))) return dfPandasFloatCells(vals, true);
    return out;
  }
  function dfPandasDatetimes(vals) {
    const live = vals.filter((v) => v !== null && v !== undefined);
    const fr = (v) => { const m = /\.(\d+)$/.exec(v); return m ? (m[1] + '000000').slice(0, 6) : '000000'; };
    if (live.every((v) => v.length === 10 || / 00:00:00$/.test(v))) return vals.map((v) => (v == null ? 'NaT' : v.slice(0, 10)));
    const us = live.some((v) => !/000$/.test(fr(v)));
    const ms = !us && live.some((v) => fr(v) !== '000000');
    return vals.map((v) => {
      if (v == null) return 'NaT';
      const base = v.length === 10 ? v + ' 00:00:00' : v.slice(0, 19);
      return base + (us ? '.' + fr(v) : ms ? '.' + fr(v).slice(0, 3) : '');
    });
  }
  // df.toPandas() repr. opts: { n? (rows, like limit(n)), width = 80, maxColWidth = 50 }
  function dfToPandasString(table, opts) {
    opts = opts || {};
    dfCheckPending(table);
    const width = opts.width || 80, maxw = opts.maxColWidth || 50;
    const t = opts.n == null ? table : dfLimit(table, opts.n);
    if (!t.rows.length || !t.columns.length) {
      return 'Empty DataFrame\nColumns: [' + t.columns.map((c) => c.name).join(', ') + ']\nIndex: [' + (t.columns.length ? '' : t.rows.map((r, i) => i).join(', ')) + ']';
    }
    const maxLen = (xs) => xs.reduce((m, x) => Math.max(m, x.length), 0);
    const cols = t.columns.map((c, ci) => {
      const kind = dfPandasKind(t, ci);
      const vals = t.rows.map((r) => r[ci]);
      let cells;
      if (kind === 'int') cells = vals.map((v) => (v < 0 ? '' : ' ') + String(v));
      else if (kind === 'float') cells = dfPandasFloats(vals);
      else if (kind === 'datetime') cells = dfPandasDatetimes(vals);
      else if (kind === 'str') cells = vals.map((v) => ' ' + (v == null ? 'NaN' : v));
      else if (kind === 'bool') cells = vals.map((v) => ' ' + (v ? 'True' : 'False'));
      else cells = vals.map((v) => ' ' + dfPandasObjStr(v, c.type, true));
      // numeric columns get a leading space in the header too
      const header = (kind === 'int' || kind === 'float' || kind === 'bool' ? ' ' : '') + c.name;
      // _make_fixed_width: width = max(cells, header) capped at max_colwidth; longer cells end in '...'
      const w = Math.min(Math.max(maxLen(cells), header.length), maxw);
      cells = cells.map((x) => dfPadLeft(x.length > w ? x.slice(0, w - 3) + '...' : x, w));
      return [dfPadLeft(header, Math.max(w, header.length))].concat(cells);
    });
    const idx = [''].concat(t.rows.map((r, i) => String(i)));
    const iw = maxLen(idx);
    // _binify: split the columns into blocks that fit the line width (index column + 1 space subtracted)
    const widths = cols.map(maxLen);
    const lw = width - (iw + 1);
    const bins = [];
    let cur = 0;
    widths.forEach((wd, i) => {
      cur += wd + 1;
      const wrap = (i === widths.length - 1 ? cur + 1 > lw : cur + 2 > lw) && i > 0;
      if (wrap) { bins.push(i); cur = wd + 1; }
    });
    bins.push(widths.length);
    // adjoin(1, ...): every column left-justified to its width + 1, the last one to its width
    const blocks = [];
    let start = 0;
    bins.forEach((end, b) => {
      const part = [idx].concat(cols.slice(start, end));
      if (bins.length > 1) part.push(b < bins.length - 1 ? [' \\'].concat(idx.slice(1).map(() => '  ')) : idx.map(() => ' '));
      const pw = part.map((col, j) => maxLen(col) + (j < part.length - 1 ? 1 : 0));
      blocks.push(idx.map((x, r) => part.map((col, j) => dfPadRight(col[r], pw[j])).join('')).join('\n'));
      start = end;
    });
    return blocks.join('\n\n');
  }

  // ------------------------------------------------------------------------------------------
  // Presentation helpers: Matrix props, ```text blocks, GFM tables.
  // ------------------------------------------------------------------------------------------
  // Escape plain text for KaTeX \text{...}
  function dfTexEscape(s) {
    let out = '';
    for (const ch of String(s)) {
      if (ch === '\\') out += '\\textbackslash{}';
      else if (ch === '~') out += '\\textasciitilde{}';
      else if (ch === '^') out += '\\textasciicircum{}';
      else if ('_%#&{}$'.indexOf(ch) >= 0) out += '\\' + ch;
      else out += ch;
    }
    return out;
  }
  function dfTexText(s) { return '\\text{' + dfTexEscape(s) + '}'; }
  // Matrix props { rows, cols, values, emptyLabel }. Cells are TeX \text{...} of the Spark show() text
  // (so 22.0 stays "22.0"); nulls stay null (shown as emptyLabel). opts: { cols?: [names], rows?: [indices],
  // rowLabels?: [labels] | 'index' (default, '0','1',...) | 'one' ('1','2',...), numbers?: 'text'|'raw', emptyLabel? }
  function dfToMatrix(table, opts) {
    opts = opts || {};
    const ci = opts.cols ? opts.cols.map((n) => { const i = dfFindColumn(table.columns, n); if (i < 0) throw dfUnresolvedColumnError(n, dfColumns(table)); return i; }) : table.columns.map((c, i) => i);
    const ri = opts.rows ? opts.rows : table.rows.map((r, i) => i);
    const labels = Array.isArray(opts.rowLabels) ? opts.rowLabels : ri.map((i, k) => String(opts.rowLabels === 'one' ? k + 1 : i));
    const values = ri.map((r) => ci.map((c) => {
      const v = table.rows[r][c];
      const t = table.columns[c].type;
      if (v === null || v === undefined) return null;
      if (opts.numbers === 'raw' && (dfIsIntegral(t) || dfTypeKind(t) === 'double' || dfTypeKind(t) === 'float') && Number.isFinite(v)) return v;
      return dfTexText(dfEscapeMeta(dfFormatValue(v, t, true)));
    }));
    return { rows: labels, cols: ci.map((c) => table.columns[c].name), values, emptyLabel: opts.emptyLabel || 'null' };
  }
  // Wrap any text (show() output, traceback) in a ```text fence for a Text widget. Trailing newlines are dropped.
  // The site interpolates {=x} and links [[id]] even inside fences, so a zero-width space is slipped into
  // '{=' and '[[' (invisible; pass { raw: true } to keep the text byte-exact).
  function dfToTextBlock(str, opts) {
    let s = String(str).replace(/\n+$/, '');
    if (!(opts && opts.raw)) s = s.replace(/\{=/g, '{​=').replace(/\[\[/g, '[​[');
    return '```text\n' + s + '\n```';
  }
  function dfShowBlock(table, opts) { return dfToTextBlock(dfShowString(table, opts)); }
  // GFM table of a table. opts: { nullText = '`NULL`', maxRows?, cols? }. Numbers right-aligned.
  // Escapes |, \, $ (the site turns $...$ into math), {= (interpolation) and [[ (glossary links).
  function dfToMarkdownTable(table, opts) {
    opts = opts || {};
    const ci = opts.cols ? opts.cols.map((n) => dfFindColumn(table.columns, n)) : table.columns.map((c, i) => i);
    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\$/g, '\\$').replace(/\{=/g, '{\u200B=').replace(/\[\[/g, '[\u200B[').replace(/\n/g, ' ');
    const nullText = opts.nullText === undefined ? '`NULL`' : opts.nullText;
    const rows = opts.maxRows != null ? table.rows.slice(0, opts.maxRows) : table.rows;
    const head = '| ' + ci.map((i) => esc(table.columns[i].name)).join(' | ') + ' |';
    const align = '|' + ci.map((i) => (dfIsNumericType(table.columns[i].type) ? ' ---: ' : ' --- ')).join('|') + '|';
    const body = rows.map((r) => '| ' + ci.map((i) => (r[i] === null || r[i] === undefined ? nullText : esc(dfFormatValue(r[i], table.columns[i].type, true)))).join(' | ') + ' |');
    return [head, align].concat(body).join('\n');
  }
  // PySpark-style aliases
  const dfWhere = dfFilter;
  const dfSort = dfOrderBy;
  const dfDropDuplicates = dfDistinct;
  // ===================================== END ENGINE ========================================

  // ==========================================================================================
  // Module code: spark-df-basics (Sessions 1-2). Everything below wraps the engine above.
  // Conventions (see SOURCE_NOTES.md): the lesson file is taxi12 (12 real trips, 10 columns) at
  // BASE + '/lessons/taxi12.csv'; ANSI mode on; names are case-insensitive; PERMISSIVE CSV mode turns
  // a value that does not fit the declared type into NULL. Every printed text comes from the engine,
  // which matches real Spark 4.0.1 byte for byte (examples.yaml checks it against truth.json).
  // ==========================================================================================
  const PATH12 = DF_VOLUME + '/lessons/taxi12.csv';
  const CSV_LINES = DF_TAXI12_CSV.split('\n').filter((l) => l.length > 0); // header + 12 trips
  const HEADER = CSV_LINES[0].split(',');
  const RAW = CSV_LINES.slice(1).map((l) => l.split(',')); // raw text cells (taxi12 has no quotes)
  const NROWS = RAW.length;
  const MODE_LABEL = {
    string: 'header=True only (every column is text)',
    infer: 'header=True, inferSchema=True',
    ddl_int: 'DDL schema with store_and_fwd_flag INT',
    ddl_string: 'DDL schema with store_and_fwd_flag STRING',
    noheader: 'no header option',
  };
  function readOpts(mode) {
    const o = { path: PATH12 };
    if (mode !== 'noheader') o.header = true;
    if (mode === 'infer') o.inferSchema = true;
    if (mode === 'ddl_int') o.schema = DF_TAXI12_DDL_INT;
    if (mode === 'ddl_string') o.schema = DF_TAXI12_DDL_STRING;
    return o;
  }
  const TABLES = {};
  Object.keys(MODE_LABEL).forEach((m) => { TABLES[m] = dfReadCsv(DF_TAXI12_CSV, readOpts(m)); });
  function tbl(mode) {
    const t = TABLES[mode || 'string'];
    if (!t) throw new Error('unknown read mode: ' + mode);
    return t;
  }
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const num4 = (x) => String(+(+x).toFixed(4));

  // CSV text (header + chosen rows, chosen columns), exactly as the lesson file writes them.
  function csvText(rowIdx, colNames) {
    const ci = (colNames || HEADER).map((c) => {
      const j = HEADER.indexOf(c);
      if (j < 0) throw new Error('unknown column ' + c);
      return j;
    });
    const lines = [ci.map((j) => HEADER[j]).join(',')].concat(rowIdx.map((i) => ci.map((j) => RAW[i][j]).join(',')));
    return lines.join('\n') + '\n';
  }
  // A GFM table of the raw text values (what the file holds), for quiz prompts.
  function rawTable(rowIdx, colNames) {
    return dfToMarkdownTable(dfReadCsv(csvText(rowIdx, colNames), { header: true }));
  }

  // ---------------------------------------------------------------- core lesson fns
  // The read cell for each mode, in the notebook's layout (one option per line).
  const READ_OPTS = {
    string: ['header=True'],
    noheader: [],
    infer: ['header=True', 'inferSchema=True'],
    ddl_int: ['header=True', 'schema=schema'],
    ddl_string: ['header=True', 'schema=schema'],
  };
  function readCodeFor(mode, extra) {
    const opts = READ_OPTS[mode].concat(extra || []);
    return ['trips = spark.read.csv(', '    f"{BASE}/lessons/taxi12.csv",'].concat(opts.map((o) => '    ' + o + ',')).concat([')']).join('\n');
  }
  // The show() call as typed: trips.show(), trips.show(5), trips.show(3, truncate=False, vertical=True).
  function showCall(n, truncate, vertical) {
    const a = [];
    if (n !== 20) a.push(String(n));
    if (truncate !== true) a.push('truncate=' + (truncate === false ? 'False' : String(truncate)));
    if (vertical) a.push('vertical=True');
    return 'trips.show(' + a.join(', ') + ')';
  }

  // Read the lesson file one of five ways and return what the notebook prints for it.
  // mode: 'string' | 'infer' | 'ddl_int' | 'ddl_string' | 'noheader'
  function readTaxi({ mode = 'string', n = 20, truncate = true, vertical = false } = {}) {
    const t = tbl(mode);
    const so = { n, truncate, vertical };
    const flagCol = dfFindColumn(t.columns, 'store_and_fwd_flag');
    const fareCol = dfFindColumn(t.columns, 'fare_amount');
    const count = dfCount(t);
    return {
      mode,
      label: MODE_LABEL[mode],
      readCode: readCodeFor(mode),
      call: showCall(n, truncate, vertical),
      headerLines: mode === 'noheader' ? 0 : 1,
      matrix: dfToMatrix(t, { cols: t.columns.slice(0, 4).map((c) => c.name), rowLabels: 'one' }),
      show: dfShowBlock(t, so),
      showText: dfShowOutput(t, so),
      schema: dfToTextBlock(dfPrintSchemaString(t)),
      schemaText: dfPrintSchemaString(t) + '\n',
      columns: dfColumns(t),
      columnsRepr: dfColumnsRepr(t),
      columnsBlock: dfToTextBlock(dfColumnsRepr(t)),
      dtypes: dfDtypes(t),
      dtypesRepr: dfDtypesRepr(t),
      count,
      nCols: t.columns.length,
      rowsShown: Math.max(0, Math.min(n, count)),
      footer: n < count,
      flagNulls: flagCol < 0 ? null : dfCount(dfFilter(t, { col: 'store_and_fwd_flag', op: 'isNull' })),
      flagType: flagCol < 0 ? null : dfTypeName(t.columns[flagCol].type),
      fareType: fareCol < 0 ? null : dfTypeName(t.columns[fareCol].type),
    };
  }

  // The raw lines of the lesson file (header + first n trips).
  function rawCsv({ n = 3 } = {}) {
    const lines = CSV_LINES.slice(0, n + 1);
    return { lines, block: dfToTextBlock(lines.join('\n')), header: CSV_LINES[0], dataLines: NROWS, nLines: CSV_LINES.length };
  }

  // describe() / summary() on the lesson file. stats[col][stat] holds the printed strings.
  function describeTaxi({ mode = 'infer', cols = null, summary = false } = {}) {
    const t = tbl(mode);
    const d = summary ? dfSummary(cols ? dfSelect(t, cols) : t) : (cols ? dfDescribe(t, cols) : dfDescribe(t));
    const rows = dfCollect(d);
    const stats = {};
    d.columns.slice(1).forEach((c) => {
      stats[c.name] = {};
      rows.forEach((r) => { stats[c.name][r.summary] = r[c.name]; });
    });
    return { text: dfShowOutput(d), block: dfShowBlock(d), stats, statNames: rows.map((r) => r.summary), pandas: dfToPandasString(d) };
  }

  // limit(n).toPandas() on the lesson file.
  function pandasTaxi({ mode = 'infer', n = 5 } = {}) {
    const text = dfToPandasString(tbl(mode), { n });
    return { text, block: dfToTextBlock(text) };
  }

  // The store_and_fwd_flag story: INT (the notebook's "Giving Spark a schema") vs STRING (the fix).
  const COUNT_Y = 'trips.filter(trips.store_and_fwd_flag == "Y").count()';
  function flagCheck({ flagType = 'INT' } = {}) {
    const mode = flagType === 'INT' ? 'ddl_int' : 'ddl_string';
    const t = tbl(mode);
    const sel = dfSelect(t, ['VendorID', 'lpep_pickup_datetime', 'store_and_fwd_flag', 'fare_amount']);
    const nulls = dfCount(dfFilter(t, { col: 'store_and_fwd_flag', op: 'isNull' }));
    const g = dfGroupCount(dfGroupBy(t, ['store_and_fwd_flag']));
    const y = dfTry(() => dfCount(dfFilter(t, { col: 'store_and_fwd_flag', op: '==', value: 'Y' })));
    // Trimmed per blueprint section 4: the cell's frame and the final line. The real output's three
    // "== DataFrame ==" call-site lines (truth m1.ddl_int.count_Y) are cut: learners need not read them.
    const yError = y.ok ? null : dfTraceback({ cell: 4, code: COUNT_Y, error: y.error });
    const desc = dfDescribe(t, ['store_and_fwd_flag']);
    const ddl = mode === 'ddl_int' ? DF_TAXI12_DDL_INT : DF_TAXI12_DDL_STRING;
    const parts = ddl.split(', ');
    const code = ['schema = """'].concat(parts.map((p, i) => p + (i < parts.length - 1 ? ',' : '') + (p.startsWith('store_and_fwd_flag ') ? '  # @a:flag' : '')))
      .concat(['"""', readCodeFor(mode)]).join('\n');
    return {
      flagType,
      mode,
      ddl,
      code,
      yText: y.ok ? String(y.value) : 'error',
      schema: dfToTextBlock(dfPrintSchemaString(t)),
      show: dfShowBlock(sel),
      showText: dfShowOutput(t),
      nulls,
      kept: dfCount(t) - nulls,
      groupText: dfShowOutput(g),
      groupBlock: dfShowBlock(g),
      describeBlock: dfShowBlock(desc),
      describeCount: Number(dfCollect(desc)[0].store_and_fwd_flag),
      yOk: y.ok,
      yCount: y.ok ? y.value : null,
      yError,
      yErrorBlock: yError ? dfToTextBlock(yError) : null,
      matrix: dfToMatrix(sel, { cols: ['VendorID', 'store_and_fwd_flag', 'fare_amount'], rowLabels: 'one', emptyLabel: 'NULL' }),
    };
  }

  // The INT schema read with mode="FAILFAST" (the read and count() succeed, show() fails loudly) or with
  // the default mode="PERMISSIVE" (show() prints NULL flags, no error). Three cells in a fresh session:
  // the read, trips.count(), trips.show() (Real Spark 4.0.1 run (harness), fix_m1/probe_ff3.json).
  function failfastCheck({ mode = 'FAILFAST' } = {}) {
    const t = dfReadCsv(DF_TAXI12_CSV, { header: true, schema: DF_TAXI12_DDL_INT, mode, path: PATH12 });
    const r = dfTry(() => dfShowString(t));
    const traceback = r.ok ? null : dfTraceback({ cell: 3, code: 'trips.show()', error: r.error });
    const causes = r.ok ? [] : (r.error.causes || []);
    const code = '# cell 1 (schema = the INT schema from the last scene)\n' + readCodeFor('ddl_int', ['mode="' + mode + '"']) +
      '\n# cell 2\ntrips.count()\n# cell 3\ntrips.show()';
    return {
      mode,
      ok: r.ok,
      count: dfCount(t),
      code,
      traceback,
      block: traceback ? dfToTextBlock(traceback) : null,
      outputTitle: r.ok ? 'Output of cell 3' : 'Output of cell 3 (real, trimmed; Databricks may print the file path a little differently)',
      output: r.ok ? dfToTextBlock(r.value) : dfToTextBlock(traceback),
      showText: r.ok ? r.value + '\n' : null,
      errorClass: r.ok ? null : r.error.errorClass,
      causes,
      causesBlock: dfToTextBlock(causes.join('\n')),
    };
  }

  // help() excerpts: lines copied from the real output (truth m1.help_show, m1.help_read_csv);
  // '    ...' marks skipped lines. examples.yaml rebuilds each excerpt from truth.json and compares.
  const HELP = {
    show: ["Help on method show in module pyspark.sql.connect.dataframe:", "", "show(n: int = 20, truncate: Union[bool, int] = True, vertical: bool = False) -> None method of pyspark.sql.connect.dataframe.DataFrame instance", "    Prints the first ``n`` rows of the DataFrame to the console.", "    ...", "    Parameters", "    ----------", "    n : int, optional, default 20", "        Number of rows to show.", "    truncate : bool or int, optional, default True", "        If set to ``True``, truncate strings longer than 20 chars.", "        If set to a number greater than one, truncates long strings to length ``truncate``", "        and align cells right.", "    vertical : bool, optional", "        If set to ``True``, print output rows vertically (one line per column value)."],
    csv: ["Help on method csv in module pyspark.sql.connect.readwriter:", "    ...", "    Loads a CSV file and returns the result as a  :class:`DataFrame`.", "", "    This function will go through the input once to determine the input schema if", "    ``inferSchema`` is enabled. To avoid going through the entire data once, disable", "    ``inferSchema`` option or specify the schema explicitly using ``schema``.", "    ...", "    Other Parameters", "    ----------------", "    Extra options", "        For the extra options, refer to", "        `Data Source Option <https://spark.apache.org/docs/latest/sql-data-sources-csv.html#data-source-option>`_", "        for the version you use."],
  };
  function helpExcerpt({ which = 'show' } = {}) {
    const lines = HELP[which];
    if (!lines) throw new Error('unknown help excerpt ' + which);
    const text = lines.join('\n');
    return { which, text, block: dfToTextBlock(text), lines: lines.length };
  }

  // Run-order simulation. Cells (as typed in the lessons): base, read, show. A cell that uses a name
  // no earlier cell defined raises NameError; cell numbers count the cells run in that session.
  const RUN_CELLS = {
    base: { code: 'BASE = "/Volumes/workspace/default/bdcc"', needs: [], defines: ['BASE'], caret: {} },
    read: { code: 'trips = spark.read.csv(f"{BASE}/lessons/taxi12.csv", header=True)', needs: ['BASE'], defines: ['trips'], caret: { BASE: 26 } },
    show: { code: 'trips.show()', needs: ['trips'], defines: [], caret: { trips: 0 } },
  };
  function runCells({ order = ['base', 'read', 'show'] } = {}) {
    const known = { spark: true };
    const steps = order.map((id, k) => {
      const c = RUN_CELLS[id];
      if (!c) throw new Error('unknown cell ' + id);
      const missing = c.needs.find((x) => !known[x]);
      if (missing) {
        const caret = ' '.repeat(c.caret[missing]) + '^'.repeat(missing.length);
        const text = dfTraceback({ cell: k + 1, code: c.code, caret, skipped: false, text: dfPyErrorText('NameError', { name: missing }) });
        return { cell: k + 1, id, code: c.code, ok: false, missing, text };
      }
      c.defines.forEach((x) => { known[x] = true; });
      return { cell: k + 1, id, code: c.code, ok: true, missing: null, text: id === 'show' ? dfShowOutput(tbl('string')) : '' };
    });
    const fails = steps.filter((s) => !s.ok);
    const showStep = steps.find((s) => s.id === 'show') || null;
    const shown = fails.length ? fails[0] : steps[steps.length - 1];
    return {
      steps,
      ok: fails.length === 0,
      failCount: fails.length,
      firstFail: fails.length ? fails[0].cell : null,
      showWorked: !!(showStep && showStep.ok),
      output: shown.text ? dfToTextBlock(shown.text) : '(no output)',
      outputTitle: fails.length ? 'Output of cell ' + fails[0].cell + ', the first cell that fails (real, trimmed)' : 'Output of cell ' + shown.cell + ' (real)',
      code: steps.map((s) => '# cell ' + s.cell + '\n' + s.code).join('\n'),
      codeBlock: '```python\n' + steps.map((s) => '# cell ' + s.cell + '\n' + s.code).join('\n') + '\n```',
    };
  }

  // type(x) and the printed value for the expressions the lessons inspect.
  const EXPRS = {
    'spark': { type: 'SparkSession', repr: () => null },
    'trips': { type: 'DataFrame', repr: () => dfRepr(tbl('string')) },
    'trips.columns': { type: 'list', repr: () => dfColumnsRepr(tbl('string')) },
    'trips["VendorID"]': { type: 'Column', repr: () => "Column<'" + dfExprLabel('VendorID') + "'>" },
    'trips.VendorID': { type: 'Column', repr: () => "Column<'" + dfExprLabel('VendorID') + "'>" },
    'trips.count()': { type: 'int', repr: () => String(dfCount(tbl('string'))) },
    'trips.select("VendorID")': { type: 'DataFrame', repr: () => dfRepr(dfSelect(tbl('string'), ['VendorID'])) },
  };
  const TYPE_WORD = { SparkSession: 'SparkSession', DataFrame: 'DataFrame', list: 'list', Column: 'Column', int: 'whole number (int)' };
  function typeOf({ expr = 'trips' } = {}) {
    const e = EXPRS[expr];
    if (!e) throw new Error('unknown expression ' + expr);
    const repr = e.repr();
    const type = DF_PY_TYPES[e.type];
    // What the lesson shows: the printed value (not for a DataFrame or the session, which Databricks
    // displays in its own way), then what type() prints.
    const fence = (code) => '```python\n' + code + '\n```\n';
    const shown = e.type === 'DataFrame' || e.type === 'SparkSession' ? '' : fence(expr) + dfToTextBlock(repr) + '\n\n';
    const view = shown + fence('print(type(' + expr + '))') + dfToTextBlock(type);
    return { expr, kind: e.type, word: TYPE_WORD[e.type], type, repr, view };
  }

  // Real full-data groupBy (truth full.csv_infer.vendor_flag), rebuilt so its layout is computed.
  const VENDOR_FLAG = [[1, 'N', 484123], [1, 'Y', 3650], [2, 'N', 2218153]];
  function vendorFlagTable({ rows = VENDOR_FLAG } = {}) {
    const t = dfFromRows('VendorID INT, store_and_fwd_flag STRING, count BIGINT', rows);
    const total = rows.reduce((a, r) => a + r[2], 0);
    const y = rows.filter((r) => r[1] === 'Y').reduce((a, r) => a + r[2], 0);
    const v1 = rows.filter((r) => r[0] === 1).reduce((a, r) => a + r[2], 0);
    return { text: dfShowOutput(t), block: dfShowBlock(t), total, y, n: total - y, vendor1: v1, vendor2: total - v1, pctY: 100 * y / total, pctYv1: 100 * y / v1 };
  }

  // Real full-data min/max pickup (truth full.csv_infer.min_max_pickup), rebuilt so its layout is computed.
  function pickupRange({ min, max }) {
    const t = dfFromRows('`min(lpep_pickup_datetime)` TIMESTAMP, `max(lpep_pickup_datetime)` TIMESTAMP', [[min, max]]);
    return { text: dfShowOutput(t), block: dfShowBlock(t) };
  }

  // The taxi12 dataset (datasets/taxi12.yaml) as a DataFrame with the inferSchema types: proves the
  // YAML rows are the same 12 trips the engine reads from the lesson file.
  function taxiFromDataset({ table }) {
    const types = tbl('infer').columns.map((c) => [c.name, c.type]);
    if (JSON.stringify(table.columns) !== JSON.stringify(HEADER)) throw new Error('taxi12 columns differ from the lesson file');
    const t = dfFromRows(types, table.rows);
    const same = JSON.stringify(t.rows) === JSON.stringify(tbl('infer').rows);
    return { showText: dfShowOutput(t), same, count: dfCount(t), markdown: dfToMarkdownTable(t) };
  }

  // ---------------------------------------------------------------- solve-along (Intuition walks)
  // inferSchema, column by column: the narrowest type that fits every value (types from the engine).
  const WHOLE = /^-?\d+$/;
  const NUMBER = /^-?(\d+\.?\d*|\.\d+)$/;
  function inferInfo() {
    const ti = tbl('infer');
    return HEADER.map((name, j) => {
      const vals = RAW.map((r) => r[j]);
      const type = dfTypeName(ti.columns[j].type);
      const notWhole = vals.find((v) => !WHOLE.test(v));
      const notNumber = vals.find((v) => !NUMBER.test(v));
      let why;
      if (type === 'integer') why = 'every value is a whole number';
      else if (type === 'double') why = '"' + notWhole + '" has a decimal point, but every value is a number';
      else if (type === 'timestamp') why = 'every value is a date and a time';
      else why = '"' + notNumber + '" is not a number or a date';
      return { name, type, sample: vals.slice(0, type === 'timestamp' ? 1 : 3).concat(['...']), why };
    });
  }
  // Worksheet: one row per column; the type cell fills in once the walk reaches it.
  function inferSheet({ upTo = 99 } = {}) {
    const info = inferInfo();
    return {
      rows: info.map((x) => x.name),
      cols: ['first values in the file', 'Spark picks'],
      values: info.map((x, i) => [dfTexText(x.sample.join(', ')), i < upTo ? dfTexText(x.type) : null]),
      types: info.map((x) => [x.name, x.type]),
    };
  }
  // roles: sheet (Matrix from inferSheet). Patches inferUpTo.
  function inferWalk() {
    const info = inferInfo();
    const trace = [{
      label: 'inferSchema=True: Spark reads every row once more. Here you see its result one column at a time.',
      patch: { inferUpTo: 0 },
      vars: { columns: info.length },
      ops: [{ role: 'sheet', cmd: 'clear' }],
    }];
    info.forEach((x, i) => {
      trace.push({
        label: '`' + x.name + '`: ' + x.why + ', so **' + x.type + '**.',
        patch: { inferUpTo: i + 1 },
        vars: { column: x.name, type: x.type },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'row:' + x.name, tone: x.type === 'string' ? 'warn' : 'good' } }],
      });
    });
    trace.push({
      label: 'Done: ' + info.filter((x) => x.type !== 'string').length + ' of ' + info.length + ' columns now hold numbers or dates.',
      patch: { inferUpTo: info.length },
      vars: { columns: info.length },
    });
    return { trace, steps: trace.length, types: info.map((x) => [x.name, x.type]) };
  }

  // Cast-or-null, one cell at a time: the file's text for one column read with a declared type.
  function castColumn(col, type, rowIdx) {
    const idx = rowIdx || range(NROWS);
    const t = dfReadCsv(csvText(idx, [col]), { header: true, schema: '`' + col + '` ' + type });
    const j = HEADER.indexOf(col);
    return idx.map((i, k) => ({ row: i + 1, raw: RAW[i][j], value: t.rows[k][0], shown: dfFormatValue(t.rows[k][0], t.columns[0].type) }));
  }
  // Worksheet: one row per trip; the "as TYPE" cell fills in once the walk reaches it.
  function castSheet({ col = 'store_and_fwd_flag', type = 'INT', upTo = 99 } = {}) {
    const cells = castColumn(col, type);
    return {
      rows: cells.map((c) => String(c.row)),
      cols: ['in the file', 'as ' + type],
      values: cells.map((c, i) => [dfTexText(c.raw), i < upTo ? (c.value === null ? '\\texttt{NULL}' : dfTexText(c.shown)) : null]),
      nulls: cells.filter((c) => c.value === null).length,
    };
  }
  // roles: sheet (Matrix from castSheet). Patches the state key named by `key` (default castUpTo), so a
  // scene can run two cast walks side by side (flag, then fare) with their own progress keys.
  function castWalk({ col = 'store_and_fwd_flag', type = 'INT', key = 'castUpTo' } = {}) {
    const cells = castColumn(col, type);
    const nulls = cells.filter((c) => c.value === null).length;
    const at = (n) => ({ [key]: n });
    const trace = [{
      label: 'The schema says `' + col + '` is ' + type + '. Spark converts each text value as it reads.',
      patch: at(0),
      vars: { column: col, type },
      ops: [{ role: 'sheet', cmd: 'clear' }],
    }];
    let run = 0;
    cells.forEach((c, i) => {
      if (c.value === null) run++;
      trace.push({
        label: 'Trip ' + c.row + ': "' + c.raw + '" as ' + type + '? ' + (c.value === null
          ? 'It does not fit, so NULL' + (/^-?\d+\.\d+$/.test(c.raw) ? ', not ' + c.raw.split('.')[0] : '') + '.'
          : 'It fits: ' + c.shown + '.'),
        patch: at(i + 1),
        vars: { text: c.raw, value: c.value === null ? 'NULL' : c.shown, nullsSoFar: run },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'row:' + c.row, tone: c.value === null ? 'bad' : 'good' } }],
      });
    });
    trace.push({
      label: nulls + ' of ' + cells.length + ' values became NULL, and Spark raised no error.',
      patch: at(cells.length),
      vars: { nulls, kept: cells.length - nulls },
    });
    return { trace, steps: trace.length, nulls, kept: cells.length - nulls };
  }

  // describe() by hand on one numeric column of the lesson file.
  function describeNumbers(col, mode) {
    const t = tbl(mode);
    const j = dfFindColumn(t.columns, col);
    if (j < 0) throw new Error('unknown column ' + col);
    const vals = t.rows.map((r) => r[j]);
    const xs = vals.map((v) => (v === null ? null : (typeof v === 'number' ? v : dfCastValue(v, 'string', 'double', { try: true })))).filter((v) => v !== null);
    const n = xs.length;
    const sum = xs.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const dev = xs.map((x) => x - mean);
    const sq = dev.map((d) => d * d);
    const ss = sq.reduce((a, b) => a + b, 0);
    const variance = ss / (n - 1);
    const printed = describeTaxi({ mode, cols: [col] }).stats[col];
    return { xs, dev, sq, n, sum, mean, ss, variance, stddev: Math.sqrt(variance), printed, textMode: mode === 'string' };
  }
  // Worksheet: x, x − mean, (x − mean)². Steps 1..n fill x; steps n+1..2n fill the deviations.
  function describeSheet({ col = 'fare_amount', mode = 'infer', upTo = 99 } = {}) {
    const d = describeNumbers(col, mode);
    return {
      rows: d.xs.map((_, i) => String(i + 1)),
      cols: ['x', 'x − mean', '(x − mean)²'],
      values: d.xs.map((x, i) => [i < upTo ? x : null, i + d.n < upTo ? d.dev[i] : null, i + d.n < upTo ? d.sq[i] : null]),
      n: d.n, sum: d.sum, mean: d.mean, ss: d.ss, variance: d.variance, stddev: d.stddev,
      printed: d.printed,
    };
  }
  // roles: sheet (Matrix from describeSheet). Patches descUpTo.
  function describeWalk({ col = 'fare_amount', mode = 'infer' } = {}) {
    const d = describeNumbers(col, mode);
    const n = d.n;
    const trace = [{
      label: '`count`: the values that are not null. Here count = ' + n + '.',
      patch: { descUpTo: 0 },
      vars: { count: n },
      ops: [{ role: 'sheet', cmd: 'clear' }],
    }];
    let run = 0;
    d.xs.forEach((x, i) => {
      run += x;
      trace.push({
        label: 'Trip ' + (i + 1) + ': add ' + num4(x) + '. Running sum: ' + num4(run) + '.',
        patch: { descUpTo: i + 1 },
        vars: { x, sum: +num4(run) },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'cell:' + (i + 1) + ',x', tone: 'accent' } }],
      });
    });
    trace.push({
      label: '`mean` $= \\frac{' + num4(d.sum) + '}{' + n + '} = ' + num4(d.mean) + '$.',
      patch: { descUpTo: n },
      vars: { mean: +num4(d.mean) },
    });
    d.xs.forEach((x, i) => {
      trace.push({
        label: 'Trip ' + (i + 1) + ': $(' + num4(x) + ' - ' + num4(d.mean) + ')^2 = ' + num4(d.sq[i]) + '$.',
        patch: { descUpTo: n + i + 1 },
        vars: { deviation: +num4(d.dev[i]), squared: +num4(d.sq[i]) },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: 'accent' } }],
      });
    });
    trace.push({
      label: 'Add the squares: ' + num4(d.ss) + '. Divide by $n - 1 = ' + (n - 1) + '$: ' + num4(d.variance) + '.',
      patch: { descUpTo: 2 * n },
      vars: { sumSquares: +num4(d.ss), variance: +num4(d.variance) },
    });
    trace.push({
      label: '`stddev` $= \\sqrt{' + num4(d.variance) + '} = ' + num4(d.stddev) + '$.',
      patch: { descUpTo: 2 * n },
      vars: { stddev: +num4(d.stddev) },
    });
    trace.push({
      label: d.textMode
        ? '`min` compares text, character by character: "' + d.printed.min + '" sorts first.'
        : '`min` is the smallest value: ' + d.printed.min + '.',
      patch: { descUpTo: 2 * n },
      vars: { min: d.printed.min },
    });
    trace.push({
      label: d.textMode
        ? '`max` compares text too: "' + d.printed.max + '" sorts last, because its first character "' + String(d.printed.max).charAt(0) + '" comes latest.'
        : '`max` is the largest value: ' + d.printed.max + '.',
      patch: { descUpTo: 2 * n },
      vars: { max: d.printed.max },
    });
    return { trace, steps: trace.length, n, sum: d.sum, mean: d.mean, variance: d.variance, stddev: d.stddev, min: d.printed.min, max: d.printed.max };
  }

  // ---------------------------------------------------------------- Math & Code traces
  // Each trace fn returns the live-example data its section shows and a trace with one step per executed
  // line of the section's code (one step per loop iteration where the line repeats). `code` and `math`
  // name the same anchor; ops address the section's live widgets by their ids (listed above each fn).
  const opHl = (role, sel, tone) => ({ role, cmd: 'highlight', args: tone ? { sel, tone } : { sel } });
  const opClear = (role) => ({ role, cmd: 'clear' });
  const opMask = (role, sel) => ({ role, cmd: 'mask', args: { sel } });
  const opNote = (role, sel, text) => ({ role, cmd: 'annotate', args: { sel, text } });
  const comma = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const rowSels = (k) => range(k).map((i) => 'row:' + (i + 1));
  const FULL_ROWS = VENDOR_FLAG.reduce((a, r) => a + r[2], 0); // 2,705,926 (truth full.csv.count; example vendor-flag-full)

  // get-session: the notebook's "Notebook basics" and "The SparkSession: your waiter" cells, one step per line.
  // roles: names (Matrix: the names Python knows after each line).
  function sessionCode() {
    const names = {
      rows: ['BASE', 'SparkSession', 'spark'],
      cols: ['what the name points to'],
      values: [
        ['\\texttt{' + dfTexEscape('"' + DF_VOLUME + '"') + '}'],
        ['\\text{a class: the recipe for a session}'],
        ['\\text{the session Databricks already started}'],
      ],
    };
    const typeSpark = DF_PY_TYPES.SparkSession;
    const trace = [
      { label: 'The first line stores the volume path in the variable `BASE`.', code: 'base', math: 'base',
        vars: { BASE: DF_VOLUME }, ops: [opClear('names'), opMask('names', ['row:BASE']), opHl('names', 'row:BASE', 'good')] },
      { label: 'The import borrows the class `SparkSession` from the `pyspark` library.', code: 'import', math: 'import',
        vars: { SparkSession: 'class' }, ops: [opMask('names', ['row:BASE', 'row:SparkSession']), opHl('names', 'row:SparkSession', 'good')] },
      { label: '`getOrCreate()` finds the session Databricks started and names it `spark`.', code: 'session', math: 'session',
        vars: { spark: 'SparkSession' }, ops: [opMask('names', ['row:BASE', 'row:SparkSession', 'row:spark']), opHl('names', 'row:spark', 'good')] },
      { label: '`type(spark)` prints `' + typeSpark + '`: a Spark Connect session.', code: 'type', math: 'type',
        vars: { type: 'connect SparkSession' }, ops: [opHl('names', 'row:spark', 'accent')] },
    ];
    return { names, typeSpark, steps: trace.length, trace };
  }

  // read-csv: the cell under "Reading CSV files", one step per line, shown on the lesson file read the same way.
  // roles: table (Matrix of the first 4 columns, from readTaxi().matrix).
  function readCode({ mode = 'string' } = {}) {
    const r = readTaxi({ mode });
    const m = r.matrix;
    const last = m.rows[m.rows.length - 1];
    const trace = [
      { label: 'The f-string fills in `BASE`; `*` matches the three files `-10`, `-11` and `-12`.', code: 'path', math: 'path',
        vars: { path: DF_VOLUME + '/nyctaxi/green_tripdata_2017-1*.csv' }, ops: [opClear('table'), opHl('table', m.rows.map((x) => 'row:' + x), 'accent')] },
      { label: '`sep=","`: each comma ends a value, so every line splits into ' + r.nCols + ' values.', code: 'sep', math: 'sep',
        vars: { values: r.nCols }, ops: [opHl('table', 'row:1', 'accent')] },
      mode === 'noheader'
        ? { label: 'No `header=True`: Spark names the columns `_c0`, `_c1`... and the names line becomes row 1.', code: 'header', math: 'header',
            vars: { first: r.columns[0] }, ops: [opHl('table', 'row:1', 'bad')] }
        : { label: '`header=True`: line 1 gives the column names. The other ' + r.count + ' lines become rows.', code: 'header', math: 'header',
            vars: { first: r.columns[0] }, ops: [opHl('table', m.cols.map((c) => 'col:' + c), 'good')] },
      { label: '`trips` now names the DataFrame. Nothing prints: Spark has not read the trips yet.', code: 'read', math: 'read',
        vars: { columns: r.nCols, rows: r.count }, ops: [opHl('table', 'row:' + last, 'accent'), opNote('table', 'cell:' + last + ',' + m.cols[0], 'row ' + r.count)] },
    ];
    return { mode, matrix: m, count: r.count, nCols: r.nCols, nLines: CSV_LINES.length, headerLines: r.headerLines, steps: trace.length, trace };
  }

  // show-count: the cells from "Displaying a DataFrame with show" to "Counting rows" on the lesson file (header=True read).
  // roles: grid (Matrix of 4 columns), facts (Readout: rows show() prints, count(), columns).
  const SHOW_COLS = ['VendorID', 'lpep_pickup_datetime', 'PULocationID', 'fare_amount'];
  function showCode() {
    const t = tbl('string');
    const grid = dfToMatrix(t, { cols: SHOW_COLS, rowLabels: 'one' });
    const count = dfCount(t);
    const shown = Math.min(20, count);
    const nCols = t.columns.length;
    const col = 'Column<\'' + dfExprLabel('VendorID') + '\'>';
    const trace = [
      { label: '`show()` prints at most 20 rows. The file has ' + count + ', so all ' + shown + ' print, with no footer.', code: 'show', math: 'show',
        vars: { rows: shown }, ops: [opClear('grid'), opHl('grid', rowSels(shown), 'good'), opHl('facts', 'item:0', 'accent')] },
      { label: '`show(3, truncate=False, vertical=True)`: rows 1 to 3, each printed as a list of ' + nCols + ' lines.', code: 'vertical', math: 'vertical',
        vars: { rows: 3 }, ops: [opHl('grid', rowSels(3), 'accent')] },
      { label: '`trips.columns`: the ' + nCols + ' names as a Python list. Spark reads no trips for this.', code: 'columns', math: 'columns',
        vars: { names: nCols }, ops: [opHl('grid', SHOW_COLS.map((c) => 'col:' + c), 'good'), opHl('facts', 'item:2', 'accent')] },
      { label: '`trips["VendorID"]` prints `' + col + '`: a description of the column, with no values.', code: 'colobj', math: 'colobj',
        vars: { printed: col }, ops: [opHl('grid', 'col:VendorID', 'accent')] },
      { label: '`trips.VendorID` is another spelling of the same Column object.', code: 'colobj', math: 'colobj',
        vars: { printed: col }, ops: [opHl('grid', 'col:VendorID', 'accent')] },
      { label: '`count()` reads every row: ' + count + ' here, ' + comma(FULL_ROWS) + ' on all three months.', code: 'count', math: 'count',
        vars: { count }, ops: [opHl('grid', rowSels(count), 'good'), opHl('facts', 'item:1', 'accent')] },
    ];
    return { grid, count, shown, nCols, fullRows: FULL_ROWS, steps: trace.length, trace };
  }

  // print-schema: "Column types" and "Letting Spark guess the types". One step per line, and one step per column while
  // inferSchema decides. roles: types (Matrix: first values, plain-read type, inferSchema type).
  function inferCode({ col = 'fare_amount' } = {}) {
    const info = inferInfo();
    const plain = tbl('string');
    const types = {
      rows: info.map((x) => x.name),
      cols: ['first values', 'header only', 'inferSchema'],
      values: info.map((x, j) => [dfTexText(x.sample.join(', ')), dfTexText(dfTypeName(plain.columns[j].type)), dfTexText(x.type)]),
    };
    const base = ['col:first values', 'col:header only'];
    const done = [];
    const typed = info.filter((x) => x.type !== 'string').length;
    const trace = [
      { label: 'Plain read: `printSchema()` lists ' + info.length + ' columns, and every one is `string`.', code: 'schema', math: 'schema',
        vars: { columns: info.length }, ops: [opClear('types'), opMask('types', base), opHl('types', 'col:header only', 'warn')] },
      { label: '`dtypes` gives the same types as a list of (name, type) pairs.', code: 'dtypes', math: 'dtypes',
        vars: { first: dfDtypes(plain)[0].join(': ') }, ops: [opMask('types', base), opHl('types', 'col:header only', 'warn')] },
    ];
    info.forEach((x) => {
      done.push('cell:' + x.name + ',inferSchema');
      trace.push({ label: '`' + x.name + '`: ' + x.why + ', so `' + x.type + '`.', code: 'infer', math: 'infer',
        vars: { column: x.name, type: x.type }, ops: [opMask('types', base.concat(done)), opHl('types', 'row:' + x.name, x.type === 'string' ? 'warn' : 'good')] });
    });
    trace.push({ label: 'The new `printSchema()`: ' + typed + ' of ' + info.length + ' columns now hold numbers or dates.', code: 'schema', math: 'schema',
      vars: { typed }, ops: [opHl('types', 'col:inferSchema', 'good')] });
    const pick = info.find((x) => x.name === col) || info[0];
    return {
      types, typed, col: pick.name, type: pick.type, why: pick.why,
      colTex: '\\texttt{' + dfTexEscape(pick.name) + '}', whyTex: dfTexText(pick.why), typeTex: '\\texttt{' + pick.type + '}',
      inferred: info.map((x) => [x.name, x.type]), steps: trace.length, trace,
    };
  }

  // ddl-schema: "Giving Spark a schema" on the lesson file's flag column. One step per line, and one
  // step per trip while the read casts the flags. roles: cast (Matrix from castSheet), facts (Readout).
  function castCode({ type = 'INT' } = {}) {
    const col = 'store_and_fwd_flag';
    const cells = castColumn(col, type);
    const sheet = castSheet({ col, type });
    const nulls = cells.filter((c) => c.value === null).length;
    const asCol = 'col:as ' + type;
    const seen = ['col:in the file'];
    const trace = [
      { label: 'The DDL string declares a type for every column. Spark trusts it and checks nothing yet.', code: 'ddl', math: 'ddl',
        vars: { flag: type }, ops: [opClear('cast'), opMask('cast', seen.slice()), opHl('cast', 'col:in the file', 'accent')] },
      { label: '`' + col + ' ' + type + '`: ' + (type === 'INT' ? 'a whole number, but the file holds the letters N and Y.' : 'text, so N and Y fit.'),
        code: 'flag', math: 'flag', vars: { flag: type }, ops: [opMask('cast', seen.slice()), opHl('cast', asCol, type === 'INT' ? 'warn' : 'good')] },
    ];
    let run = 0;
    cells.forEach((c) => {
      if (c.value === null) run++;
      seen.push('cell:' + c.row + ',as ' + type);
      trace.push({ label: 'Trip ' + c.row + ': "' + c.raw + '" as ' + type + '? ' + (c.value === null ? 'It does not fit: NULL, and no error.' : 'It fits: ' + c.shown + '.'),
        code: 'read', math: 'read', vars: { x: c.raw, v: c.value === null ? 'NULL' : c.shown, nulls: run },
        ops: [opMask('cast', seen.slice()), opHl('cast', 'row:' + c.row, c.value === null ? 'bad' : 'good')] });
    });
    trace.push({ label: '`show(5)` prints ' + (nulls ? 'NULL in the flag column of every row' : 'N or Y in the flag column') + '. No error appears.',
      code: 'show', math: 'show', vars: { nulls }, ops: [opHl('cast', asCol, nulls ? 'bad' : 'good'), opHl('facts', 'item:0', 'accent')] });
    trace.push({ label: '`describe` counts the values that are not NULL: count = ' + (cells.length - nulls) + '.', code: 'count', math: 'count',
      vars: { count: cells.length - nulls }, ops: [opHl('facts', 'item:1', 'accent')] });
    return { type, sheet, nulls, kept: cells.length - nulls, steps: trace.length, trace };
  }

  // describe-stats: what describe() computes, one step per line and per loop iteration, on the 12 lesson fares
  // (inferSchema read), then the text read of "Aha: summaries of text columns". roles: sheet (Matrix from describeSheet), stats (Readout).
  function describeCode() {
    const d = describeNumbers('fare_amount', 'infer');
    const sheet = describeSheet({ col: 'fare_amount', mode: 'infer' });
    const text = describeTaxi({ mode: 'string', cols: ['fare_amount'] }).stats.fare_amount;
    const n = d.n;
    // The list as the section's code types it (Python float reprs), so examples.yaml ties the code to the data.
    const fares = '[' + d.xs.map((x) => (Number.isInteger(x) ? x.toFixed(1) : String(x))).join(', ') + ']';
    const trace = [{ label: '`n = len(fares)`: the list holds ' + n + ' fares and no NULL, so `n = ' + n + '`.', code: 'count', math: 'count',
      vars: { n }, ops: [opClear('sheet'), opHl('sheet', 'col:x', 'accent'), opHl('stats', 'row:count', 'accent')] }];
    let total = 0;
    d.xs.forEach((x, i) => {
      total += x;
      trace.push({ label: 'Trip ' + (i + 1) + ': `total += ' + num4(x) + '`, so `total` is ' + num4(total) + '.', code: 'sum', math: 'sum',
        vars: { x, total: +num4(total) }, ops: [opHl('sheet', 'cell:' + (i + 1) + ',x', 'accent')] });
    });
    trace.push({ label: '`mean = total / n` $= ' + num4(d.sum) + ' / ' + n + ' = ' + num4(d.mean) + '$.', code: 'mean', math: 'mean',
      vars: { mean: +num4(d.mean) }, ops: [opHl('stats', 'row:mean', 'accent')] });
    let ss = 0;
    d.xs.forEach((x, i) => {
      ss += d.sq[i];
      trace.push({ label: 'Trip ' + (i + 1) + ': $(' + num4(x) + ' - ' + num4(d.mean) + ')^2 = ' + num4(d.sq[i]) + '$, so `ss` is ' + num4(ss) + '.',
        code: 'ss', math: 'ss', vars: { x, ss: +num4(ss) }, ops: [opHl('sheet', 'row:' + (i + 1), 'accent')] });
    });
    trace.push({ label: '`stddev` $= \\sqrt{' + num4(d.ss) + ' / ' + (n - 1) + '} = ' + num4(d.stddev) + '$. Spark divides by $n - 1$.', code: 'stddev', math: 'stddev',
      vars: { stddev: +num4(d.stddev) }, ops: [opHl('stats', 'row:stddev', 'accent')] });
    trace.push({ label: '`min(fares)` and `max(fares)` compare numbers: ' + d.printed.min + ' and ' + d.printed.max + '.', code: 'minmax', math: 'minmax',
      vars: { min: d.printed.min, max: d.printed.max }, ops: [opHl('stats', ['row:min', 'row:max'], 'good')] });
    trace.push({ label: 'A text read compares text instead: `min` is "' + text.min + '" and `max` "' + text.max + '". First characters decide.',
      code: 'textminmax', math: 'textminmax', vars: { min: text.min, max: text.max }, ops: [opHl('stats', ['row:min', 'row:max'], 'bad')] });
    const statNames = ['count', 'mean', 'stddev', 'min', 'max'];
    const stats = { rows: statNames, cols: ['inferSchema read', 'text read'], values: statNames.map((k) => [dfTexText(d.printed[k]), dfTexText(text[k])]) };
    return { n, fares, sum: d.sum, mean: d.mean, ss: d.ss, variance: d.variance, stddev: d.stddev, printed: d.printed, textMin: text.min, textMax: text.max, sheet, stats, steps: trace.length, trace };
  }

  // limit-topandas: the cell under "Spark DataFrames and pandas", then the same two steps on separate lines.
  // roles: rows (Matrix of the lesson file, inferSchema read), facts (Readout).
  const LIMIT_COLS = ['VendorID', 'PULocationID', 'fare_amount', 'total_amount'];
  function limitCode({ n = 10 } = {}) {
    const t = tbl('infer');
    const rows = dfToMatrix(t, { cols: LIMIT_COLS, rowLabels: 'one' });
    const kept = dfCount(dfLimit(t, n));
    const keep = rowSels(kept);
    const p = pandasTaxi({ mode: 'infer', n });
    const trace = [
      { label: 'The notebook\'s cell does both steps in one line. The next two lines do them one at a time.', code: 'chain', math: 'chain',
        vars: { n }, ops: [opClear('rows'), opHl('rows', keep, 'accent')] },
      { label: '`limit(' + n + ')` keeps the first ' + kept + ' rows Spark comes across. They are still in Spark.', code: 'limit', math: 'limit',
        vars: { kept }, ops: [opMask('rows', keep), opHl('rows', keep, 'good'), opHl('facts', 'item:0', 'accent')] },
      { label: '`toPandas()` copies those ' + kept + ' rows into your notebook. Without `limit`: all ' + comma(FULL_ROWS) + '.', code: 'topandas', math: 'topandas',
        vars: { copied: kept }, ops: [opHl('rows', keep, 'good'), opHl('facts', 'item:1', 'bad')] },
    ];
    return { n, rows, kept, count: dfCount(t), fullRows: FULL_ROWS, pandas: p.text, pandasBlock: p.block, steps: trace.length, trace };
  }

  // ---------------------------------------------------------------- application (full Q4 2017 data)
  // The three volume CSV files (19 columns, 2,705,926 trips). The values come from real runs (dataset
  // q4facts); each printed text below is rebuilt from them so its layout is computed, and examples.yaml
  // checks it byte for byte against the real output (truth full.*, the executed course notebook,
  // m1/probe_app.json).
  const FULL_COLS = ['VendorID', 'lpep_pickup_datetime', 'lpep_dropoff_datetime', 'store_and_fwd_flag', 'RatecodeID',
    'PULocationID', 'DOLocationID', 'passenger_count', 'trip_distance', 'fare_amount', 'extra', 'mta_tax', 'tip_amount',
    'tolls_amount', 'ehail_fee', 'improvement_surcharge', 'total_amount', 'payment_type', 'trip_type'];
  const FULL_MONEY = ['trip_distance', 'fare_amount', 'extra', 'mta_tax', 'tip_amount', 'tolls_amount', 'ehail_fee', 'improvement_surcharge', 'total_amount'];
  const fullTypes = (fn) => FULL_COLS.map((c) => [c, fn(c)]);
  // The notebook's DDL schema ("Giving Spark a schema"); its "Y" trips fix declares the flag STRING.
  const ddlType = (flag) => (c) => (c === 'store_and_fwd_flag' ? flag : c.endsWith('_datetime') ? 'TIMESTAMP'
    : FULL_MONEY.includes(c) ? 'FLOAT' : c === 'payment_type' || c === 'trip_type' ? 'STRING' : 'INT');
  // inferSchema on the three files (truth full.csv_infer.printSchema): ehail_fee is empty, so it stays string.
  const inferType = (c) => (c.endsWith('_datetime') ? 'TIMESTAMP' : c === 'store_and_fwd_flag' || c === 'ehail_fee' ? 'STRING'
    : FULL_MONEY.includes(c) ? 'DOUBLE' : 'INT');
  const FULL_READ_LINE = '    f"{BASE}/nyctaxi/green_tripdata_2017-1*.csv",';
  const fullReadCode = (name, opts) => [name + ' = spark.read.csv(', FULL_READ_LINE, '    sep=",",', '    header=True,'].concat(opts.map((o) => '    ' + o + ','), [')']);
  const schemaLines = (name, flag) => [name + ' = """'].concat(fullTypes(ddlType(flag)).map(([c, t], i) => c + ' ' + t + (i < FULL_COLS.length - 1 ? ',' : '')), ['"""']);
  const FULL_MODES = {
    string: { label: 'header=True only', cells: '"Reading CSV files" and "Column types"', types: () => 'STRING', code: () => fullReadCode('trips', []) },
    infer: { label: 'inferSchema=True', cells: '"Letting Spark guess the types"', types: inferType, code: () => fullReadCode('trips', ['inferSchema=True']) },
    ddl_int: { label: "the notebook's DDL schema", cells: '"Giving Spark a schema"', types: ddlType('INT'),
      code: () => schemaLines('schema', 'INT').concat(fullReadCode('trips', ['schema=schema'])) },
    ddl_string: { label: 'the DDL schema, flag fixed', cells: '"Broken on purpose: counting the Y trips"', types: ddlType('STRING'),
      code: () => schemaLines('schema_fixed', 'STRING').concat(fullReadCode('trips', ['schema=schema_fixed'])) },
  };
  // printSchema() of the three files for one way of reading them.
  function fullRead({ mode = 'infer' } = {}) {
    const m = FULL_MODES[mode];
    if (!m) throw new Error('unknown read mode ' + mode);
    const t = dfFromRows(fullTypes(m.types).map(([c, ty]) => c + ' ' + ty).join(', '), []);
    const typeOfCol = (c) => dfTypeName(t.columns[dfFindColumn(t.columns, c)].type);
    const schema = dfPrintSchemaString(t);
    return {
      mode, label: m.label, cells: m.cells,
      code: m.code().concat(['trips.printSchema()']).join('\n'),
      schemaText: schema + '\n', schemaBlock: dfToTextBlock(schema), nCols: t.columns.length,
      flagType: typeOfCol('store_and_fwd_flag'), fareType: typeOfCol('fare_amount'), ehailType: typeOfCol('ehail_fee'), paymentType: typeOfCol('payment_type'),
    };
  }

  // The flag on the full data with the notebook's INT schema or the STRING fix.
  function fullFlag({ flagType = 'INT', facts }) {
    const isInt = flagType === 'INT';
    const counted = facts.flagDescribeCount[isInt ? 'INT' : 'STRING'];          // describe() count row (real)
    // Comparing the INT column with "Y": the same error on any data (truth full.ddl_int.count_Y).
    const y = dfTry(() => dfCount(dfFilter(tbl('ddl_int'), { col: 'store_and_fwd_flag', op: '==', value: 'Y' })));
    const nullGroup = dfFromRows('store_and_fwd_flag INT, count BIGINT', [[null, facts.rows - counted]]);
    const v = vendorFlagTable({ rows: facts.vendorFlag });
    const table = isInt ? nullGroup : dfFromRows('VendorID INT, store_and_fwd_flag STRING, count BIGINT', facts.vendorFlag);
    return {
      flagType,
      describeCount: counted,
      nulls: facts.rows - counted,
      yText: isInt ? 'error [' + y.error.errorClass + ']' : comma(facts.flagY),
      yCount: isInt ? null : facts.flagY,
      vendor1Y: v.y,
      tableTitle: isInt ? '`trips.groupBy("store_and_fwd_flag").count().show()`' : '`trips.groupBy("VendorID", "store_and_fwd_flag").count().orderBy("VendorID", "store_and_fwd_flag").show()`',
      tableText: dfShowOutput(table),
      tableBlock: dfShowBlock(table),
    };
  }

  // "Discovery: make Spark fail loudly": the notebook's INT schema read with mode="FAILFAST". Spark stops at the first bad
  // value; on the three files that is in the October file, which the message names.
  function fullFailfast() {
    const path = DF_VOLUME + '/nyctaxi/green_tripdata_2017-10.csv';
    const t = dfReadCsv(DF_TAXI12_CSV, { header: true, schema: DF_TAXI12_DDL_INT, mode: 'FAILFAST', path });
    const r = dfTry(() => dfShowString(t, { n: 5 }));
    if (r.ok) throw new Error('fullFailfast: expected an error');
    const traceback = dfTraceback({ cell: 32, line: 10, code: 'trips_strict.show(5)', error: r.error });
    const code = ['# EXPECT-ERROR: SparkException', '# The broken INT schema again, read with the mode you found.']
      .concat(fullReadCode('trips_strict', ['schema=schema', 'mode="FAILFAST"']), ['trips_strict.show(5)']).join('\n');
    return { code, traceback, block: dfToTextBlock(traceback), errorClass: r.error.errorClass };
  }

  // describe("fare_amount", "PULocationID", "lpep_pickup_datetime") on the text read ("Aha: summaries of text columns") or
  // the inferSchema read (m1/probe_app.json: Spark leaves the timestamp column out of a typed describe).
  function fullDescribe({ read = 'string', facts }) {
    const f = facts.fare, p = facts.pu, n = String(facts.rows);
    const text = read === 'string';
    const cols = text ? ['fare_amount', 'PULocationID', 'lpep_pickup_datetime'] : ['fare_amount', 'PULocationID'];
    const rows = text
      ? [['count', n, n, n], ['mean', String(f.mean), String(p.mean), null], ['stddev', String(f.stddev), String(p.stddev), null],
        ['min', facts.fareText.min, facts.puText.min, facts.pickupMin], ['max', facts.fareText.max, facts.puText.max, facts.pickupMax]]
      : [['count', n, n], ['mean', String(f.mean), String(p.mean)], ['stddev', String(f.stddev), String(p.stddev)],
        ['min', String(f.min), String(p.min)], ['max', String(f.max), String(p.max)]];
    const t = dfFromRows(['summary'].concat(cols).map((c) => c + ' STRING').join(', '), rows);
    const name = text ? 'trips_text' : 'trips';
    const code = (text
      ? ['trips_text = spark.read.csv(f"{BASE}/nyctaxi/green_tripdata_2017-1*.csv", header=True)']
      : ['# trips: the three files read with inferSchema=True, as in "Letting Spark guess the types"'])
      .concat([name + '.describe("fare_amount", "PULocationID", "lpep_pickup_datetime").show()']).join('\n');
    const get = (stat, col) => rows.find((r) => r[0] === stat)[cols.indexOf(col) + 1];
    return {
      read, code, text: dfShowOutput(t), block: dfShowBlock(t), nCols: cols.length,
      fareMin: get('min', 'fare_amount'), fareMax: get('max', 'fare_amount'), puMax: get('max', 'PULocationID'),
      hasDates: text,
    };
  }

  // Shares used by the decisions (counts from real runs, dataset q4facts).
  function fullChecks({ facts }) {
    const pct = (k) => 100 * k / facts.rows;
    const badDates = facts.pickupBeforeQ4 + facts.pickupAfterQ4;
    return {
      rows: facts.rows, dropped: facts.originalRows - facts.rows,
      // The usual slip when subtracting the two counts by hand: forgetting to borrow from the thousands.
      droppedNoBorrow: facts.originalRows - facts.rows + 1000,
      badDates, badDatesPct: pct(badDates), negativeFares: facts.negativeFares, negativePct: pct(facts.negativeFares),
      yPct: pct(facts.flagY), yAllVendor1: facts.vendorFlag.filter((r) => r[1] === 'Y').every((r) => r[0] === 1),
      fareMean: facts.fare.mean, fareFloatMean: facts.fareFloat.mean,
    };
  }

  // ---------------------------------------------------------------- quiz generators
  // Notebook cells for the run-order question (real lesson code). A cell needs the names it uses.
  const NB_CELLS = {
    base: { code: 'BASE = "/Volumes/workspace/default/bdcc"', needs: [], defines: ['BASE'] },
    read: { code: 'trips = spark.read.csv(f"{BASE}/lessons/taxi12.csv", header=True)', needs: ['BASE'], defines: ['trips'] },
    show: { code: 'trips.show(5)', needs: ['trips'], defines: [] },
    x: { code: 'x = 5', needs: [], defines: ['x'] },
    y: { code: 'y = x + 1', needs: ['x'], defines: ['y'] },
    count: { code: 'n = trips.count()', needs: ['trips'], defines: ['n'] },
    print: { code: 'print(n)', needs: ['n'], defines: [] },
  };
  // Smallest set of cells (page positions, 1-based) to run in a fresh session so `target` works.
  function cellsNeeded({ page, target }) {
    const need = new Set([target]);
    const stack = [target];
    while (stack.length) {
      const pos = stack.pop();
      for (const name of NB_CELLS[page[pos - 1]].needs) {
        let def = -1;
        for (let p = pos - 1; p >= 1; p--) if (NB_CELLS[page[p - 1]].defines.includes(name)) { def = p; break; }
        if (def < 0) throw new Error('no cell above defines ' + name);
        if (!need.has(def)) { need.add(def); stack.push(def); }
      }
    }
    return { cells: [...need].sort((a, b) => a - b), count: need.size };
  }
  function runOrderQ({ rng, difficulty }) {
    for (let tries = 0; tries < 50; tries++) {
      const pairs = rng.shuffle([['x', 'y'], ['count', 'print']]);
      const extra = difficulty === 1 ? pairs[0] : pairs[0].concat(pairs[1]);
      const page = ['base', 'read', 'show'].concat(extra);
      const candidates = range(page.length).map((i) => i + 1).filter((p) => ['y', 'count', 'print'].includes(page[p - 1]));
      const target = rng.pick(candidates);
      const r = cellsNeeded({ page, target });
      if (r.count === target || r.count === 1) continue;
      const cellsMd = page.map((id, i) => (i + 1) + '. `' + NB_CELLS[id].code + '`').join('\n');
      return {
        vars: { cellsMd, target, targetCode: NB_CELLS[page[target - 1]].code, answer: r.count, upTo: target, needed: r.cells.join(', '), nCells: page.length },
        misconceptions: [
          { var: 'upTo', feedback: 'Running every cell from the top is the safe habit, and it works. This question asks for the fewest cells: only those that make the names cell {=target} needs.' },
          { value: 1, feedback: 'Run alone in a fresh session, cell {=target} uses names that no cell has created yet, so it raises a NameError.' },
        ],
      };
    }
    throw new Error('runOrderQ: no draw');
  }

  // count() with and without header=True on a few real lines.
  function headerCountQ({ rng, difficulty }) {
    for (let tries = 0; tries < 50; tries++) {
      const k = rng.int(difficulty === 1 ? 3 : 4, difficulty === 3 ? 9 : 6);
      const idx = rng.sample(range(NROWS), k).sort((a, b) => a - b);
      const withHeader = rng.bool(0.5);
      const text = csvText(idx, ['VendorID', 'PULocationID', 'fare_amount']);
      const t = dfReadCsv(text, withHeader ? { header: true } : {});
      const answer = dfCount(t);
      const other = dfCount(dfReadCsv(text, withHeader ? {} : { header: true }));
      const nCols = t.columns.length;
      if (answer === nCols || other === nCols) continue;
      // Two lines, as the lessons write them: name the table, then count its rows.
      const read = withHeader ? 'trips = spark.read.csv(path, header=True)' : 'trips = spark.read.csv(path)';
      const codeBlock = '```python\n' + read + '\ntrips.count()\n```';
      return {
        vars: { k, code: read, codeBlock, block: dfToTextBlock(text.replace(/\n$/, '')), answer, other, nCols, lines: k + 1, names: dfColumns(t).join(', '), withHeader: withHeader ? 'yes' : 'no' },
        misconceptions: [
          { var: 'other', feedback: withHeader ? 'With `header=True` the first line becomes the column names, not a row.' : 'Without `header=True` Spark treats the first line as data, so the names line becomes a row.' },
          { var: 'nCols', feedback: '`count()` counts rows, not columns.' },
        ],
      };
    }
    throw new Error('headerCountQ: no draw');
  }

  // Rows printed by show(n).
  function showRowsQ({ rng, difficulty }) {
    for (let tries = 0; tries < 50; tries++) {
      const k = rng.int(difficulty === 1 ? 4 : 6, difficulty === 1 ? 8 : 12);
      const idx = rng.sample(range(NROWS), k).sort((a, b) => a - b);
      const n = rng.int(1, 15);
      if (n === k) continue;
      const t = dfReadCsv(csvText(idx, ['VendorID', 'PULocationID', 'fare_amount']), { header: true });
      const shown = dfShowString(t, { n });
      const answer = shown.split('\n').filter((l) => l.startsWith('|')).length - 1;
      const footer = shown.indexOf('only showing top') >= 0;
      const misconceptions = footer
        ? [{ value: k, feedback: '`show({=n})` stops after {=n} rows and adds the line `only showing top {=n} rows`.' }]
        : [{ value: n, feedback: 'The table has only {=k} rows, so `show({=n})` prints all {=k}, with no "only showing" line.' }];
      misconceptions.push({ value: 20, feedback: '20 is the default when you call `show()` with no number. Here the number is {=n}.' });
      return {
        vars: { k, n, answer, table: dfToMarkdownTable(t), footerText: footer ? 'It ends with `only showing top ' + n + ' rows`.' : 'Every row fits, so there is no "only showing" line.' },
        misconceptions,
      };
    }
    throw new Error('showRowsQ: no draw');
  }

  // describe() min or max on a text (string) column vs the numeric answer.
  const SM_COLS = ['fare_amount', 'tip_amount', 'total_amount', 'trip_distance', 'PULocationID', 'DOLocationID'];
  function stringMaxQ({ rng, difficulty }) {
    for (let tries = 0; tries < 80; tries++) {
      const col = rng.pick(SM_COLS);
      const k = rng.int(4, difficulty === 1 ? 5 : 7);
      const idx = rng.sample(range(NROWS), k);
      const which = rng.pick(['max', 'min']);
      const other = which === 'max' ? 'min' : 'max';
      const text = csvText(idx, [col]);
      const sd = dfCollect(dfDescribe(dfReadCsv(text, { header: true })));
      const nd = dfCollect(dfDescribe(dfReadCsv(text, { header: true, inferSchema: true })));
      const pick = (rows, s) => Number(rows.find((r) => r.summary === s)[col]);
      const answer = pick(sd, which);
      const numeric = pick(nd, which);
      const opposite = pick(nd, other);
      if (answer === numeric || answer === opposite) continue;
      const values = idx.map((i) => RAW[i][HEADER.indexOf(col)]);
      return {
        vars: { col, which, other, answer, numeric, opposite, k, valuesText: values.join(', '), table: rawTable(idx, [col]) },
        misconceptions: [
          { var: 'numeric', feedback: 'That is the {=which} of the numbers. The column is text, so `describe()` compares text, character by character.' },
          { var: 'opposite', feedback: 'That is the numeric {=other}. Compare the values as text: first characters first.' },
        ],
      };
    }
    throw new Error('stringMaxQ: no draw');
  }

  // NULLs created by declaring a decimal column INT.
  const NC_COLS = ['fare_amount', 'tip_amount', 'trip_distance'];
  function nullCountQ({ rng, difficulty }) {
    for (let tries = 0; tries < 80; tries++) {
      const col = rng.pick(NC_COLS);
      const k = rng.int(5, difficulty === 3 ? 10 : 8);
      const idx = rng.sample(range(NROWS), k).sort((a, b) => a - b);
      const cells = castColumn(col, 'INT', idx);
      const answer = cells.filter((c) => c.value === null).length;
      const kept = k - answer;
      if (answer === 0 || answer === k || kept === answer) continue;
      return {
        vars: { col, k, answer, kept, ddl: col + ' INT', table: rawTable(idx, [col]), nullList: cells.filter((c) => c.value === null).map((c) => c.raw).join(', ') },
        misconceptions: [
          { value: 0, feedback: 'Spark raises no error here, but values that are not whole numbers still turn into NULL.' },
          { var: 'kept', feedback: 'That counts the values that fit INT. The question asks for the NULLs.' },
          { var: 'k', feedback: 'Whole numbers such as 22 or 8 fit INT and are kept. Only the others become NULL.' },
        ],
      };
    }
    throw new Error('nullCountQ: no draw');
  }

  // describe() mean of a few real trips.
  const MEAN_COLS = ['fare_amount', 'tip_amount', 'trip_distance', 'total_amount'];
  function meanQ({ rng, difficulty }) {
    for (let tries = 0; tries < 50; tries++) {
      const col = rng.pick(MEAN_COLS);
      const k = rng.int(3, difficulty === 1 ? 4 : 5);
      const idx = rng.sample(range(NROWS), k);
      const t = dfReadCsv(csvText(idx, [col]), { header: true, inferSchema: true });
      const row = dfCollect(dfAgg(t, [{ fn: 'sum', col, alias: 's' }, { fn: 'mean', col, alias: 'm' }]))[0];
      const answer = row.m;
      const sum = row.s;
      const wrongDiv = sum / (k - 1);
      if (Math.abs(answer - sum) < 0.02 || Math.abs(answer - wrongDiv) < 0.02) continue;
      return {
        vars: { col, k, answer, sum, wrongDiv, table: rawTable(idx, [col]) },
        misconceptions: [
          { var: 'sum', feedback: 'That is the sum. The mean divides the sum by how many values there are.' },
          { var: 'wrongDiv', feedback: 'Divide by the number of values, {=k}, not {=k} − 1. Only the standard deviation uses n − 1.' },
        ],
      };
    }
    throw new Error('meanQ: no draw');
  }

  // describe() count and mean when a wrong INT type left NULLs in the column.
  function describeNullQ({ rng, difficulty }) {
    for (let tries = 0; tries < 80; tries++) {
      const col = rng.pick(['fare_amount', 'tip_amount']);
      const k = rng.int(5, difficulty === 3 ? 8 : 6);
      const idx = rng.sample(range(NROWS), k).sort((a, b) => a - b);
      const t = dfReadCsv(csvText(idx, [col]), { header: true, schema: col + ' INT' });
      const st = dfCollect(dfDescribe(t));
      const count = Number(st.find((r) => r.summary === 'count')[col]);
      if (count === 0 || count === k) continue;
      const sum = dfCollect(dfAgg(t, [{ fn: 'sum', col, alias: 's' }]))[0].s;
      if (!sum) continue;
      const mean = Number(st.find((r) => r.summary === 'mean')[col]);
      return {
        vars: { col, k, count, sum, mean, wrongMean: sum / k, nulls: k - count, table: rawTable(idx, [col]) },
      };
    }
    throw new Error('describeNullQ: no draw');
  }

  // describe() on a text column, line by line: count and mean treat the text as numbers, min and max
  // compare it as text. Redraws until both text extremes differ from the numeric ones.
  function describeTextQ({ rng }) {
    for (let tries = 0; tries < 200; tries++) {
      const col = rng.pick(SM_COLS);
      const k = rng.int(4, 6);
      const idx = rng.sample(range(NROWS), k);
      const text = csvText(idx, [col]);
      const sd = dfCollect(dfDescribe(dfReadCsv(text, { header: true })));
      const typed = dfReadCsv(text, { header: true, inferSchema: true });
      const nd = dfCollect(dfDescribe(typed));
      const get = (rows, s) => rows.find((r) => r.summary === s)[col];
      const count = Number(get(sd, 'count'));
      const mean = Number(get(sd, 'mean'));
      const minText = get(sd, 'min');
      const maxText = get(sd, 'max');
      const min = Number(minText);
      const max = Number(maxText);
      const numMin = Number(get(nd, 'min'));
      const numMax = Number(get(nd, 'max'));
      if ([numMin, numMax].includes(min) || [numMin, numMax].includes(max)) continue;
      const sum = dfCollect(dfAgg(typed, [{ fn: 'sum', col, alias: 's' }]))[0].s;
      if (Math.abs(sum - mean) < 0.02) continue;
      const values = idx.map((i) => RAW[i][HEADER.indexOf(col)]);
      return {
        vars: { col, k, count, mean, sum, min, max, minText, maxText, numMin, numMax, valuesText: values.join(', '), table: rawTable(idx, [col]) },
      };
    }
    throw new Error('describeTextQ: no draw');
  }

  // A schema with two wrong INT types on a small file, end to end: count() counts rows, the letters
  // become NULL, describe() counts and averages only the fares that fit INT.
  const WS_COLS = ['VendorID', 'store_and_fwd_flag', 'fare_amount'];
  const WS_DDL = 'VendorID INT, store_and_fwd_flag INT, fare_amount INT';
  function wrongSchemaQ({ rng }) {
    for (let tries = 0; tries < 200; tries++) {
      const k = rng.int(5, 7);
      const idx = rng.sample(range(NROWS), k).sort((a, b) => a - b);
      const text = csvText(idx, WS_COLS);
      const t = dfReadCsv(text, { header: true, schema: WS_DDL });
      const rows = dfCount(t);
      const flagNulls = dfCount(dfFilter(t, { col: 'store_and_fwd_flag', op: 'isNull' }));
      const st = dfCollect(dfDescribe(t, ['fare_amount']));
      const fareKept = Number(st.find((r) => r.summary === 'count').fare_amount);
      if (fareKept === 0 || fareKept === rows) continue;
      const fareMean = Number(st.find((r) => r.summary === 'mean').fare_amount);
      const fareSum = dfCollect(dfAgg(t, [{ fn: 'sum', col: 'fare_amount', alias: 's' }]))[0].s;
      const allMean = dfCollect(dfAgg(dfReadCsv(text, { header: true, inferSchema: true }), [{ fn: 'mean', col: 'fare_amount', alias: 'm' }]))[0].m;
      const wrongMean = fareSum / rows;
      if (Math.abs(allMean - fareMean) < 0.02 || Math.abs(wrongMean - fareMean) < 0.02) continue;
      const nullList = castColumn('fare_amount', 'INT', idx).filter((c) => c.value === null).map((c) => c.raw).join(', ');
      const code = 'schema = "' + WS_DDL + '"\ntrips = spark.read.csv(path, header=True, schema=schema)';
      return {
        vars: {
          rows, lines: rows + 1, flagNulls, fareKept, fareSum, fareMean, wrongMean, allMean, nullList,
          block: dfToTextBlock(text.replace(/\n$/, '')), codeBlock: '```python\n' + code + '\n```',
        },
      };
    }
    throw new Error('wrongSchemaQ: no draw');
  }

  // Sample standard deviation of 3-4 real fares, by hand.
  function stddevQ({ rng, difficulty }) {
    for (let tries = 0; tries < 80; tries++) {
      const k = difficulty === 3 ? rng.int(3, 4) : 3;
      const idx = rng.sample(range(NROWS), k);
      const t = dfReadCsv(csvText(idx, ['fare_amount']), { header: true, inferSchema: true });
      const r = dfCollect(dfAgg(t, [{ fn: 'mean', col: 'fare_amount', alias: 'm' }, { fn: 'var_samp', col: 'fare_amount', alias: 'v' }, { fn: 'stddev', col: 'fare_amount', alias: 's' }]))[0];
      if (!(r.v > 0)) continue;
      const ss = r.v * (k - 1);
      const popVar = ss / k;
      if (Math.abs(Math.sqrt(popVar) - r.s) < 0.05 || Math.abs(r.v - r.s) < 0.05) continue;
      return {
        vars: { k, mean: r.m, ss, variance: r.v, stddev: r.s, popVar, popSd: Math.sqrt(popVar), table: rawTable(idx, ['fare_amount']), nMinus1: k - 1 },
      };
    }
    throw new Error('stddevQ: no draw');
  }

  // Shares from the real full-data groupBy (truth full.csv_infer.vendor_flag).
  function flagShareQ({ rng }) {
    const v = vendorFlagTable({});
    const target = rng.pick(['all', 'vendor1']);
    const base = target === 'all' ? v.total : v.vendor1;
    return {
      vars: {
        target,
        whose: target === 'all' ? 'all trips' : 'the trips from vendor 1',
        block: v.block,
        base,
        y: v.y,
        pct: 100 * v.y / base,
        fraction: v.y / base,
        wrongBase: target === 'all' ? v.pctYv1 : v.pctY,
        total: v.total,
        vendor1: v.vendor1,
        vendor2: v.vendor2,
      },
    };
  }

  // type() of one expression, with the real type strings as options.
  const TYPE_KINDS = ['DataFrame', 'Column', 'list', 'int', 'SparkSession'];
  function typeOfQ({ rng }) {
    const expr = rng.pick(Object.keys(EXPRS));
    const kind = EXPRS[expr].type;
    const others = rng.sample(TYPE_KINDS.filter((x) => x !== kind), 3);
    const kinds = [kind].concat(others);
    return {
      vars: { expr, word: TYPE_WORD[kind] },
      options: kinds.map((x) => '`' + DF_PY_TYPES[x] + '`'),
      answer: 0,
    };
  }

  return {
    fns: {
      readTaxi, rawCsv, describeTaxi, pandasTaxi, flagCheck, failfastCheck, runCells, typeOf, vendorFlagTable, pickupRange, taxiFromDataset,
      cellsNeeded, inferSheet, inferWalk, castSheet, castWalk, describeSheet, describeWalk, helpExcerpt,
      sessionCode, readCode, showCode, inferCode, castCode, describeCode, limitCode,
      fullRead, fullFlag, fullFailfast, fullDescribe, fullChecks,
    },
    generators: {
      runOrderQ, headerCountQ, showRowsQ, stringMaxQ, nullCountQ, meanQ, describeNullQ, describeTextQ, wrongSchemaQ, stddevQ, flagShareQ, typeOfQ,
    },
  };
}
