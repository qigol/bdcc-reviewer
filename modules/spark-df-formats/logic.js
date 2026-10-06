// Qdigo module: spark-df-formats (Spark DataFrames III: Parquet, JSON and Graded Problems)
// logic.js = the shared mini-DataFrame engine (pasted verbatim, engine/engine.js v1.0.0, 498/498 checks
// against real Spark 4.0.1) followed by this module's lesson fns, walks, code traces and quiz generators.
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
  // DDL of the original notebook's cell 35 schema, adapted to the 10 taxi12 columns (flag INT = the bug).
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
  // spark-df-formats (M3, Sessions 5-6): Parquet, JSON and the graded problems.
  // Every Spark output a learner sees is computed by the engine above (byte-exact against real
  // Spark 4.0.1 runs) or comes from a dataset copied from SCRATCH/truth (see SOURCE_NOTES.md).
  // Conventions: taxi12 is read with header=True, inferSchema=True from BASE/lessons/taxi12.csv;
  // gh8 with spark.read.json from BASE/lessons/gh8.jsonl. Output strings come in three forms:
  //   *Block  = a ```text fence for a Text widget (dfShowBlock / dfToTextBlock),
  //   *Lines  = the raw text split into lines (used by examples.yaml),
  //   md      = a GFM table (dfToMarkdownTable) for quiz `show` widgets.
  // ==========================================================================================
  const PATH12 = DF_VOLUME + '/lessons/taxi12.csv';
  const PATHGH = DF_VOLUME + '/lessons/gh8.jsonl';
  const TAXI = dfReadCsv(DF_TAXI12_CSV, { header: true, inferSchema: true, path: PATH12 });
  const EV = dfReadJson(DF_GH8_JSONL, { path: PATHGH });
  const TCOLS = dfColumns(TAXI);
  const N12 = TAXI.rows.length;

  // ---------------------------------------------------------------- small helpers
  const seq = (n) => Array.from({ length: n }, (_, i) => i);
  const subset = (t, idx) => dfWithRows(t, t.columns, idx.map((i) => t.rows[i]));
  const canon = (t, name) => {
    const i = dfFindColumn(t.columns, name);
    if (i < 0) throw new Error('unknown column ' + name);
    return t.columns[i].name;
  };
  const linesOf = (s) => String(s).replace(/\n+$/, '').split('\n');
  const dec = (x, d = 2) => {
    const f = Math.pow(10, d);
    const r = Math.round(x * f) / f;
    return String(Object.is(r, -0) ? 0 : r);
  };
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
  const near = (a, b, t = 0.011) => Math.abs(a - b) < t;
  const valText = (t, ci, v) => dfFormatValue(v, t.columns[ci].type);
  const cellTex = (s) => dfTexText(String(s));
  // a GFM table from plain header + rows of strings (for data that is not a Spark output)
  const mdTable = (header, rows) => [
    '| ' + header.join(' | ') + ' |',
    '| ' + header.map(() => '---').join(' | ') + ' |',
    ...rows.map((r) => '| ' + r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ') + ' |'),
  ].join('\n');

  // ---------------------------------------------------------------- the 12 lesson trips
  // Widget props for the taxi12 table (inferSchema read). cols: names (default all); rows: indices.
  function taxiView({ cols = null, rows = null, n = 20 }) {
    let t = rows ? subset(TAXI, rows) : TAXI;
    if (cols && cols.length) t = dfSelect(t, cols);
    return {
      matrix: dfToMatrix(t, { rowLabels: 'one' }),
      show: dfShowBlock(t, { n }),
      md: dfToMarkdownTable(t),
      columns: dfColumns(t),
      count: dfCount(t),
      schema: dfToTextBlock(dfPrintSchemaString(t)),
      schemaLines: linesOf(dfPrintSchemaString(t)),
    };
  }

  // ---------------------------------------------------------------- Session 5: row vs column layout
  // Order in which a "k columns needed" slider adds columns (the first is the one averaged).
  const LAYOUT_ORDER = ['fare_amount', 'PULocationID', 'tip_amount', 'VendorID', 'DOLocationID', 'trip_distance',
    'total_amount', 'passenger_count', 'lpep_pickup_datetime', 'store_and_fwd_flag'];

  // How many values a question must read from the 12 trips: a row layout (CSV) reads every value of
  // every row; a column layout (Parquet) reads only the needed columns. need = column names, or k = how many.
  function layoutRead({ layout = 'column', need = null, k = null }) {
    const cols = need && need.length
      ? need.map((c) => canon(TAXI, c))
      : LAYOUT_ORDER.slice(0, Math.max(1, Math.min(TCOLS.length, k || 1)));
    const n = N12, c = TCOLS.length, kk = cols.length;
    const rowValues = n * c, colValues = n * kk;
    const valuesRead = layout === 'row' ? rowValues : colValues;
    return {
      layout, need: cols, k: kk, n, c, rowValues, colValues, valuesRead,
      skipped: rowValues - valuesRead,
      share: valuesRead / rowValues,
      sel: layout === 'row' ? TCOLS.map((x) => 'col:' + x) : cols.map((x) => 'col:' + x),
      needSel: cols.map((x) => 'col:' + x),
      unneededSel: TCOLS.filter((x) => cols.indexOf(x) < 0).map((x) => 'col:' + x),
    };
  }

  // Count-along for "the average fare_amount of the 12 trips", read row by row (CSV) or from the
  // fare column alone (Parquet). One step per value of fare_amount, then the mean.
  // roles: table (Matrix from taxiView: rows labelled 1-12, columns = column names).
  function layoutWalk({ layout = 'row' }) {
    const fi = dfFindColumn(TAXI.columns, 'fare_amount');
    const c = TCOLS.length;
    const per = layout === 'row' ? c : 1;
    const trace = [{
      label: layout === 'row'
        ? 'CSV stores trip after trip. To reach each fare we must read the whole row.'
        : 'Parquet stores each column together. Open only the `fare_amount` column.',
      vars: { valuesRead: 0 },
      ops: [{ role: 'table', cmd: 'clear' }],
    }];
    let sum = 0;
    TAXI.rows.forEach((r, i) => {
      sum += r[fi];
      const read = per * (i + 1);
      trace.push({
        label: layout === 'row'
          ? `Row ${i + 1}: read all ${c} values to get the fare ${valText(TAXI, fi, r[fi])}. Values read: ${read}.`
          : `Fare ${i + 1}: ${valText(TAXI, fi, r[fi])}. Values read: ${read}.`,
        vars: { row: i + 1, fare: r[fi], valuesRead: read, runningSum: sum },
        ops: layout === 'row'
          ? [{ role: 'table', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: 'muted' } },
            { role: 'table', cmd: 'highlight', args: { sel: `cell:${i + 1},fare_amount`, tone: 'accent' } }]
          : [{ role: 'table', cmd: 'highlight', args: { sel: 'col:fare_amount', tone: 'muted' } },
            { role: 'table', cmd: 'highlight', args: { sel: `cell:${i + 1},fare_amount`, tone: 'accent' } }],
      });
    });
    const mean = dfCollect(dfAgg(TAXI, [{ fn: 'mean', col: 'fare_amount', alias: 'm' }]))[0].m;
    const valuesRead = per * N12;
    trace.push({
      label: `Mean fare $= ${dec(sum, 1)} / ${N12} = ${dec(mean)}$. Values read: ${valuesRead}; values needed: ${N12}.`,
      vars: { sum, mean, valuesRead },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: 'col:fare_amount', tone: 'good' } }],
    });
    return { trace, steps: trace.length, valuesRead, sum, mean };
  }

  // ---------------------------------------------------------------- Session 5: partitioned writes
  // What trips12.write.parquet(path, mode="overwrite", partitionBy=cols) leaves in the folder, for the
  // 12 trips (or a subset `rows`). Folder names are column=value; dbutils.fs.ls lists names sorted by
  // code point, so _SUCCESS comes before lowercase names. Reading the folder back puts the partition
  // columns at the END of the schema (truth m3.write.readback_printSchema, m3x.write_*).
  // counts = false leaves the row counts off the folder labels (a walk then counts them along).
  // code = the lessons' write cell for these columns (trips12 holds the 12 lesson trips).
  const writeCell = (pcols) => 'trips12.write.parquet(\n    f"{BASE}/output/sample_write",\n    mode="overwrite",\n    partitionBy=['
    + pcols.map((c) => '"' + c + '"').join(', ') + '],\n)';
  function partitionWrite({ cols = ['VendorID'], rows = null, name = 'sample_write', counts: withCounts = true }) {
    const t = rows ? subset(TAXI, rows) : TAXI;
    const pcols = cols.map((c) => canon(t, c));
    const idx = pcols.map((c) => dfFindColumn(t.columns, c));
    const folderOf = (r, level) => pcols[level] + '=' + (r[idx[level]] === null ? '__HIVE_DEFAULT_PARTITION__' : String(r[idx[level]])) + '/';
    const byName = (a, b) => dfCmpStr(a, b);
    // nested folder map
    const build = (rowsIn, level) => {
      if (level >= pcols.length) return null;
      const groups = {};
      rowsIn.forEach((r) => { const f = folderOf(r, level); (groups[f] = groups[f] || []).push(r); });
      return Object.keys(groups).sort(byName).map((f) => ({ name: f, rows: groups[f].length, children: build(groups[f], level + 1) }));
    };
    const tree = build(t.rows, 0);
    const names = tree.map((f) => f.name).concat(['_SUCCESS']).sort(byName);
    let leaf = 0;
    const toNode = (f, prefix) => {
      const id = slug(prefix + '-' + f.name);
      if (!f.children) leaf += 1;
      const node = {
        id, label: f.name,
        children: f.children ? f.children.map((ch) => toNode(ch, id)) : [{ id: id + '-data', label: 'part-….snappy.parquet' }],
      };
      if (withCounts) node.note = f.rows + (f.rows === 1 ? ' row' : ' rows');
      return node;
    };
    const kids = tree.map((f) => toNode(f, 'p'));
    const root = {
      id: 'root', label: name + '/',
      children: names.map((nm) => (nm === '_SUCCESS' ? { id: 'success', label: '_SUCCESS', note: 'empty marker: the write finished' } : kids.find((k) => k.label === nm))),
    };
    const others = dfColumns(t).filter((c) => pcols.indexOf(c) < 0);
    const back = dfSelect(t, others.concat(pcols));
    const counts = dfOrderBy(dfGroupCount(dfGroupBy(t, [pcols[0]])), [pcols[0]]);
    const inside = {};
    tree.forEach((f) => { if (f.children) inside[f.name] = f.children.map((ch) => ch.name); });
    return {
      code: writeCell(pcols),
      cols: pcols, folders: tree.length, leafFolders: leaf, rowsWritten: t.rows.length,
      names, lsText: dfToTextBlock(names.join('\n')), inside,
      folderRows: tree.map((f) => ({ folder: f.name, rows: f.rows })),
      tree: root,
      readbackSchema: dfToTextBlock(dfPrintSchemaString(back)),
      readbackLines: linesOf(dfPrintSchemaString(back)),
      countsShow: dfShowBlock(counts), countsLines: linesOf(dfShowString(counts)),
    };
  }

  // Tree node ids that partitionWrite gives the folders of one row (top level first).
  const folderIds = (pcols, idx, r) => {
    const names = pcols.map((c, l) => c + '=' + (r[idx[l]] === null ? '__HIVE_DEFAULT_PARTITION__' : String(r[idx[l]])) + '/');
    const ids = [];
    names.forEach((nm, l) => ids.push(slug((l ? ids[l - 1] : 'p') + '-' + nm)));
    return { names, ids };
  };

  // Count-along for a partitioned write of the 12 trips: one trip per step goes to the folder named
  // after its value(s); the top folder's running row count is annotated on the Tree.
  // roles: trips (Matrix of taxi12, rows 1-12), tree (Tree from partitionWrite with counts: false). No patch.
  function partitionWalk({ cols = ['VendorID'] }) {
    const pw = partitionWrite({ cols, counts: false });
    const idx = pw.cols.map((c) => dfFindColumn(TAXI.columns, c));
    const running = {};
    const trace = [{
      label: `Split by ${pw.cols.map((c) => '`' + c + '`').join(', then ')}: each trip goes to the folder named after its value.`,
      vars: { folders: 0 },
      ops: [{ role: 'tree', cmd: 'clear' }, { role: 'trips', cmd: 'clear' }, { role: 'trips', cmd: 'highlight', args: { sel: pw.cols.map((c) => 'col:' + c), tone: 'accent' } }],
    }];
    TAXI.rows.forEach((r, i) => {
      const f = folderIds(pw.cols, idx, r);
      running[f.ids[0]] = (running[f.ids[0]] || 0) + 1;
      const n = running[f.ids[0]];
      trace.push({
        label: `Trip ${i + 1} goes to \`${f.names.join('')}\`. \`${f.names[0]}\` now holds ${n} ${n === 1 ? 'trip' : 'trips'}.`,
        vars: { trip: i + 1, folder: f.names.join(''), rows: n, folders: Object.keys(running).length },
        ops: [
          { role: 'trips', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: 'accent' } },
          { role: 'tree', cmd: 'highlight', args: { sel: f.ids.map((x) => 'node:' + x), tone: 'accent' } },
          { role: 'tree', cmd: 'annotate', args: { sel: 'node:' + f.ids[0], text: n + (n === 1 ? ' trip' : ' trips') } },
        ],
      });
    });
    trace.push({
      label: `${pw.folders} top-level folders, plus \`_SUCCESS\`: an empty file Spark writes last, when the save has finished.`,
      vars: { folders: pw.folders },
      ops: [{ role: 'tree', cmd: 'highlight', args: { sel: 'node:success', tone: 'good' } }],
    });
    return { trace, steps: trace.length, folders: pw.folders, folderRows: pw.folderRows };
  }

  // ---------------------------------------------------------------- Session 5: Problem 1 timings
  // timing = the p1timing dataset (operation, csv_s, parquet_s): medians of 3 runs on a local laptop,
  // Spark 4.0.1 (problems.json P1). ratio = CSV time / Parquet time; below 1 means Parquet was slower.
  // P1_WHAT: what each timed cell computes, in plain words (describe() skips the two timestamp columns,
  // so it summarizes 17 of the 19 columns: truth/p1_compare.json outputs "89 describe().toPandas()").
  const P1_WHAT = {
    'describe().toPandas()': 'a summary of every number and text column (17 of 19)',
    'describe("PULocationID").show()': 'a summary of one column',
    'freqItems+explode .show()': 'the most frequent pickup zones, one per row',
    'groupby/count/orderBy desc .show()': 'trips per pickup zone, busiest first',
    'cast/groupby/sum/describe .show()': 'total paid per vendor, summarized',
    'filter 264->193 .limit(10).toPandas()': 'ten trips from zone 264 to zone 193',
  };
  function timingTable({ timing }) {
    const rows = timing.rows.map(([op, csv, pq]) => ({ op, what: P1_WHAT[op] || '', csv, parquet: pq, ratio: csv / pq, faster: csv > pq }));
    return {
      rows,
      ops: rows.map((r) => r.op),
      ratios: rows.map((r) => r.ratio),
      series: [
        { name: 'CSV', x: rows.map((_, i) => 'op ' + (i + 1)), y: rows.map((r) => r.csv) },
        { name: 'Parquet', x: rows.map((_, i) => 'op ' + (i + 1)), y: rows.map((r) => r.parquet) },
      ],
      md: mdTable(['#', 'operation', 'what it does', 'CSV (s)', 'Parquet (s)', 'CSV ÷ Parquet'],
        rows.map((r, i) => [String(i + 1), '`' + r.op + '`', r.what, String(r.csv), String(r.parquet), dec(r.ratio, 1) + '×'])),
    };
  }

  // One Problem 1 operation (op = 1-based row of the p1timing dataset), for a Choice + Readout.
  function timingPick({ timing, op = 1 }) {
    const tt = timingTable({ timing });
    const k = Math.max(1, Math.min(tt.rows.length, Math.round(op))) - 1;
    const r = tt.rows[k];
    return {
      op: r.op, csv: r.csv, parquet: r.parquet, ratio: r.ratio, faster: r.faster,
      verdict: r.faster ? 'Parquet was ' + dec(r.ratio, 1) + ' times faster' : 'Parquet was slower (ratio ' + dec(r.ratio, 1) + ')',
      options: tt.rows.map((x, i) => ({ value: i + 1, label: x.op })),
    };
  }

  // Which code anchor runs each Problem 1 operation (the p1timing labels).
  const P1_ANCHOR = {
    'describe().toPandas()': 'allcols', 'describe("PULocationID").show()': 'onecol', 'freqItems+explode .show()': 'freq',
    'groupby/count/orderBy desc .show()': 'group', 'cast/groupby/sum/describe .show()': 'cast', 'filter 264->193 .limit(10).toPandas()': 'filter',
  };

  // Step through the Problem 1 section line by line: the setup read, the section's own import, then
  // one step per timed cell with both times and the ratio (problems.json P1, local laptop).
  // anchors: parquet, imports, allcols, onecol, freq, group, cast, filter. roles: chart (Chart of tt.series).
  function p1Walk({ timing }) {
    const tt = timingTable({ timing });
    const trace = [
      { label: 'Setup cell: `trips` is now the Parquet folder. Session 3 ran these cells on the CSV files.', code: 'parquet', math: 'parquet', vars: { ops: tt.rows.length }, ops: [{ role: 'chart', cmd: 'clear' }, { role: 'chart', cmd: 'highlight', args: { sel: 'series:Parquet', tone: 'accent' } }] },
      { label: 'The section imports `explode` and `desc` itself, so it also runs on its own after a restart.', code: 'imports', math: 'imports', vars: { imported: 'explode, desc' }, ops: [{ role: 'chart', cmd: 'clear' }] },
    ];
    tt.rows.forEach((r, i) => {
      const a = P1_ANCHOR[r.op] || 'onecol';
      trace.push({
        label: r.faster
          ? `\`${r.op}\`: CSV ${r.csv} s, Parquet ${r.parquet} s, so $${r.csv} / ${r.parquet} = ${dec(r.ratio, 1)}$ times faster.`
          : `\`${r.op}\`: CSV ${r.csv} s, Parquet ${r.parquet} s, so $${r.csv} / ${r.parquet} = ${dec(r.ratio, 1)}$: Parquet was slower.`,
        code: a, math: a,
        vars: { op: r.op, csv: r.csv, parquet: r.parquet, ratio: r.ratio },
        ops: [{ role: 'chart', cmd: 'highlight', args: { sel: [`point:CSV,${i}`, `point:Parquet,${i}`], tone: r.faster ? 'good' : 'bad' } }],
      });
    });
    return { trace, steps: trace.length, ratios: tt.ratios };
  }

  // ---------------------------------------------------------------- Session 5: restart and run a section alone
  // pucounts = dataset (PULocationID, count): the real top-20 pickup zones of the Parquet data.
  // cell: 'desc' (original cell 92) or 'explode' (original cell 91); fix: 'none' | 'import' | 'F'.
  const CELL92 = '(trips.groupby(trips["PULocationID"]).count().orderBy(desc("count")).show())';
  const CELL92_F = '(trips.groupby(trips["PULocationID"]).count().orderBy(F.desc("count")).show(5))';
  const CELL91 = ['(', '    trips.freqItems(["PULocationID"], 0.01)', '    .withColumn("freq_items", explode("PULocationID_freqItems"))', '    .drop("PULocationID_freqItems")', '    .show()', ')'];
  // Real output of the fixed cell 91 on the Parquet folder (truth p1.pq.freqitems, top 20 of more rows).
  // F.explode is the very function that `from pyspark.sql.functions import explode` imports, so both fixes print it.
  const FREQ_PQ = [256, 260, 7, 264, 14, 17, 18, 20, 21, 24, 25, 26, 33, 34, 35, 36, 37, 40, 41, 42];
  function restartRun({ cell = 'desc', fix = 'none', pucounts = null }) {
    const imp = 'from pyspark.sql.functions import explode, desc';
    if (cell === 'explode') {
      const code = (fix === 'import' ? [imp, ''] : []).concat(fix === 'F' ? CELL91.map((l) => l.replace('explode(', 'F.explode(')) : CELL91).join('\n');
      const title = 'The Problem 1 cell with `explode`, run right after the restart' + (fix === 'none' ? '' : fix === 'import' ? ', with the import added' : ', with `F.explode`');
      if (fix === 'none') {
        const tb = dfTraceback({ cell: 2, line: 3, code: '.withColumn("freq_items", explode("PULocationID_freqItems"))', caret: ' '.repeat(26) + '^^^^^^^', skipped: false, text: dfPyErrorText('NameError', { name: 'explode' }) });
        return { ok: false, code, title, errorName: 'NameError', output: dfToTextBlock(tb), outputLines: linesOf(tb) };
      }
      const t = dfFromRows('freq_items INT', FREQ_PQ.map((v) => [v]).concat([[0]]));
      const s = dfShowString(t, { n: 20 });
      return { ok: true, code, title, errorName: null, output: dfToTextBlock(s), outputLines: linesOf(s) };
    }
    const code = fix === 'import' ? imp + '\n\n' + CELL92 : fix === 'F' ? CELL92_F : CELL92;
    const title = 'The Problem 1 cell with `desc`, run right after the restart' + (fix === 'none' ? '' : fix === 'import' ? ', with the import added' : ', with `F.desc`');
    if (fix === 'none') {
      const tb = dfTraceback({ cell: 3, code: CELL92, caret: ' '.repeat(54) + '^^^^', skipped: false, text: dfPyErrorText('NameError', { name: 'desc' }) });
      return { ok: false, code, title, errorName: 'NameError', output: dfToTextBlock(tb), outputLines: linesOf(tb) };
    }
    const rows = pucounts ? pucounts.rows : [];
    const t = dfFromRows('PULocationID INT, count BIGINT', rows.concat(rows.length ? [[0, 0]] : []));
    const s = dfShowString(t, { n: fix === 'F' ? 5 : 20 });
    return { ok: true, code, title, errorName: null, output: dfToTextBlock(s), outputLines: linesOf(s) };
  }

  // ---------------------------------------------------------------- Session 5: groupBy two columns, count (Problem 2)
  function pairStats(t) {
    const g = dfGroupCount(dfGroupBy(t, ['PULocationID', 'DOLocationID']));
    const byCount = dfOrderBy(g, [{ desc: 'count' }]);
    const ranked = dfOrderBy(g, [{ desc: 'count' }, 'PULocationID', 'DOLocationID']);
    const top = dfFirst(byCount);
    const rk = dfCollect(ranked);
    const pu = dfCollect(dfGroupCount(dfGroupBy(t, ['PULocationID'])));
    return { g, byCount, ranked, top, rk, puGroups: pu.length, puCounts: pu };
  }

  // Problem 2 on the 12 trips (or a subset): groupBy("PULocationID", "DOLocationID").count(), sorted.
  function pairCount({ rows = null }) {
    const t = rows ? subset(TAXI, rows) : TAXI;
    const s = pairStats(t);
    return {
      groups: s.rk.length, puGroups: s.puGroups,
      top: [s.top.PULocationID, s.top.DOLocationID, s.top.count], topCount: s.top.count,
      secondCount: s.rk.length > 1 ? s.rk[1].count : 0,
      show: dfShowBlock(s.ranked), showLines: linesOf(dfShowString(s.ranked)),
      firstRepr: dfRowRepr(s.byCount, 0), tupleRepr: dfTupleRepr(s.byCount, 0),
      md: dfToMarkdownTable(s.ranked),
    };
  }

  // The pair tally after the first `upTo` trips (first-occurrence order), for a Matrix.
  function pairSheet({ upTo = 99 }) {
    const pu = dfFindColumn(TAXI.columns, 'PULocationID'), dl = dfFindColumn(TAXI.columns, 'DOLocationID');
    const keys = [], tally = {};
    TAXI.rows.forEach((r) => { const k = r[pu] + '-' + r[dl]; if (keys.indexOf(k) < 0) keys.push(k); });
    TAXI.rows.slice(0, Math.max(0, upTo)).forEach((r) => { const k = r[pu] + '-' + r[dl]; tally[k] = (tally[k] || 0) + 1; });
    return {
      rows: keys, cols: ['count'],
      values: keys.map((k) => [tally[k] === undefined ? null : tally[k]]),
      seen: Object.keys(tally).length,
    };
  }

  // Count-along for Problem 2 on taxi12: one trip per step, ending at the full tally. It stops before the
  // sort and first(), because the next beat asks the learner to predict them.
  // roles: trips (Matrix of taxi12, rows 1-12), tally (Matrix from pairSheet). Patches pairUpTo.
  function pairCountWalk({}) {
    const pu = dfFindColumn(TAXI.columns, 'PULocationID'), dl = dfFindColumn(TAXI.columns, 'DOLocationID');
    const tally = {};
    const trace = [{ label: 'Start with an empty tally: one counter per (pickup, drop-off) pair.', patch: { pairUpTo: 0 }, vars: { tripsRead: 0 }, ops: [{ role: 'tally', cmd: 'clear' }] }];
    TAXI.rows.forEach((r, i) => {
      const k = r[pu] + '-' + r[dl];
      tally[k] = (tally[k] || 0) + 1;
      trace.push({
        label: `Trip ${i + 1}: pair (${r[pu]}, ${r[dl]})${tally[k] > 1 ? ' again' : ''}, so its count becomes ${tally[k]}.`,
        patch: { pairUpTo: i + 1 },
        vars: { trip: i + 1, pair: k, count: tally[k] },
        ops: [{ role: 'trips', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: 'accent' } },
          { role: 'tally', cmd: 'highlight', args: { sel: 'row:' + k, tone: tally[k] > 1 ? 'good' : 'accent' } }],
      });
    });
    const s = pairStats(TAXI);
    return { trace, steps: trace.length, groups: s.rk.length, result: s.top };
  }

  // The notebook's first() cells (ported cells 177-178) on taxi12, line by line, with one count() step
  // per vendor: row = trips.groupBy("VendorID").count().orderBy(F.desc("count")).first(), then
  // print(row["count"], row[0], tuple(row)) (truth m3x.vendor_first, m3x.vendor_first_print).
  // anchors: group, count, order, first, tuple. roles: table (live Matrix of taxi12 with VendorID, rows 1-12).
  function firstRowCode({}) {
    const g = dfGroupCount(dfGroupBy(TAXI, ['VendorID']));
    const byCount = dfOrderBy(g, [{ desc: 'count' }]);
    const top = dfFirst(byCount);
    const vi = dfFindColumn(TAXI.columns, 'VendorID');
    const rowsOf = (v) => TAXI.rows.map((r, i) => (r[vi] === v ? 'row:' + (i + 1) : null)).filter(Boolean);
    const groups = dfCollect(dfOrderBy(g, ['VendorID']));
    const rowRepr = dfRowRepr(byCount, 0), tup = dfTupleRepr(byCount, 0);
    const printLine = top.count + ' ' + top.VendorID + ' ' + tup;
    const trace = [{
      label: '`groupBy("VendorID")`: trips with the same vendor form one group. No table yet: GroupedData.', code: 'group', math: 'group',
      vars: { type: 'GroupedData', groups: groups.length },
      ops: [{ role: 'table', cmd: 'clear' }, { role: 'table', cmd: 'highlight', args: { sel: 'col:VendorID', tone: 'accent' } }],
    }];
    groups.forEach((x) => trace.push({
      label: `\`.count()\` for vendor ${x.VendorID}: ${x.count} ${x.count === 1 ? 'trip' : 'trips'}.`, code: 'count', math: 'count',
      vars: { VendorID: x.VendorID, count: x.count },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: rowsOf(x.VendorID), tone: 'accent' } }],
    }));
    trace.push({ label: `\`.orderBy(F.desc("count"))\`: the biggest count first, ${top.count} for vendor ${top.VendorID}.`, code: 'order', math: 'order', vars: { topCount: top.count },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: rowsOf(top.VendorID), tone: 'good' } }] });
    trace.push({ label: `\`.first()\` is an action. It returns ${rowRepr}.`, code: 'first', math: 'first', vars: { row: rowRepr },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: rowsOf(top.VendorID), tone: 'good' } }] });
    trace.push({ label: `\`print(row["count"], row[0], tuple(row))\` prints \`${printLine}\`: by name, by position, as a tuple.`, code: 'tuple', math: 'tuple', vars: { result: tup },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: rowsOf(top.VendorID).map((x) => x.replace('row:', 'cell:') + ',VendorID'), tone: 'good' } }] });
    return { trace, steps: trace.length, groups: groups.length, result: [top.VendorID, top.count], printLine };
  }

  // ---------------------------------------------------------------- Session 5: groupBy + agg(mean) (Problem 3)
  function meanGroups(t, key, value) {
    const ki = dfFindColumn(t.columns, key), vi = dfFindColumn(t.columns, value);
    const res = dfCollect(dfOrderBy(dfAgg(dfGroupBy(t, [key]), [
      { fn: 'mean', col: value, alias: 'm' }, { fn: 'count', col: '*', alias: 'n' }, { fn: 'sum', col: value, alias: 's' }]), [key]));
    const kname = t.columns[ki].name;
    return res.map((r) => {
      const vals = t.rows.filter((row) => row[ki] === r[kname]).map((row) => row[vi]);
      return { key: r[kname], n: r.n, sum: r.s, mean: r.m, terms: vals.map((v) => valText(t, vi, v)).join(' + '), rowIdx: t.rows.map((row, i) => (row[ki] === r[kname] ? i : -1)).filter((i) => i >= 0) };
    });
  }

  // Problem 3 on taxi12: groupBy(key).agg(F.mean(value).alias(alias)).orderBy(key).
  function groupMean({ key = 'PULocationID', value = 'fare_amount', alias = 'mean fare amount', rows = null }) {
    const t = rows ? subset(TAXI, rows) : TAXI;
    const res = dfOrderBy(dfAgg(dfGroupBy(t, [key]), [{ fn: 'mean', col: value, alias }]), [key]);
    const groups = meanGroups(t, key, value);
    const overall = dfCollect(dfAgg(t, [{ fn: 'mean', col: value, alias: 'm' }]))[0].m;
    return {
      groups: groups.map(({ rowIdx, ...g }) => g),
      means: groups.map((g) => g.mean), keys: groups.map((g) => g.key), overall,
      show: dfShowBlock(res), showLines: linesOf(dfShowString(res)),
      pandas: dfToTextBlock(dfToPandasString(res)), pandasLines: linesOf(dfToPandasString(res)),
      md: dfToMarkdownTable(res), columns: dfColumns(res),
    };
  }

  // Worksheet for the per-zone means of fare_amount: zones done so far are filled.
  function meanSheet({ upTo = 99 }) {
    const g = meanGroups(TAXI, 'PULocationID', 'fare_amount');
    return {
      rows: g.map((x) => String(x.key)), cols: ['trips', 'sum', 'mean'],
      values: g.map((x, i) => (i < upTo ? [x.n, x.sum, x.mean] : [null, null, null])),
    };
  }

  // Count-along for Problem 3 on taxi12: one pickup zone per step.
  // roles: trips (Matrix of taxi12, rows 1-12), sheet (Matrix from meanSheet). Patches meanUpTo.
  function groupMeanWalk({}) {
    const g = meanGroups(TAXI, 'PULocationID', 'fare_amount');
    const trace = [{ label: 'Group the 12 trips by pickup zone, then average each group\'s fares.', patch: { meanUpTo: 0 }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    g.forEach((x, i) => {
      trace.push({
        label: `Zone ${x.key}: $(${x.terms}) / ${x.n} = ${dec(x.mean)}$`,
        patch: { meanUpTo: i + 1 },
        vars: { zone: x.key, trips: x.n, sum: x.sum, mean: x.mean },
        ops: [{ role: 'trips', cmd: 'highlight', args: { sel: x.rowIdx.map((j) => 'row:' + (j + 1)), tone: 'accent' } },
          { role: 'sheet', cmd: 'highlight', args: { sel: 'row:' + x.key, tone: 'good' } }],
      });
    });
    trace.push({ label: '`orderBy("PULocationID")` sorts the zones: 7, 33, 41, 74, 75, 97.', patch: { meanUpTo: g.length }, ops: [] });
    return { trace, steps: trace.length, zones: g.length, means: g.map((x) => x.mean) };
  }

  // The notebook's agg cell (ported cell 175) on taxi12, line by line, one F.mean step per vendor:
  // trips.groupBy("VendorID").agg(F.mean("tip_amount").alias("mean tip")).orderBy("VendorID").show()
  // (truth m3x.mean_tip_vendor). anchors: group, agg, alias, order.
  // roles: table (live Matrix of taxi12 with VendorID and tip_amount, rows 1-12).
  function meanTipCode({}) {
    const g = meanGroups(TAXI, 'VendorID', 'tip_amount');
    const trace = [{ label: `\`groupBy("VendorID")\`: ${g.length} vendors, ${g.length} groups.`, code: 'group', math: 'group', vars: { groups: g.length },
      ops: [{ role: 'table', cmd: 'clear' }, { role: 'table', cmd: 'highlight', args: { sel: 'col:VendorID', tone: 'accent' } }] }];
    g.forEach((x) => {
      trace.push({
        label: `\`F.mean("tip_amount")\` for vendor ${x.key}: $(${x.terms}) / ${x.n} = ${dec(x.mean, 4)}$`,
        code: 'agg', math: 'agg', vars: { VendorID: x.key, trips: x.n, mean: x.mean },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel: x.rowIdx.map((j) => 'row:' + (j + 1)), tone: 'accent' } }],
      });
    });
    trace.push({ label: '`.alias("mean tip")` names the new column `mean tip` instead of `avg(tip_amount)`.', code: 'alias', math: 'alias', vars: { column: 'mean tip' },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: 'col:tip_amount', tone: 'good' } }] });
    trace.push({ label: `\`.orderBy("VendorID")\` sorts the rows by vendor: ${g.map((x) => x.key).join(', ')}.`, code: 'order', math: 'order', vars: { rows: g.length },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: 'col:VendorID', tone: 'good' } }] });
    return { trace, steps: trace.length, means: g.map((x) => x.mean) };
  }

  // first() and the Row object on taxi12 (truth m3x.vendor_first, m3x.vendor_first_print).
  // block = both outputs as a ```text fence: `row`, then print(row["count"], row[0], tuple(row)).
  function vendorFirst({}) {
    const t = dfOrderBy(dfGroupCount(dfGroupBy(TAXI, ['VendorID'])), [{ desc: 'count' }]);
    const row = dfFirst(t);
    const printLine = row.count + ' ' + row.VendorID + ' ' + dfTupleRepr(t, 0);
    return {
      firstRepr: dfRowRepr(t, 0), tupleRepr: dfTupleRepr(t, 0),
      printLine,
      block: dfToTextBlock(dfRowRepr(t, 0) + '\n' + printLine),
      count: row.count, vendor: row.VendorID,
    };
  }

  // Discovery task (Session 5): what groupby returns, and the column F.mean / F.avg build.
  // The `F.mean is F.avg` part (False) is Python identity, not a Spark output: copy it from truth m3.mean_vs_avg.
  function meanVsAvg({ col = 'fare_amount' }) {
    return {
      groupedType: DF_PY_TYPES.GroupedData,
      meanRepr: "Column<'" + dfAggName({ fn: 'mean', col }) + "'>",
      avgRepr: "Column<'" + dfAggName({ fn: 'avg', col }) + "'>",
    };
  }

  // ---------------------------------------------------------------- Session 6: nested JSON (gh8)
  const treeIds = (node, prefix) => {
    const name = String(node.label).split(':')[0];
    const id = prefix ? prefix + '-' + slug(name) : 'root';
    const out = { id, label: node.label };
    if (node.children && node.children.length) out.children = node.children.map((ch) => treeIds(ch, id === 'root' ? 'c' : id));
    return out;
  };

  // events = spark.read.json(BASE/lessons/gh8.jsonl): show, schema, columns, and a Tree of the schema.
  function ghView({ cols = null, n = 20, truncate = true }) {
    const t = cols && cols.length ? dfSelect(EV, cols) : EV;
    return {
      count: dfCount(t), columns: dfColumns(t), columnsRepr: dfColumnsRepr(t),
      show: dfShowBlock(t, { n, truncate }), showLines: linesOf(dfShowString(t, { n, truncate })),
      schema: dfToTextBlock(dfPrintSchemaString(t)), schemaLines: linesOf(dfPrintSchemaString(t)),
      tree: treeIds(dfSchemaTree(t), ''),
      md: dfToMarkdownTable(dfSelect(EV, ['type', 'actor.login', 'repo.name'])),
      matrix: dfToMatrix(dfSelect(EV, ['type', 'actor.login', 'repo.name']), { rowLabels: 'one' }),
    };
  }

  // events.select(*paths).show() on gh8, or the real trimmed error when a path does not resolve.
  // cell: the "<cell N>" number in the traceback (9 reproduces truth m3.gh8.select_login).
  function ghSelect({ paths = ['actor.login', 'repo.name'], cell = 9, n = 20, truncate = true }) {
    const code = 'events.select(' + paths.map((p) => '"' + p + '"').join(', ') + ').show()';
    const r = dfTry(() => dfSelect(EV, paths));
    if (r.ok) {
      const s = dfShowString(r.value, { n, truncate });
      return { ok: true, code, show: dfToTextBlock(s), showLines: linesOf(s), columns: dfColumns(r.value), columnsRepr: dfColumnsRepr(r.value), error: '', errorLines: [], errorClass: null, suggestions: [] };
    }
    const plan = /^UNRESOLVED_COLUMN/.test(r.error.errorClass || '') ? dfPlanLines('select', EV, paths, { startId: 1023 }) : null;
    const tb = dfTraceback({ cell, code, error: r.error, plan });
    return { ok: false, code, show: '', showLines: [], columns: [], columnsRepr: '', error: dfToTextBlock(tb), errorLines: linesOf(tb), errorClass: r.error.errorClass, suggestions: r.error.suggestions || [] };
  }

  // One dot path picked in a lesson: events.select(path).show() on gh8, or its real trimmed error.
  // The cell numbers in the tracebacks copy the real runs: "login" = truth m3.gh8.select_login (cell 9),
  // "actor.logn" = extra run m3x.gh8.select_logn (cell 2).
  const PATH_CELL = { login: 9, 'actor.logn': 2 };
  function ghPath({ path = 'actor.login' }) {
    const r = ghSelect({ paths: [path], cell: PATH_CELL[path] || 9 });
    return {
      ok: r.ok, code: r.code, columns: r.columns, errorClass: r.errorClass, suggestions: r.suggestions,
      out: r.ok ? r.show : r.error, outLines: r.ok ? r.showLines : r.errorLines,
      verdict: r.ok ? 'It runs. The result column is named `' + r.columns[0] + '`.' : 'Spark raises `' + r.errorClass + '`.',
    };
  }

  // The first n lines of the lesson file as they are stored: one JSON record per line (JSON Lines).
  function ghRaw({ n = 3 }) {
    const lines = DF_GH8_JSONL.split('\n').filter((l) => l).slice(0, Math.max(1, n));
    return { text: dfToTextBlock(lines.join('\n')), lines };
  }

  // Tree node id (as built by ghView / treeIds) of a dot path, e.g. actor.login -> c-actor-login.
  const pathNode = (p) => 'node:c-' + p.split('.').map(slug).join('-');

  // A Python-style one-step-per-line trace of reading gh8 and selecting dot paths.
  // anchors: read, schema, select. roles: schema (live Tree of the gh8 schema from ghView).
  function jsonSelectCode({ paths = ['actor.login', 'repo.name'] }) {
    const r = ghSelect({ paths });
    const tops = dfColumns(EV);
    const structs = EV.columns.filter((c) => typeof c.type === 'object' && c.type.type === 'struct').map((c) => c.name);
    const trace = [
      { label: `\`spark.read.json(...)\`: one event per line, ${dfCount(EV)} events.`, code: 'read', math: 'read', vars: { events: dfCount(EV) },
        ops: [{ role: 'schema', cmd: 'clear' }, { role: 'schema', cmd: 'highlight', args: { sel: 'node:root', tone: 'accent' } }] },
      { label: `\`printSchema()\`: top-level columns ${tops.join(', ')}. Of these, ${structs.join(', ')} are structs.`, code: 'schema', math: 'schema', vars: { structs: structs.join(', ') },
        ops: [{ role: 'schema', cmd: 'highlight', args: { sel: structs.map((s) => 'node:c-' + slug(s)), tone: 'accent' } }] },
    ];
    paths.forEach((p) => {
      const parts = p.split('.');
      const last = parts[parts.length - 1];
      const ok = dfTry(() => dfSelect(EV, [p])).ok;
      trace.push({
        label: ok ? `\`"${p}"\` walks into \`${parts[0]}\` and takes \`${last}\`. The column is named \`${last}\`.` : `\`"${p}"\` does not lead to a field.`,
        code: 'select', math: 'select', vars: { path: p, column: last },
        ops: ok ? [{ role: 'schema', cmd: 'highlight', args: { sel: 'path:' + pathNode(p).slice(5), tone: 'good' } }] : [],
      });
    });
    trace.push({ label: r.ok ? `Result columns: ${r.columnsRepr}.` : `Error: ${r.errorClass}.`, code: 'select', math: 'select', vars: { columns: r.ok ? r.columnsRepr : r.errorClass },
      ops: r.ok ? [{ role: 'schema', cmd: 'highlight', args: { sel: paths.map(pathNode), tone: 'good' } }] : [] });
    return { trace, steps: trace.length, columns: r.columns };
  }

  // ---------------------------------------------------------------- Session 6: stars ranking (Problem 5)
  const WATCH = { col: 'type', op: '==', value: 'WatchEvent' };
  function starsRanked(t, { alias = true, tiebreak = true } = {}) {
    const w = dfFilter(t, WATCH);
    const key = alias ? { col: 'repo.name', alias: 'repo_name' } : 'repo.name';
    const g = alias ? dfAgg(dfGroupBy(w, [key]), [{ fn: 'count', col: '*', alias: 'stars' }]) : dfGroupCount(dfGroupBy(w, [key]));
    const cnt = alias ? 'stars' : 'count', nm = alias ? 'repo_name' : 'name';
    return { w, g, ranked: dfOrderBy(g, tiebreak ? [{ desc: cnt }, nm] : [{ desc: cnt }]), cnt, nm };
  }

  // The Problem 5 chain on gh8, prefix by prefix. upTo: 1 filter, 2 groupBy, 3 count/agg, 4 orderBy, 5 limit.
  function starsChain({ upTo = 4, tiebreak = true, alias = false, limit = 10, truncate = true }) {
    const s = starsRanked(EV, { alias, tiebreak });
    const key = alias ? 'F.col("repo.name").alias("repo_name")' : '"repo.name"';
    const order = alias ? (tiebreak ? 'F.desc("stars"), "repo_name"' : 'F.desc("stars")') : (tiebreak ? 'F.desc("count"), "name"' : 'F.desc("count")');
    const limited = dfLimit(s.ranked, limit);
    const steps = [
      { code: 'events.filter(F.col("type") == "WatchEvent")', type: DF_PY_TYPES.DataFrame, t: dfSelect(s.w, ['type', 'repo.name']) },
      { code: `.groupBy(${key})`, type: DF_PY_TYPES.GroupedData, t: null },
      { code: alias ? '.agg(F.count("*").alias("stars"))' : '.count()', type: DF_PY_TYPES.DataFrame, t: s.g },
      { code: `.orderBy(${order})`, type: DF_PY_TYPES.DataFrame, t: s.ranked },
      { code: `.limit(${limit})`, type: DF_PY_TYPES.DataFrame, t: limited },
    ].map((st, i) => ({
      step: i + 1, code: st.code, type: st.type,
      show: st.t ? dfShowBlock(st.t, { truncate }) : dfToTextBlock(dfPyErrorText('AttributeError', { type: 'GroupedData', attr: 'show' })),
      lines: st.t ? linesOf(dfShowString(st.t, { truncate })) : [dfPyErrorText('AttributeError', { type: 'GroupedData', attr: 'show' })],
    }));
    const k = Math.max(1, Math.min(5, upTo));
    const fin = steps[k - 1];
    return {
      steps, upTo: k, code: steps.slice(0, k).map((st) => st.code).join('\n'), final: fin.show, finalLines: fin.lines,
      // the prefix as a notebook cell, written like the real runs (truth m3.gh8.stars_name)
      cell: '(\n' + steps.slice(0, k).map((st) => '    ' + st.code).join('\n') + '\n    .show()\n)',
      ranked: dfCollect(s.ranked).map((r) => [r[s.nm], r[s.cnt]]), watchEvents: dfCount(s.w),
      md: dfToMarkdownTable(limited),
    };
  }

  // Tally of stars after the first `upTo` events (first-occurrence order of the watched repos).
  function starsSheet({ upTo = 99 }) {
    const ti = dfFindColumn(EV.columns, 'type'), ri = dfFindColumn(EV.columns, 'repo');
    const repos = [], tally = {};
    EV.rows.forEach((r) => { if (r[ti] === 'WatchEvent' && repos.indexOf(r[ri].name) < 0) repos.push(r[ri].name); });
    EV.rows.slice(0, Math.max(0, upTo)).forEach((r) => { if (r[ti] === 'WatchEvent') tally[r[ri].name] = (tally[r[ri].name] || 0) + 1; });
    return { rows: repos, cols: ['stars'], values: repos.map((x) => [tally[x] === undefined ? null : tally[x]]) };
  }

  // Count-along for Problem 5 on gh8: filter, tally, sort with the tie-break.
  // roles: events (Matrix of gh8 type + repo name, rows 1-8), tally (Matrix from starsSheet). Patches starUpTo.
  function starsWalk({}) {
    const ti = dfFindColumn(EV.columns, 'type'), ri = dfFindColumn(EV.columns, 'repo');
    const tally = {};
    const trace = [{ label: 'Keep only WatchEvents (stars), then count them per repository.', patch: { starUpTo: 0 }, ops: [{ role: 'tally', cmd: 'clear' }] }];
    EV.rows.forEach((r, i) => {
      const watch = r[ti] === 'WatchEvent';
      if (watch) tally[r[ri].name] = (tally[r[ri].name] || 0) + 1;
      trace.push({
        label: watch ? `Event ${i + 1}: a star for ${r[ri].name}, which now has ${tally[r[ri].name]}.` : `Event ${i + 1}: ${r[ti]}, filtered out.`,
        patch: { starUpTo: i + 1 },
        vars: { event: i + 1, type: r[ti], repo: r[ri].name },
        ops: [{ role: 'events', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: watch ? 'good' : 'muted' } }].concat(watch ? [{ role: 'tally', cmd: 'highlight', args: { sel: 'row:' + r[ri].name, tone: 'accent' } }] : []),
      });
    });
    const s = starsRanked(EV, { alias: true, tiebreak: true });
    const rk = dfCollect(s.ranked);
    const ties = rk.filter((x) => rk.filter((y) => y.stars === x.stars).length > 1).map((x) => x.repo_name);
    trace.push({ label: `Sort by stars, biggest first: ${rk[0].repo_name} leads with ${rk[0].stars}.`, patch: { starUpTo: EV.rows.length }, ops: [{ role: 'tally', cmd: 'highlight', args: { sel: 'row:' + rk[0].repo_name, tone: 'good' } }] });
    // No order for the tied rows here: the next beat asks the learner to predict it.
    trace.push({ label: `${ties.length === 2 ? 'Two' : ties.length} repositories are tied at ${rk[1].stars} star${rk[1].stars === 1 ? '' : 's'}.`, patch: { starUpTo: EV.rows.length }, ops: [{ role: 'tally', cmd: 'highlight', args: { sel: ties.map((x) => 'row:' + x), tone: 'warn' } }] });
    return { trace, steps: trace.length, ranked: rk.map((x) => [x.repo_name, x.stars]) };
  }

  // The notebook's dot-path cells on gh8 (ported cells 204 and 206), plus limit(k):
  //   events.groupBy("type").count().orderBy(F.desc("count"), "type")   (truth m3.gh8.type_counts)
  //   events.filter(F.col("type") == "ForkEvent").select(F.col("actor.login").alias("user"),
  //     F.col("repo.name").alias("repo_name"))                           (extra run m3x.gh8.fork_alias)
  // The same ranking idea as Problem 5 (sort by the count, then by name), on event types instead of stars.
  // limit = k in .limit(k) after the sort (computed by the engine; only the full table is a real output).
  const typeRanked = () => dfOrderBy(dfGroupCount(dfGroupBy(EV, ['type'])), [{ desc: 'count' }, 'type']);
  const forkTable = () => dfSelect(dfFilter(EV, { col: 'type', op: '==', value: 'ForkEvent' }),
    [{ col: 'actor.login', alias: 'user' }, { col: 'repo.name', alias: 'repo_name' }]);
  function typeCount({ limit = 3 }) {
    const ranked = typeRanked();
    const k = Math.max(1, Math.min(ranked.rows.length, Math.round(limit)));
    const t = dfLimit(ranked, k);
    const fork = forkTable();
    return {
      limit: k, types: ranked.rows.length,
      ranked: dfCollect(ranked).map((r) => [r.type, r.count]),
      kept: dfCollect(t).map((r) => [r.type, r.count]),
      fullShow: dfShowBlock(ranked), fullLines: linesOf(dfShowString(ranked)),
      show: dfShowBlock(t), showLines: linesOf(dfShowString(t)),
      forkShow: dfShowBlock(fork, { truncate: false }), forkLines: linesOf(dfShowString(fork, { truncate: false })),
    };
  }

  // typeCount line by line: one step per event for the groupBy count (a running tally), then the sort
  // with its tie-break, limit(k), and the ForkEvent filter with its aliases.
  // anchors: group, agg, order, limit, filter, alias. roles: events (live Matrix of gh8: type, login, name; rows 1-8).
  function typeCountCode({ limit = 3 }) {
    const tc = typeCount({ limit });
    const ti = dfFindColumn(EV.columns, 'type');
    const rowsOf = (type) => EV.rows.map((r, i) => (r[ti] === type ? 'row:' + (i + 1) : null)).filter(Boolean);
    const tally = {};
    const trace = [{ label: '`groupBy("type")`: one group per kind of event. No table yet: GroupedData.', code: 'group', math: 'group', vars: { type: 'GroupedData' },
      ops: [{ role: 'events', cmd: 'clear' }, { role: 'events', cmd: 'highlight', args: { sel: 'col:type', tone: 'accent' } }] }];
    EV.rows.forEach((r, i) => {
      tally[r[ti]] = (tally[r[ti]] || 0) + 1;
      trace.push({
        label: `\`.count()\`, event ${i + 1}: a ${r[ti]}, so that group now has ${tally[r[ti]]}.`,
        code: 'agg', math: 'agg', vars: { event: i + 1, type: r[ti], count: tally[r[ti]] },
        ops: [{ role: 'events', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: 'accent' } },
          { role: 'events', cmd: 'annotate', args: { sel: `cell:${i + 1},type`, text: String(tally[r[ti]]) } }],
      });
    });
    const tied = tc.ranked.filter((x) => tc.ranked.filter((y) => y[1] === x[1]).length > 1);
    trace.push({
      label: `\`.orderBy(F.desc("count"), "type")\`: ${tc.ranked.map((x) => x[0] + ' ' + x[1]).join(', ')}.${tied.length ? ' The tie goes by name.' : ''}`,
      code: 'order', math: 'order', vars: { first: tc.ranked[0][0] },
      ops: [{ role: 'events', cmd: 'highlight', args: { sel: rowsOf(tc.ranked[0][0]), tone: 'good' } }],
    });
    trace.push({
      label: `\`.limit(${tc.limit})\` keeps ${tc.kept.map((x) => x[0]).join(', ')}.`, code: 'limit', math: 'limit', vars: { kept: tc.kept.length },
      ops: [{ role: 'events', cmd: 'highlight', args: { sel: [].concat(...tc.kept.map((x) => rowsOf(x[0]))), tone: 'good' } }],
    });
    trace.push({
      label: '`filter(F.col("type") == "ForkEvent")` keeps only the forks.', code: 'filter', math: 'filter', vars: { rows: rowsOf('ForkEvent').length },
      ops: [{ role: 'events', cmd: 'highlight', args: { sel: rowsOf('ForkEvent'), tone: 'accent' } }],
    });
    trace.push({
      label: '`F.col("actor.login").alias("user")` reaches inside `actor` and renames the result `user`.', code: 'alias', math: 'alias', vars: { columns: 'user, repo_name' },
      ops: [{ role: 'events', cmd: 'highlight', args: { sel: rowsOf('ForkEvent').map((x) => x.replace('row:', 'cell:') + ',login'), tone: 'good' } }],
    });
    return { trace, steps: trace.length, kept: tc.kept, showLines: tc.showLines };
  }

  // The real Problem 5 board (dataset p5top: repo_name, stars; places 1-14 of the full data).
  // more = true: the real ranking continues past these rows, so show() prints its footer.
  function p5Board({ board, k = 10, n = 14, more = true }) {
    const t = dfFromRows('repo_name STRING, stars BIGINT', more ? board.rows.concat([['', 0]]) : board.rows);
    const rows = board.rows;
    const kth = rows[k - 1], next = rows[k];
    const tiedAtCut = next ? rows.filter((r) => r[1] === kth[1]).map((r) => r[0]) : [];
    return {
      boardLines: linesOf(dfShowString(t, { n, truncate: false })), board: dfShowBlock(t, { n, truncate: false }),
      top: dfShowBlock(dfLimit(t, k), { truncate: false }), topLines: linesOf(dfShowString(dfLimit(t, k), { truncate: false })),
      cutStars: kth[1], tieAtCut: !!next && next[1] === kth[1], tiedAtCut,
      kept: tiedAtCut.filter((nm) => rows.findIndex((r) => r[0] === nm) < k),
      dropped: tiedAtCut.filter((nm) => rows.findIndex((r) => r[0] === nm) >= k),
    };
  }

  // ---------------------------------------------------------------- Session 6: explode
  function explodeCommits({}) {
    const ex = dfSelect(EV, ['actor.login', { explode: 'payload.commits', alias: 'commit' }]);
    const flat = dfSelect(ex, ['login', 'commit.author.name', 'commit.message']);
    const payload = dfSelect(EV, ['type', 'payload.commits']);
    const msgs = dfSelect(EV, ['type', 'payload.commits.message']);
    const perLogin = dfOrderBy(dfGroupCount(dfGroupBy(ex, ['login'])), [{ desc: 'count' }, 'login']);
    return {
      count: dfCount(ex), events: dfCount(EV),
      sizes: EV.rows.map((r) => { const p = r[dfFindColumn(EV.columns, 'payload')]; return p && p.commits ? p.commits.length : 0; }),
      terms: EV.rows.map((r) => { const p = r[dfFindColumn(EV.columns, 'payload')]; return p && p.commits ? p.commits.length : 0; }).join(' + '),
      show: dfShowBlock(flat, { truncate: false }), showLines: linesOf(dfShowString(flat, { truncate: false })),
      schema: dfToTextBlock(dfPrintSchemaString(ex)), schemaLines: linesOf(dfPrintSchemaString(ex)),
      payloadShow: dfShowBlock(payload, { truncate: false }), payloadLines: linesOf(dfShowString(payload, { truncate: false })),
      messagesShow: dfShowBlock(msgs, { truncate: false }), messagesLines: linesOf(dfShowString(msgs, { truncate: false })),
      perLoginShow: dfShowBlock(perLogin), perLoginLines: linesOf(dfShowString(perLogin)),
    };
  }

  // Exploded rows produced by the first `upTo` events (fixed 3 slots, filled as they appear).
  function explodeSheet({ upTo = 99 }) {
    const out = [];
    const ti = dfFindColumn(EV.columns, 'actor'), pi = dfFindColumn(EV.columns, 'payload');
    EV.rows.forEach((r, i) => {
      const commits = r[pi] && r[pi].commits ? r[pi].commits : [];
      commits.forEach((c) => out.push({ event: i + 1, login: r[ti].login, message: c.message }));
    });
    return {
      rows: out.map((_, i) => String(i + 1)), cols: ['event', 'login', 'message'],
      values: out.map((o) => (o.event <= upTo ? [o.event, cellTex(o.login), cellTex(o.message)] : [null, null, null])),
      produced: out.filter((o) => o.event <= upTo).length,
    };
  }

  // Count-along for explode on gh8: one event per step; NULL commits give no row.
  // roles: events (Matrix of gh8 rows 1-8), rows (Matrix from explodeSheet). Patches explodeUpTo.
  function explodeWalk({}) {
    const ti = dfFindColumn(EV.columns, 'type'), ai = dfFindColumn(EV.columns, 'actor'), pi = dfFindColumn(EV.columns, 'payload');
    let made = 0;
    const trace = [{ label: '`F.explode("payload.commits")` turns each list element into its own row.', patch: { explodeUpTo: 0 }, ops: [{ role: 'rows', cmd: 'clear' }] }];
    EV.rows.forEach((r, i) => {
      const commits = r[pi] && r[pi].commits ? r[pi].commits : null;
      const k = commits ? commits.length : 0;
      made += k;
      trace.push({
        label: commits
          ? `Event ${i + 1}: ${r[ti]} by ${r[ai].login} with ${k} commit${k === 1 ? '' : 's'}, so ${k} new row${k === 1 ? '' : 's'}. Rows: ${made}.`
          : `Event ${i + 1}: ${r[ti]}, commits are NULL, so no row. Rows: ${made}.`,
        patch: { explodeUpTo: i + 1 },
        vars: { event: i + 1, commits: k, rows: made },
        ops: [{ role: 'events', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: k ? 'good' : 'muted' } }],
      });
    });
    return { trace, steps: trace.length, rows: made };
  }

  // explode code on gh8, one step per event. anchors: select, explode, count.
  // roles: events (live Matrix of gh8: type, login, name; rows 1-8).
  function explodeCode({}) {
    const ti = dfFindColumn(EV.columns, 'type'), pi = dfFindColumn(EV.columns, 'payload');
    let made = 0;
    const kept = [];
    const trace = [{ label: '`events.select("actor.login", ...)` keeps the login of every event.', code: 'select', math: 'select', vars: { events: dfCount(EV) },
      ops: [{ role: 'events', cmd: 'clear' }, { role: 'events', cmd: 'highlight', args: { sel: 'col:login', tone: 'accent' } }] }];
    EV.rows.forEach((r, i) => {
      const commits = r[pi] && r[pi].commits ? r[pi].commits : null;
      const k = commits ? commits.length : 0;
      made += k;
      if (k) kept.push('row:' + (i + 1));
      trace.push({
        label: `Event ${i + 1} (${r[ti]}): ${commits ? k + ' commit' + (k === 1 ? '' : 's') + ' → ' + k + ' row' + (k === 1 ? '' : 's') : 'NULL → no row'}; total ${made}.`,
        code: 'explode', math: 'explode', vars: { event: i + 1, commits: k, rows: made },
        ops: [{ role: 'events', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: k ? 'good' : 'muted' } }].concat(k ? [{ role: 'events', cmd: 'annotate', args: { sel: `cell:${i + 1},type`, text: k + ' row' + (k === 1 ? '' : 's') } }] : []),
      });
    });
    trace.push({ label: `\`.count()\` returns ${made}: one row per commit.`, code: 'count', math: 'count', vars: { count: made },
      ops: [{ role: 'events', cmd: 'highlight', args: { sel: kept, tone: 'good' } }] });
    return { trace, steps: trace.length, count: made };
  }

  // ---------------------------------------------------------------- Session 6: which file did a row come from?
  // files = dataset ghfiles (file_path, count): the real per-file counts of the three GH Archive hours.
  function filePath({ files = null }) {
    const d = dfDistinct(dfSelect(EV, ['_metadata.file_path']));
    const per = dfGroupCount(dfGroupBy(EV, [{ col: '_metadata.file_path', alias: 'file' }]));
    const out = {
      gh8: dfShowBlock(d, { truncate: false }), gh8Lines: linesOf(dfShowString(d, { truncate: false })),
      gh8Counts: dfShowBlock(per, { truncate: false }), gh8CountsLines: linesOf(dfShowString(per, { truncate: false })),
      gh8Files: dfCount(d),
    };
    if (files) {
      const t = dfFromRows('file_path STRING, count BIGINT', files.rows);
      out.full = dfShowBlock(t, { truncate: false });
      out.fullLines = linesOf(dfShowString(t, { truncate: false }));
      out.total = files.rows.reduce((s, r) => s + r[1], 0);
      out.counts = files.rows.map((r) => r[1]);
      out.names = files.rows.map((r) => r[0].split('/').pop());
      out.series = [{ name: 'events', x: out.names, y: out.counts }];
      out.matrix = { rows: files.rows.map((_, i) => String(i + 1)), cols: ['file', 'count'], values: files.rows.map((r) => [cellTex(r[0].split('/').pop()), r[1]]) };
    }
    return out;
  }

  // _metadata.file_path code on the three hour files. anchors: meta, group, count.
  // roles: files (live Matrix from filePath: file name, count; rows 1-3).
  function filePathCode({ files }) {
    const trace = [{ label: '`F.col("_metadata.file_path")`: a hidden column with the file each row came from.', code: 'meta', math: 'meta', vars: { files: files.rows.length },
      ops: [{ role: 'files', cmd: 'clear' }, { role: 'files', cmd: 'highlight', args: { sel: 'col:file', tone: 'accent' } }] },
    { label: '`groupBy(...)`: one group per file, here three.', code: 'group', math: 'group', vars: { groups: files.rows.length },
      ops: [{ role: 'files', cmd: 'highlight', args: { sel: files.rows.map((_, i) => 'row:' + (i + 1)), tone: 'accent' } }] }];
    let total = 0;
    files.rows.forEach((r, i) => {
      total += r[1];
      trace.push({ label: `\`count()\` for ${r[0].split('/').pop()}: ${r[1]} events (running total ${total}).`, code: 'count', math: 'count', vars: { file: r[0].split('/').pop(), count: r[1], total },
        ops: [{ role: 'files', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: 'accent' } }, { role: 'files', cmd: 'annotate', args: { sel: `cell:${i + 1},count`, text: 'total ' + total } }] });
    });
    return { trace, steps: trace.length, total };
  }

  // ---------------------------------------------------------------- Session 5: the partitioned write, line by line
  // The Session 5 Parquet cells (ported cells 147-157) stepped through with the 12 lesson trips standing in
  // for trips.limit(100). One step per line, one per top-level folder the write makes.
  // anchors: read, ls, write, partition, listing, readback.
  // roles: table (live Matrix of taxi12, rows 1-12), tree (live Tree from partitionWrite with counts: false).
  function writeParquetCode({ cols = ['VendorID'] }) {
    const pw = partitionWrite({ cols, counts: false });
    const ci = dfFindColumn(TAXI.columns, pw.cols[0]);
    const all = seq(N12).map((i) => 'row:' + (i + 1));
    const trace = [
      { label: '`spark.read.parquet(...)` reads a whole folder as one table. Here the 12 lesson trips stand in.', code: 'read', math: 'read', vars: { rows: N12 },
        ops: [{ role: 'table', cmd: 'clear' }, { role: 'tree', cmd: 'clear' }, { role: 'table', cmd: 'highlight', args: { sel: all, tone: 'accent' } }] },
      { label: '`dbutils.fs.ls` lists a folder: `_SUCCESS` and the `part-…` data files, with sizes in bytes.', code: 'ls', math: 'ls', vars: { path: 'nyctaxi/green_2017' },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel: all, tone: 'muted' } }] },
      { label: '`write.parquet(..., mode="overwrite")` saves a new folder, replacing any old one with that name.', code: 'write', math: 'write', vars: { path: 'output/sample_write' },
        ops: [{ role: 'tree', cmd: 'highlight', args: { sel: 'node:root', tone: 'accent' } }] },
    ];
    pw.folderRows.forEach((f) => {
      const val = f.folder.split('=')[1].replace('/', '');
      const sel = TAXI.rows.map((r, i) => (String(r[ci]) === val ? 'row:' + (i + 1) : null)).filter(Boolean);
      const node = 'node:' + slug('p-' + f.folder);
      const inner = pw.inside[f.folder] ? pw.inside[f.folder].length : 0;
      trace.push({
        label: `\`partitionBy\`: ${f.rows} ${f.rows === 1 ? 'trip has' : 'trips have'} ${pw.cols[0]} = ${val}, so ${f.rows === 1 ? 'it goes' : 'they go'} to \`${f.folder}\`${inner ? `, split into ${inner} sub-folder${inner === 1 ? '' : 's'}` : ''}.`,
        code: 'partition', math: 'partition', vars: { folder: f.folder, rows: f.rows },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel, tone: 'accent' } }, { role: 'tree', cmd: 'highlight', args: { sel: node, tone: 'accent' } },
          { role: 'tree', cmd: 'annotate', args: { sel: node, text: f.rows + (f.rows === 1 ? ' trip' : ' trips') } }],
      });
    });
    trace.push({ label: `\`dbutils.fs.ls\` on the new folder: ${pw.folders} folders and \`_SUCCESS\`, ${pw.names.length} entries.`, code: 'listing', math: 'listing', vars: { entries: pw.names.length },
      ops: [{ role: 'tree', cmd: 'highlight', args: { sel: pw.folderRows.map((f) => 'node:' + slug('p-' + f.folder)).concat(['node:success']), tone: 'good' } }] });
    trace.push({ label: `Read back: \`${pw.cols.join('` and `')}\` come${pw.cols.length === 1 ? 's' : ''} last in the schema, rebuilt from the folder names.`, code: 'readback', math: 'readback', vars: { last: pw.cols.join(', ') },
      ops: [{ role: 'table', cmd: 'highlight', args: { sel: pw.cols.map((c) => 'col:' + c), tone: 'good' } }] });
    return { trace, steps: trace.length, folders: pw.folders };
  }

  // ---------------------------------------------------------------- Application: capstone bug 4, small scale
  // Capstone Cell 10 (group by the flag, count, sort by the flag) after a DDL read of the 12 lesson trips,
  // with store_and_fwd_flag declared INT (the planted bug: every N and Y becomes NULL, no error) or STRING
  // (the fix). Same 10-column schema as truth m1.ddl_int.read / m1.ddl_string.read. flag: 'INT' | 'STRING'.
  function capFlag({ flag = 'INT' }) {
    const ddl = flag === 'STRING' ? DF_TAXI12_DDL_STRING : DF_TAXI12_DDL_INT;
    const t = dfReadCsv(DF_TAXI12_CSV, { header: true, schema: ddl, path: PATH12 });
    const counts = dfOrderBy(dfGroupCount(dfGroupBy(t, ['store_and_fwd_flag'])), ['store_and_fwd_flag']);
    const fi = dfFindColumn(t.columns, 'store_and_fwd_flag');
    const showText = dfShowString(counts);
    return {
      flag: flag === 'STRING' ? 'STRING' : 'INT',
      ok: flag === 'STRING',
      groups: counts.rows.length,
      nulls: t.rows.filter((r) => r[fi] === null).length,
      ys: t.rows.filter((r) => r[fi] === 'Y').length,
      flagType: dfPrintSchemaString(t).split('\n').filter((l) => l.indexOf('store_and_fwd_flag') >= 0)[0].trim(),
      show: dfToTextBlock(showText),
      showLines: linesOf(showText),
    };
  }

  // =================================================================== quiz generators
  // Real values only: rows of taxi12, gh8 values, and numbers copied from the real runs.
  const TIMING = [ // problems.json P1: median of 3, local laptop, Spark 4.0.1; CSV = the inferSchema read
    ['describe("PULocationID").show()', 2.577, 0.35],
    ['freqItems+explode .show()', 2.883, 0.479],
    ['groupby/count/orderBy desc .show()', 3.587, 1.314],
    ['cast/groupby/sum/describe .show()', 3.111, 0.587],
    ['filter 264->193 .limit(10).toPandas()', 2.14, 0.405],
    ['describe().toPandas()', 10.881, 18.496],
  ];
  const PU_POOL = [7, 33, 41, 74, 75, 97];
  const DO_POOL = [238, 137, 261, 179, 166, 140, 260, 41, 75, 223, 143];
  const REPO_POOL = ['vinta/awesome-python', 'visionmedia/debug', 'phpsysinfo/phpsysinfo', 'cachethq/Cachet', 'begriffs/postgrest',
    'Netflix/ice', 'MostafaGazar/soas', 'Araq/Nim', 'lexrus/VPNOn', 'STRML/react-grid-layout', 'prakhar1989/awesome-courses'];
  const OTHER_TYPES = ['ForkEvent', 'PushEvent', 'CreateEvent'];
  const LOGIN_POOL = ['petroav', 'rspt', 'SametSisartenep', 'comcxx11', 'Soufien', 'hex7c0', 'mhparker23', 'x2bool'];
  const MSG_POOL = ['Fix main header height on mobile', 'travis docker', 'update devDependencies'];
  const QUESTIONS = [
    { text: 'the average `fare_amount`', need: ['fare_amount'] },
    { text: 'the average `tip_amount` per `VendorID`', need: ['VendorID', 'tip_amount'] },
    { text: 'the number of trips per `PULocationID`', need: ['PULocationID'] },
    { text: 'the number of trips per `PULocationID` and `DOLocationID` pair', need: ['PULocationID', 'DOLocationID'] },
    { text: 'the total `total_amount` per `PULocationID`', need: ['PULocationID', 'total_amount'] },
    { text: 'the longest `trip_distance`', need: ['trip_distance'] },
    { text: 'the average `fare_amount` per `passenger_count`', need: ['passenger_count', 'fare_amount'] },
    { text: 'the average `tip_amount` of trips longer than 5 miles', need: ['trip_distance', 'tip_amount'] },
    { text: 'the average `fare_amount` per `PULocationID`, for `VendorID` 1 only', need: ['VendorID', 'PULocationID', 'fare_amount'] },
  ];
  const ghTable = (t) => {
    const ti = dfFindColumn(t.columns, 'type'), ri = dfFindColumn(t.columns, 'repo');
    return mdTable(['#', 'type', 'repo.name'], t.rows.map((r, i) => [String(i + 1), r[ti], r[ri].name]));
  };

  // Values a column layout (Parquet) or a row layout (CSV) must read for one question.
  function valuesReadQ({ rng, difficulty }) {
    for (let tries = 0; tries < 300; tries++) {
      const q = rng.pick(QUESTIONS);
      const nCols = [5, 7, 10][difficulty - 1];
      const nRows = [5, 8, 12][difficulty - 1];
      if (q.need.length >= nCols) continue;
      const others = rng.sample(TCOLS.filter((c) => q.need.indexOf(c) < 0), nCols - q.need.length);
      const cols = TCOLS.filter((c) => q.need.indexOf(c) >= 0 || others.indexOf(c) >= 0);
      const rows = rng.sample(seq(N12), nRows).sort((a, b) => a - b);
      const layout = difficulty === 1 ? 'column' : rng.pick(['column', 'row']);
      const k = q.need.length;
      const colV = nRows * k, rowV = nRows * cols.length;
      const answer = layout === 'column' ? colV : rowV;
      const other = layout === 'column' ? rowV : colV;
      if (answer === other || answer === k || answer === nRows || other === k) continue;
      const t = dfSelect(subset(TAXI, rows), cols);
      return {
        vars: {
          table: dfToMarkdownTable(t), question: q.text, layout, nRows, nCols: cols.length, k, answer, other, onlyK: k,
          fileKind: layout === 'column' ? 'a Parquet file (each column stored together)' : 'a CSV file (each row stored together)',
          need: q.need.map((c) => '`' + c + '`').join(', '),
        },
        misconceptions: [
          { var: 'other', feedback: layout === 'column' ? 'That is what a CSV (row layout) reads: every value of every row. Parquet opens only the columns the question needs.' : 'That is what Parquet would read. A CSV stores whole rows, so every value of every row is read.' },
          { var: 'onlyK', feedback: 'That counts columns, not values. Each column holds one value per row.' },
        ],
      };
    }
    throw new Error('valuesReadQ: no draw');
  }

  // Folders made by write.parquet(..., partitionBy=[...]) on a few real trips.
  function partitionFoldersQ({ rng, difficulty }) {
    for (let tries = 0; tries < 300; tries++) {
      const nRows = [6, 8, 12][difficulty - 1];
      const rows = rng.sample(seq(N12), nRows).sort((a, b) => a - b);
      const cols = difficulty === 3
        ? rng.pick([['VendorID', 'PULocationID'], ['VendorID', 'store_and_fwd_flag'], ['passenger_count', 'PULocationID'], ['VendorID', 'passenger_count']])
        : [rng.pick(difficulty === 1 ? ['VendorID', 'PULocationID', 'passenger_count'] : ['PULocationID', 'DOLocationID'])];
      const pw = partitionWrite({ cols, rows });
      const answer = difficulty === 3 ? pw.leafFolders : pw.folders;
      const t = subset(TAXI, rows);
      const distinct = cols.map((c) => dfCount(dfDistinct(dfSelect(t, [c]))));
      const wrongProduct = distinct.reduce((a, b) => a * b, 1);
      const wrongRows = nRows, wrongLs = pw.names.length, wrongTop = pw.folders;
      const mis = difficulty === 3 ? [wrongProduct, wrongRows, wrongTop] : [wrongRows, wrongLs];
      if (answer < 2 || mis.some((m) => m === answer)) continue;
      const shown = dfSelect(t, cols.concat(['fare_amount']));
      return {
        vars: {
          table: dfToMarkdownTable(shown), nRows, answer, wrongRows, wrongLs, wrongProduct, wrongTop,
          colsText: cols.map((c) => '"' + c + '"').join(', '),
          deep: difficulty === 3,
          names: pw.names.join(', '),
          leafList: Object.keys(pw.inside).map((f) => f + ' → ' + pw.inside[f].join(', ')).join('; '),
          first: cols[0], second: cols[1] || '',
          ask: difficulty === 3 ? 'How many folders at the deepest level hold the data files?' : 'How many `column=value` folders does Spark create inside `sample_write/`?',
          leafText: difficulty === 3 ? 'Inside them: ' + Object.keys(pw.inside).map((f) => f + ' holds ' + pw.inside[f].join(', ')).join('; ') + '.' : '',
        },
        misconceptions: difficulty === 3
          ? [
            { var: 'wrongProduct', feedback: 'Not every combination of values occurs. Spark makes a folder only for the pairs that appear in the rows.' },
            { var: 'wrongTop', feedback: 'That counts only the top-level folders. Each of them holds one sub-folder per value of the second column.' },
            { var: 'wrongRows', feedback: 'Rows with the same values share a folder; count distinct values, not rows.' },
          ]
          : [
            { var: 'wrongRows', feedback: 'Rows with the same value share one folder; count the distinct values, not the rows.' },
            { var: 'wrongLs', feedback: 'That also counts `_SUCCESS`, an empty marker file, not a folder.' },
          ],
      };
    }
    throw new Error('partitionFoldersQ: no draw');
  }

  // CSV time / Parquet time for one real Problem 1 operation.
  function speedupQ({ rng, difficulty }) {
    for (let tries = 0; tries < 50; tries++) {
      const row = difficulty === 3 ? rng.pick(TIMING) : rng.pick(TIMING.slice(0, 5));
      const [op, csv, pq] = row;
      const ratio = csv / pq, diff = csv - pq, inverse = pq / csv;
      if (near(ratio, diff, 0.06) || near(ratio, inverse, 0.06)) continue;
      return {
        vars: { op, csv, parquet: pq, ratio, diff, inverse, slower: csv < pq },
        misconceptions: [
          { var: 'diff', feedback: 'That is the difference in seconds. "How many times faster" divides: CSV time ÷ Parquet time.' },
          { var: 'inverse', feedback: 'You divided the other way round. Put the CSV time on top: CSV time ÷ Parquet time.' },
        ],
      };
    }
    throw new Error('speedupQ: no draw');
  }

  // groupBy("PULocationID", "DOLocationID").count() on a small table of real zone numbers.
  function pairQ({ rng, difficulty }) {
    for (let tries = 0; tries < 400; tries++) {
      const n = [6, 8, 10][difficulty - 1];
      const pus = rng.sample(PU_POOL, difficulty === 1 ? 2 : 3);
      const dos = rng.sample(DO_POOL, difficulty === 1 ? 2 : 3);
      const rows = seq(n).map(() => [rng.pick(pus), rng.pick(dos)]);
      const t = dfFromRows('PULocationID INT, DOLocationID INT', rows);
      const s = pairStats(t);
      const groups = s.rk.length, top = s.rk[0], second = s.rk[1];
      if (!second || top.count === second.count || top.count < 2) continue;      // a unique top pair
      const puTop = s.puCounts.find((r) => r.PULocationID === top.PULocationID).count;
      if (groups === s.puGroups || groups === n || puTop === top.count) continue;
      return {
        vars: {
          table: mdTable(['#', 'PULocationID', 'DOLocationID'], rows.map((r, i) => [String(i + 1), String(r[0]), String(r[1])])),
          n, groups, puGroups: s.puGroups, topCount: top.count, topPU: top.PULocationID, topDO: top.DOLocationID,
          puTop, tupleText: '(' + top.PULocationID + ', ' + top.DOLocationID + ', ' + top.count + ')',
          resultMd: dfToMarkdownTable(s.ranked),
        },
        misconceptions: [
          { var: 'puGroups', feedback: 'That groups by `PULocationID` only. With two columns, each different (pickup, drop-off) pair is its own group.' },
          { var: 'n', feedback: 'That is the number of rows. Rows with the same pair fall into one group.' },
        ],
      };
    }
    throw new Error('pairQ: no draw');
  }

  // groupBy("PULocationID").agg(F.mean(value)) on real taxi12 rows: the mean of one zone.
  function groupMeanQ({ rng, difficulty }) {
    for (let tries = 0; tries < 300; tries++) {
      const value = difficulty === 3 ? rng.pick(['tip_amount', 'total_amount']) : 'fare_amount';
      const n = [5, 7, 9][difficulty - 1];
      const rows = rng.sample(seq(N12), n).sort((a, b) => a - b);
      const t = dfSelect(subset(TAXI, rows), ['PULocationID', value]);
      const g = meanGroups(t, 'PULocationID', value).filter((x) => x.n >= 2);
      if (!g.length) continue;
      const z = rng.pick(g);
      const overall = dfCollect(dfAgg(t, [{ fn: 'mean', col: value, alias: 'm' }]))[0].m;
      if (near(overall, z.mean) || near(z.sum, z.mean) || near(z.n, z.mean)) continue;
      return {
        vars: {
          table: dfToMarkdownTable(t), value, zone: z.key, trips: z.n, sum: z.sum, mean: z.mean, overall,
          terms: z.terms, nRows: n,
          alias: value === 'fare_amount' ? 'mean fare amount' : 'mean ' + value.replace('_amount', ''),
        },
        misconceptions: [
          { var: 'overall', feedback: 'That is the mean of every trip in the table. `groupBy` first: average only the trips of this zone.' },
          { var: 'sum', feedback: 'That is the sum. `F.mean` divides the sum by the number of trips in the zone.' },
        ],
      };
    }
    throw new Error('groupMeanQ: no draw');
  }

  // Stars per repository on a small table of events with real repository names.
  function starsQ({ rng, difficulty }) {
    for (let tries = 0; tries < 400; tries++) {
      const nRepos = [2, 3, 4][difficulty - 1];
      const n = [7, 9, 12][difficulty - 1];
      const repos = rng.sample(REPO_POOL, nRepos);
      const rows = seq(n).map(() => [rng.bool(0.6) ? 'WatchEvent' : rng.pick(OTHER_TYPES), { name: rng.pick(repos) }]);
      const t = dfFromRows([['type', 'string'], ['repo', 'struct<name:string>']], rows);
      const s = starsRanked(t, { alias: true, tiebreak: true });
      const rk = dfCollect(s.ranked);
      const watch = dfCount(s.w);
      if (rk.length < 2) continue;
      const target = rng.pick(rk);
      const allEvents = rows.filter((r) => r[1].name === target.repo_name).length;
      if (allEvents === target.stars || watch === target.stars) continue;
      if (difficulty >= 2 && rk[0].stars === rk[1].stars) continue;               // a unique leader for the hand-calc
      return {
        vars: {
          table: ghTable(t), n, repo: target.repo_name, stars: target.stars, allEvents, watch,
          groups: rk.length, topRepo: rk[0].repo_name, topStars: rk[0].stars, secondStars: rk[1].stars,
          rankedMd: dfToMarkdownTable(s.ranked),
          countMd: dfToMarkdownTable(starsRanked(t, { alias: false, tiebreak: true }).ranked),
        },
        misconceptions: [
          { var: 'allEvents', feedback: 'You counted every event of that repository. Stars are only the `WatchEvent` rows: filter first.' },
          { var: 'watch', feedback: 'That is every WatchEvent in the table. `groupBy` the repository name, then count each group.' },
        ],
      };
    }
    throw new Error('starsQ: no draw');
  }

  // Rows after F.explode("payload.commits") on a small table of events (real logins and messages).
  function explodeRowsQ({ rng, difficulty }) {
    for (let tries = 0; tries < 300; tries++) {
      const n = [5, 7, 9][difficulty - 1];
      const rows = seq(n).map(() => {
        const push = rng.bool(0.5);
        const login = rng.pick(LOGIN_POOL);
        if (!push) return [rng.pick(['WatchEvent', 'ForkEvent', 'CreateEvent']), { login }, null];
        const k = rng.int(difficulty === 3 ? 0 : 1, 3);
        const commits = rng.sample(MSG_POOL, k).map((message) => ({ author: { name: login }, message }));
        return ['PushEvent', { login }, { commits }];
      });
      const t = dfFromRows([['type', 'string'], ['actor', 'struct<login:string>'], ['payload', 'struct<commits:array<struct<author:struct<name:string>,message:string>>>']], rows);
      const answer = dfCount(dfSelect(t, ['actor.login', { explode: 'payload.commits', alias: 'commit' }]));
      const pushes = rows.filter((r) => r[0] === 'PushEvent').length;
      if (answer === 0 || answer === n || answer === pushes || pushes < 2) continue;
      const view = dfSelect(t, ['type', 'actor.login', 'payload.commits.message']);
      return {
        vars: { table: dfToMarkdownTable(view), n, answer, pushes, events: n, emptyPush: rows.some((r) => r[2] && r[2].commits.length === 0) },
        misconceptions: [
          { var: 'events', feedback: 'That is the number of events. `explode` makes one row per **commit**, and events with no commits give no row.' },
          { var: 'pushes', feedback: 'That is the number of PushEvents. A push with 2 commits becomes 2 rows.' },
        ],
      };
    }
    throw new Error('explodeRowsQ: no draw');
  }

  // ---------------------------------------------------------------- level-3 integrative generators (v1.1.0)
  // Capstone question 2 in small, on real taxi12 rows: filter by trip_distance, average the tip or fare per pickup zone,
  // sort from the highest average with PULocationID as the tie-break, first(). Every misconception is a
  // specific wrong method and is redrawn away when it would land within 0.011 of the answer.
  function meanRankQ({ rng }) {
    const FILTERS = [['>', 1.5], ['>', 2], ['>', 5], ['<', 2], ['<', 5], ['<', 8]];
    for (let tries = 0; tries < 500; tries++) {
      const n = 9;
      const rows = rng.sample(seq(N12), n).sort((a, b) => a - b);
      const [op, cut] = rng.pick(FILTERS);
      const value = rng.pick(['tip_amount', 'fare_amount']);
      const alias = value === 'tip_amount' ? 'mean_tip' : 'mean_fare';
      const rankOf = (tab) => dfOrderBy(dfAgg(dfGroupBy(tab, ['PULocationID']), [{ fn: 'mean', col: value, alias }]), [{ desc: alias }, 'PULocationID']);
      const t = dfSelect(subset(TAXI, rows), ['PULocationID', 'trip_distance', value]);
      const f = dfFilter(t, { col: 'trip_distance', op, value: cut });
      const kept = dfCount(f), short = n - kept;
      if (kept < 3 || short < 2 || short === kept) continue;
      const ranked = rankOf(f), rk = dfCollect(ranked), rkAll = dfCollect(rankOf(t));
      const groups = rk.length, groupsAll = rkAll.length;
      if (groups < 2 || groups === groupsAll || groups === kept || groupsAll === kept) continue;
      const top = rk[0], topAll = rkAll[0];
      const keptMean = dfCollect(dfAgg(f, [{ fn: 'mean', col: value, alias: 'm' }]))[0].m;
      if (top.PULocationID === topAll.PULocationID || near(top[alias], topAll[alias]) || near(top[alias], keptMean)) continue;
      const tie = rk[1][alias] === top[alias];
      return {
        vars: {
          table: dfToMarkdownTable(t), n, op, cut, value, alias, kept, short, groups, groupsAll,
          cmpWord: op === '>' ? 'longer' : 'shorter',
          dropWord: op === '>' ? 'of ' + cut + ' miles or less' : 'of ' + cut + ' miles or more',
          topZone: top.PULocationID, topMean: top[alias], topAllZone: topAll.PULocationID, topAllMean: topAll[alias], keptMean,
          rankedMd: dfToMarkdownTable(ranked),
          tieText: tie ? `Zones ${top.PULocationID} and ${rk[1].PULocationID} tie, so the tie-break puts the smaller PULocationID first.` : '',
        },
        misconceptions: [],
      };
    }
    throw new Error('meanRankQ: no draw');
  }

  // Commits per user: explode payload.commits, then groupBy("login").count(), sorted (real logins and messages).
  function explodeLoginQ({ rng }) {
    for (let tries = 0; tries < 500; tries++) {
      const n = 9;
      const logins = rng.sample(LOGIN_POOL, 4);
      const rows = seq(n).map(() => {
        const login = rng.pick(logins);
        if (!rng.bool(0.6)) return [rng.pick(['WatchEvent', 'ForkEvent', 'CreateEvent']), { login }, null];
        const commits = rng.sample(MSG_POOL, rng.int(0, 3)).map((message) => ({ author: { name: login }, message }));
        return ['PushEvent', { login }, { commits }];
      });
      const t = dfFromRows([['type', 'string'], ['actor', 'struct<login:string>'], ['payload', 'struct<commits:array<struct<author:struct<name:string>,message:string>>>']], rows);
      const ex = dfSelect(t, ['actor.login', { explode: 'payload.commits', alias: 'commit' }]);
      const rowsEx = dfCount(ex);
      const pushRows = rows.filter((r) => r[0] === 'PushEvent');
      const pushes = pushRows.length;
      if (rowsEx < 3 || rowsEx === n || rowsEx === pushes || pushes === n) continue;
      const ranked = dfOrderBy(dfGroupCount(dfGroupBy(ex, ['login'])), [{ desc: 'count' }, 'login']);
      const rk = dfCollect(ranked);
      const groups = rk.length;
      const loginsAll = new Set(rows.map((r) => r[1].login)).size;
      if (groups < 2 || groups === loginsAll || groups === rowsEx || loginsAll === rowsEx) continue;
      const top = rk[0];
      const maxPush = Math.max.apply(null, pushRows.map((r) => r[2].commits.length));
      const topPushes = pushRows.filter((r) => r[1].login === top.login).length;
      if (top.count <= maxPush || top.count === topPushes) continue;
      const view = dfSelect(t, ['type', 'actor.login', 'payload.commits.message']);
      return {
        vars: {
          table: dfToMarkdownTable(view), n, rowsEx, pushes, groups, loginsAll,
          topLogin: top.login, topCount: top.count, maxPush, topPushes,
          countMd: dfToMarkdownTable(ranked),
        },
        misconceptions: [],
      };
    }
    throw new Error('explodeLoginQ: no draw');
  }

  // A partitioned write, then a filter on the split column: folders made, folders skipped, values read (the
  // Session 5 count: one value per row for each column read), and the average fare printed. Real taxi12 rows.
  function partitionQueryQ({ rng }) {
    for (let tries = 0; tries < 500; tries++) {
      const n = 8;
      const rows = rng.sample(seq(N12), n).sort((a, b) => a - b);
      const col = rng.pick(['VendorID', 'PULocationID']);
      const t = subset(TAXI, rows);
      const pw = partitionWrite({ cols: [col], rows, counts: false });
      const folders = pw.folders, lsEntries = pw.names.length, skip = folders - 1;
      const ci = dfFindColumn(t.columns, col), fi = dfFindColumn(t.columns, 'fare_amount');
      const byVal = {};
      t.rows.forEach((r) => { (byVal[r[ci]] = byVal[r[ci]] || []).push(r[fi]); });
      const cand = Object.keys(byVal).filter((k) => byVal[k].length >= 2);
      if (folders < 2 || !cand.length || folders === n) continue;
      const keep = Number(rng.pick(cand));
      const kept = dfFilter(t, { col, op: '==', value: keep });
      const keptRows = dfCount(kept), keptTwo = 2 * keptRows;
      const mean = dfCollect(dfAgg(kept, [{ fn: 'mean', col: 'fare_amount', alias: 'm' }]))[0].m;
      const sum = dfCollect(dfAgg(kept, [{ fn: 'sum', col: 'fare_amount', alias: 's' }]))[0].s;
      const allMean = dfCollect(dfAgg(t, [{ fn: 'mean', col: 'fare_amount', alias: 'm' }]))[0].m;
      if (keptRows === n || keptTwo === n || skip === keptRows || near(allMean, mean) || near(sum, mean)) continue;
      return {
        vars: {
          table: dfToMarkdownTable(dfSelect(t, [col, 'fare_amount', 'tip_amount', 'trip_distance'])), n, col, keep,
          folders, lsEntries, skip, keptRows, valuesRead: keptRows, keptTwo, mean, sum, allMean,
          folderList: pw.names.filter((x) => x !== '_SUCCESS').join(', '),
          terms: byVal[keep].map((v) => valText(t, fi, v)).join(' + '),
        },
        misconceptions: [],
      };
    }
    throw new Error('partitionQueryQ: no draw');
  }

  return {
    fns: {
      taxiView, layoutRead, layoutWalk, partitionWrite, partitionWalk, timingTable, timingPick, p1Walk, restartRun,
      pairCount, pairSheet, pairCountWalk, firstRowCode,
      groupMean, meanSheet, groupMeanWalk, meanTipCode, vendorFirst, meanVsAvg,
      ghView, ghSelect, ghPath, ghRaw, jsonSelectCode,
      starsChain, starsSheet, starsWalk, typeCount, typeCountCode, p5Board,
      explodeCommits, explodeSheet, explodeWalk, explodeCode,
      filePath, filePathCode, writeParquetCode, capFlag,
    },
    generators: { valuesReadQ, partitionFoldersQ, speedupQ, pairQ, groupMeanQ, starsQ, explodeRowsQ, meanRankQ, explodeLoginQ, partitionQueryQ },
  };
}
