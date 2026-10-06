// Qdigo module: spark-df-debugging (Spark DataFrames II: Imports, Method Chains and Debugging)
// logic.js = the shared Spark mini-DataFrame engine (pasted verbatim) + real outputs + this module's fns.
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

  // ---- REAL outputs, copied by script (m2x/build_logic.mjs) from truth/truth.json and m2x/extra_truth*.json.
  // Each entry: { code, out, err } = what the learner types, what the cell prints, the trimmed error (or null).
  // Keys m2.*, m1.*, full.* are truth.json entries; m2x.* are extra real Spark 4.0.1 runs (harness, 2026-10-06).
  const REAL = {
   "m2.setup": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\ntrips = spark.read.csv(f\"{BASE}/lessons/taxi12.csv\", header=True, inferSchema=True)",
    "out": "",
    "err": null
   },
   "m2.builtins.round": {
    "code": "round(4.567, 1)",
    "out": "4.6",
    "err": null
   },
   "m2.builtins.max": {
    "code": "max(3, 7)",
    "out": "7",
    "err": null
   },
   "m2.builtins.sum": {
    "code": "sum([1, 2, 3])",
    "out": "6",
    "err": null
   },
   "m2.desc_without_import": {
    "code": "trips.groupBy(\"PULocationID\").count().orderBy(desc(\"count\")).show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 5>\", line 1, in <module>\n    trips.groupBy(\"PULocationID\").count().orderBy(desc(\"count\")).show()\n                                                  ^^^^\nNameError: name 'desc' is not defined"
   },
   "m2.select_pu": {
    "code": "trips.select(\"PULocationID\").show()",
    "out": "+------------+\n|PULocationID|\n+------------+\n|          41|\n|          97|\n|           7|\n|           7|\n|          74|\n|          33|\n|          41|\n|           7|\n|          75|\n|          74|\n|           7|\n|          33|\n+------------+\n\n",
    "err": null
   },
   "m2.select_two": {
    "code": "trips.select(\"PULocationID\", \"DOLocationID\").show()",
    "out": "+------------+------------+\n|PULocationID|DOLocationID|\n+------------+------------+\n|          41|         238|\n|          97|         137|\n|           7|         261|\n|           7|         179|\n|          74|         166|\n|          33|         140|\n|          41|         238|\n|           7|         260|\n|          75|          41|\n|          74|          75|\n|           7|         223|\n|          33|         143|\n+------------+------------+\n\n",
    "err": null
   },
   "m2.describe_two": {
    "code": "trips.describe(\"PULocationID\", \"DOLocationID\").show()",
    "out": "+-------+------------------+------------------+\n|summary|      PULocationID|      DOLocationID|\n+-------+------------------+------------------+\n|  count|                12|                12|\n|   mean|41.333333333333336|175.08333333333334|\n| stddev| 31.93838765593226| 71.73747383003635|\n|    min|                 7|                41|\n|    max|                97|               261|\n+-------+------------------+------------------+\n\n",
    "err": null
   },
   "m2.groupby_count": {
    "code": "trips.groupBy(\"PULocationID\").count().show()",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|          41|    2|\n|           7|    4|\n|          97|    1|\n|          75|    1|\n|          33|    2|\n|          74|    2|\n+------------+-----+\n\n",
    "err": null
   },
   "m2.import_F": {
    "code": "from pyspark.sql import functions as F",
    "out": "",
    "err": null
   },
   "m2.type_F": {
    "code": "type(F)",
    "out": "<class 'module'>",
    "err": null
   },
   "m2.groupby_count_desc": {
    "code": "trips.groupBy(\"PULocationID\").count().orderBy(F.desc(\"count\")).show()",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|           7|    4|\n|          41|    2|\n|          33|    2|\n|          74|    2|\n|          97|    1|\n|          75|    1|\n+------------+-----+\n\n",
    "err": null
   },
   "m2.groupby_count_desc_tiebreak": {
    "code": "trips.groupBy(\"PULocationID\").count().orderBy(F.desc(\"count\"), \"PULocationID\").show()",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|           7|    4|\n|          33|    2|\n|          41|    2|\n|          74|    2|\n|          75|    1|\n|          97|    1|\n+------------+-----+\n\n",
    "err": null
   },
   "m2.filter_gt10_count": {
    "code": "trips.filter(F.col(\"fare_amount\") > 10).count()",
    "out": "7",
    "err": null
   },
   "m2.filter_gt10_show": {
    "code": "trips.filter(F.col(\"fare_amount\") > 10).show()",
    "out": "+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|VendorID|lpep_pickup_datetime|store_and_fwd_flag|PULocationID|DOLocationID|passenger_count|trip_distance|fare_amount|tip_amount|total_amount|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|       2| 2017-10-02 08:00:03|                 N|          41|         238|              1|         1.94|       11.5|      2.46|       14.76|\n|       2| 2017-10-02 08:00:06|                 N|          97|         137|              1|         5.08|       22.0|       2.0|        24.8|\n|       1| 2017-10-02 08:00:14|                 N|           7|         261|              1|          9.8|       34.5|       6.0|        41.3|\n|       2| 2017-10-02 08:00:30|                 N|          33|         140|              1|          8.1|       29.0|      4.47|       34.27|\n|       2| 2017-10-02 08:00:38|                 N|          41|         238|              1|         1.76|       12.0|       0.0|        12.8|\n|       2| 2017-10-02 08:01:38|                 N|           7|         223|              2|         2.15|       10.5|       0.0|        11.3|\n|       1| 2017-10-02 10:47:29|                 Y|          33|         143|              1|          7.1|       31.0|      6.35|       38.15|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n\n",
    "err": null
   },
   "m2.filter_and": {
    "code": "trips.filter((F.col(\"fare_amount\") > 10) & (F.col(\"tip_amount\") > 0)).show()",
    "out": "+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|VendorID|lpep_pickup_datetime|store_and_fwd_flag|PULocationID|DOLocationID|passenger_count|trip_distance|fare_amount|tip_amount|total_amount|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|       2| 2017-10-02 08:00:03|                 N|          41|         238|              1|         1.94|       11.5|      2.46|       14.76|\n|       2| 2017-10-02 08:00:06|                 N|          97|         137|              1|         5.08|       22.0|       2.0|        24.8|\n|       1| 2017-10-02 08:00:14|                 N|           7|         261|              1|          9.8|       34.5|       6.0|        41.3|\n|       2| 2017-10-02 08:00:30|                 N|          33|         140|              1|          8.1|       29.0|      4.47|       34.27|\n|       1| 2017-10-02 10:47:29|                 Y|          33|         143|              1|          7.1|       31.0|      6.35|       38.15|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n\n",
    "err": null
   },
   "m2.filter_or": {
    "code": "trips.filter((F.col(\"PULocationID\") == 7) | (F.col(\"PULocationID\") == 33)).show()",
    "out": "+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|VendorID|lpep_pickup_datetime|store_and_fwd_flag|PULocationID|DOLocationID|passenger_count|trip_distance|fare_amount|tip_amount|total_amount|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|       1| 2017-10-02 08:00:14|                 N|           7|         261|              1|          9.8|       34.5|       6.0|        41.3|\n|       2| 2017-10-02 08:00:15|                 N|           7|         179|              1|         0.37|        4.0|      0.96|        5.76|\n|       2| 2017-10-02 08:00:30|                 N|          33|         140|              1|          8.1|       29.0|      4.47|       34.27|\n|       2| 2017-10-02 08:00:51|                 N|           7|         260|              1|         1.51|        8.0|       0.0|         8.8|\n|       2| 2017-10-02 08:01:38|                 N|           7|         223|              2|         2.15|       10.5|       0.0|        11.3|\n|       1| 2017-10-02 10:47:29|                 Y|          33|         143|              1|          7.1|       31.0|      6.35|       38.15|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n\n",
    "err": null
   },
   "m2.filter_python_and": {
    "code": "trips.filter((F.col(\"fare_amount\") > 10) and (F.col(\"tip_amount\") > 0))",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 18>\", line 1, in <module>\n    trips.filter((F.col(\"fare_amount\") > 10) and (F.col(\"tip_amount\") > 0))\n                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.base.PySparkValueError: [CANNOT_CONVERT_COLUMN_INTO_BOOL] Cannot convert column into bool: please use '&' for 'and', '|' for 'or', '~' for 'not' when building DataFrame boolean expressions."
   },
   "m2.filter_str_gt": {
    "code": "trips.filter(\"total_amount\" > 1000)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 19>\", line 1, in <module>\n    trips.filter(\"total_amount\" > 1000)\n                 ^^^^^^^^^^^^^^^^^^^^^\nTypeError: '>' not supported between instances of 'str' and 'int'"
   },
   "m2.filter_sql_string": {
    "code": "trips.filter(\"total_amount > 30\").count()",
    "out": "3",
    "err": null
   },
   "m2.filter_sql_string_show": {
    "code": "trips.filter(\"total_amount > 30\").show()",
    "out": "+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|VendorID|lpep_pickup_datetime|store_and_fwd_flag|PULocationID|DOLocationID|passenger_count|trip_distance|fare_amount|tip_amount|total_amount|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|       1| 2017-10-02 08:00:14|                 N|           7|         261|              1|          9.8|       34.5|       6.0|        41.3|\n|       2| 2017-10-02 08:00:30|                 N|          33|         140|              1|          8.1|       29.0|      4.47|       34.27|\n|       1| 2017-10-02 10:47:29|                 Y|          33|         143|              1|          7.1|       31.0|      6.35|       38.15|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n\n",
    "err": null
   },
   "m2.where_alias": {
    "code": "trips.where(F.col(\"fare_amount\") > 10).count()",
    "out": "7",
    "err": null
   },
   "m2.withcolumn_cast_sum": {
    "code": "(\n    trips.withColumn(\"total_amount\", trips.total_amount.cast(\"float\"))\n    .groupby(\"VendorID\")\n    .sum(\"total_amount\")\n    .show()\n)",
    "out": "+--------+------------------+\n|VendorID| sum(total_amount)|\n+--------+------------------+\n|       1| 86.25000095367432|\n|       2|132.45000076293945|\n+--------+------------------+\n\n",
    "err": null
   },
   "m2.withcolumn_cast_sum_double": {
    "code": "(\n    trips.groupby(\"VendorID\")\n    .sum(\"total_amount\")\n    .orderBy(\"VendorID\")\n    .show()\n)",
    "out": "+--------+-----------------+\n|VendorID|sum(total_amount)|\n+--------+-----------------+\n|       1|            86.25|\n|       2|           132.45|\n+--------+-----------------+\n\n",
    "err": null
   },
   "m2.agg_sum_repr": {
    "code": "F.sum(\"fare_amount\")",
    "out": "Column<'sum(fare_amount)'>",
    "err": null
   },
   "m2.agg_sum_show": {
    "code": "trips.agg(F.sum(\"fare_amount\")).show()",
    "out": "+----------------+\n|sum(fare_amount)|\n+----------------+\n|           185.0|\n+----------------+\n\n",
    "err": null
   },
   "m2.dtypes": {
    "code": "trips.dtypes",
    "out": "[('VendorID', 'int'),\n ('lpep_pickup_datetime', 'timestamp'),\n ('store_and_fwd_flag', 'string'),\n ('PULocationID', 'int'),\n ('DOLocationID', 'int'),\n ('passenger_count', 'int'),\n ('trip_distance', 'double'),\n ('fare_amount', 'double'),\n ('tip_amount', 'double'),\n ('total_amount', 'double')]",
    "err": null
   },
   "m2.type_groupby": {
    "code": "type(trips.groupby(\"PULocationID\"))",
    "out": "<class 'pyspark.sql.connect.group.GroupedData'>",
    "err": null
   },
   "m2.dir_groupby": {
    "code": "[m for m in dir(trips.groupby(\"PULocationID\")) if not m.startswith(\"_\")]",
    "out": "['agg',\n 'apply',\n 'applyInArrow',\n 'applyInPandas',\n 'applyInPandasWithState',\n 'avg',\n 'cogroup',\n 'count',\n 'max',\n 'mean',\n 'min',\n 'pivot',\n 'sum']",
    "err": null
   },
   "m2.dir_F_hour": {
    "code": "[name for name in dir(F) if \"hour\" in name]",
    "out": "['hour', 'hours']",
    "err": null
   },
   "m2.dir_F_date": {
    "code": "[name for name in dir(F) if \"date\" in name]",
    "out": "['curdate',\n 'current_date',\n 'date_add',\n 'date_diff',\n 'date_format',\n 'date_from_unix_date',\n 'date_part',\n 'date_sub',\n 'date_trunc',\n 'dateadd',\n 'datediff',\n 'datepart',\n 'make_date',\n 'to_date',\n 'try_validate_utf8',\n 'unix_date',\n 'validate_utf8']",
    "err": null
   },
   "m2.help_date_trunc": {
    "code": "help(F.date_trunc)",
    "out": "Help on function date_trunc in module pyspark.sql.functions.builtin:\n\ndate_trunc(format: str, timestamp: 'ColumnOrName') -> pyspark.sql.column.Column\n    Returns timestamp truncated to the unit specified by the format.\n\n    .. versionadded:: 2.3.0\n\n    .. versionchanged:: 3.4.0\n        Supports Spark Connect.\n\n    Parameters\n    ----------\n    format : literal string\n        'year', 'yyyy', 'yy' to truncate by year,\n        'month', 'mon', 'mm' to truncate by month,\n        'day', 'dd' to truncate by day,\n        Other options are:\n        'microsecond', 'millisecond', 'second', 'minute', 'hour', 'week', 'quarter'\n    timestamp : :class:`~pyspark.sql.Column` or column name\n        input column of values to truncate.\n\n    Returns\n    -------\n    :class:`~pyspark.sql.Column`\n        truncated timestamp.\n\n    See Also\n    --------\n    :meth:`pyspark.sql.functions.trunc`\n\n    Examples\n    --------\n    >>> from pyspark.sql import functions as sf\n    >>> df = spark.createDataFrame([('1997-02-28 05:02:11',)], ['ts'])\n    >>> df.select('*', sf.date_trunc('year', df.ts)).show()\n    +-------------------+--------------------+\n    |                 ts|date_trunc(year, ts)|\n    +-------------------+--------------------+\n    |1997-02-28 05:02:11| 1997-01-01 00:00:00|\n    +-------------------+--------------------+",
    "err": null
   },
   "m2.help_desc": {
    "code": "help(F.desc)",
    "out": "Help on function desc in module pyspark.sql.functions.builtin:\n\ndesc(col: 'ColumnOrName') -> pyspark.sql.column.Column\n    Returns a sort expression for the target column in descending order.\n    This function is used in `sort` and `orderBy` functions.\n\n    .. versionadded:: 1.3.0\n\n    .. versionchanged:: 3.4.0\n        Supports Spark Connect.\n\n    Parameters\n    ----------\n    col : :class:`~pyspark.sql.Column` or column name\n        Target column to sort by in the descending order.\n\n    Returns\n    -------\n    :class:`~pyspark.sql.Column`\n        The column specifying the sort order.\n\n    See Also\n    --------\n    :meth:`pyspark.sql.functions.desc_nulls_first`\n    :meth:`pyspark.sql.functions.desc_nulls_last`\n\n    Examples\n    --------\n    Example 1: Sort DataFrame by 'id' column in descending order.\n",
    "err": null
   },
   "m2.help_filter": {
    "code": "help(trips.filter)",
    "out": "filter(condition: Union[pyspark.sql.column.Column, str]) -> pyspark.sql.dataframe.DataFrame method of pyspark.sql.connect.dataframe.DataFrame instance\n    Filters rows using the given condition.\n\n    :func:`where` is an alias for :func:`filter`.\n\n    .. versionadded:: 1.3.0\n\n    .. versionchanged:: 3.4.0\n...\n    Parameters\n    ----------\n    condition : :class:`Column` or str\n        A :class:`Column` of :class:`types.BooleanType`\n        or a string of SQL expressions.\n\n    Returns\n    -------\n    :class:`DataFrame`\n        A new DataFrame with rows that satisfy the condition.\n\n    Examples\n    --------\n    >>> df = spark.createDataFrame([\n...\n    >>> df.where(df.age == 2).show()\n    +---+-----+-------+\n    |age| name|subject|\n    +---+-----+-------+\n    |  2|Alice|   Math|\n...\n    Filter by SQL expression in a string.\n\n    >>> df.filter(\"age > 3\").show()\n    +---+-------+---------+\n    |age|   name|  subject|\n...\n    >>> df.where(\"age = 2\").show()\n    +---+-----+-------+\n    |age| name|subject|\n    +---+-----+-------+\n    |  2|Alice|   Math|\n...\n    Filter by multiple conditions.\n\n    >>> df.filter((df.age > 3) & (df.subject == \"Physics\")).show()\n    +---+----+-------+\n    |age|name|subject|\n...\n    Filter by multiple conditions using SQL expression.\n\n    >>> df.filter(\"age > 3 AND name = 'Bob'\").show()\n    +---+----+-------+\n    |age|name|subject|",
    "err": null
   },
   "m2.date_trunc_show": {
    "code": "trips.select(\"lpep_pickup_datetime\", F.date_trunc(\"hour\", \"lpep_pickup_datetime\")).show()",
    "out": "+--------------------+--------------------------------------+\n|lpep_pickup_datetime|date_trunc(hour, lpep_pickup_datetime)|\n+--------------------+--------------------------------------+\n| 2017-10-02 08:00:03|                   2017-10-02 08:00:00|\n| 2017-10-02 08:00:06|                   2017-10-02 08:00:00|\n| 2017-10-02 08:00:14|                   2017-10-02 08:00:00|\n| 2017-10-02 08:00:15|                   2017-10-02 08:00:00|\n| 2017-10-02 08:00:16|                   2017-10-02 08:00:00|\n| 2017-10-02 08:00:30|                   2017-10-02 08:00:00|\n| 2017-10-02 08:00:38|                   2017-10-02 08:00:00|\n| 2017-10-02 08:00:51|                   2017-10-02 08:00:00|\n| 2017-10-02 08:01:03|                   2017-10-02 08:00:00|\n| 2017-10-02 08:01:08|                   2017-10-02 08:00:00|\n| 2017-10-02 08:01:38|                   2017-10-02 08:00:00|\n| 2017-10-02 10:47:29|                   2017-10-02 10:00:00|\n+--------------------+--------------------------------------+\n\n",
    "err": null
   },
   "m2.date_trunc_alias_show": {
    "code": "trips.select(\n    \"lpep_pickup_datetime\",\n    F.date_trunc(\"hour\", \"lpep_pickup_datetime\").alias(\"pickup_hour\"),\n).show()",
    "out": "+--------------------+-------------------+\n|lpep_pickup_datetime|        pickup_hour|\n+--------------------+-------------------+\n| 2017-10-02 08:00:03|2017-10-02 08:00:00|\n| 2017-10-02 08:00:06|2017-10-02 08:00:00|\n| 2017-10-02 08:00:14|2017-10-02 08:00:00|\n| 2017-10-02 08:00:15|2017-10-02 08:00:00|\n| 2017-10-02 08:00:16|2017-10-02 08:00:00|\n| 2017-10-02 08:00:30|2017-10-02 08:00:00|\n| 2017-10-02 08:00:38|2017-10-02 08:00:00|\n| 2017-10-02 08:00:51|2017-10-02 08:00:00|\n| 2017-10-02 08:01:03|2017-10-02 08:00:00|\n| 2017-10-02 08:01:08|2017-10-02 08:00:00|\n| 2017-10-02 08:01:38|2017-10-02 08:00:00|\n| 2017-10-02 10:47:29|2017-10-02 10:00:00|\n+--------------------+-------------------+\n\n",
    "err": null
   },
   "m2.freqitems.step1": {
    "code": "trips.freqItems([\"PULocationID\"], 0.3).show()",
    "out": "+----------------------+\n|PULocationID_freqItems|\n+----------------------+\n|           [33, 7, 74]|\n+----------------------+\n\n",
    "err": null
   },
   "m2.freqitems.step2": {
    "code": "from pyspark.sql.functions import explode\n\n(\n    trips.freqItems([\"PULocationID\"], 0.3)\n    .withColumn(\"freq_items\", explode(\"PULocationID_freqItems\"))\n    .show()\n)",
    "out": "+----------------------+----------+\n|PULocationID_freqItems|freq_items|\n+----------------------+----------+\n|           [33, 7, 74]|        33|\n|           [33, 7, 74]|         7|\n|           [33, 7, 74]|        74|\n+----------------------+----------+\n\n",
    "err": null
   },
   "m2.freqitems.step3": {
    "code": "(\n    trips.freqItems([\"PULocationID\"], 0.3)\n    .withColumn(\"freq_items\", explode(\"PULocationID_freqItems\"))\n    .drop(\"PULocationID_freqItems\")\n    .show()\n)",
    "out": "+----------+\n|freq_items|\n+----------+\n|        33|\n|         7|\n|        74|\n+----------+\n\n",
    "err": null
   },
   "m2.freqitems.step1_0.2": {
    "code": "trips.freqItems([\"PULocationID\"], 0.2).show(truncate=False)",
    "out": "+----------------------+\n|PULocationID_freqItems|\n+----------------------+\n|[33, 7, 41, 74]       |\n+----------------------+\n\n",
    "err": null
   },
   "m2.chain5.step1": {
    "code": "trips.filter(F.col(\"tip_amount\") > 0).show()",
    "out": "+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|VendorID|lpep_pickup_datetime|store_and_fwd_flag|PULocationID|DOLocationID|passenger_count|trip_distance|fare_amount|tip_amount|total_amount|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|       2| 2017-10-02 08:00:03|                 N|          41|         238|              1|         1.94|       11.5|      2.46|       14.76|\n|       2| 2017-10-02 08:00:06|                 N|          97|         137|              1|         5.08|       22.0|       2.0|        24.8|\n|       1| 2017-10-02 08:00:14|                 N|           7|         261|              1|          9.8|       34.5|       6.0|        41.3|\n|       2| 2017-10-02 08:00:15|                 N|           7|         179|              1|         0.37|        4.0|      0.96|        5.76|\n|       2| 2017-10-02 08:00:16|                 N|          74|         166|              1|          1.4|        8.5|      1.86|       11.16|\n|       2| 2017-10-02 08:00:30|                 N|          33|         140|              1|          8.1|       29.0|      4.47|       34.27|\n|       1| 2017-10-02 10:47:29|                 Y|          33|         143|              1|          7.1|       31.0|      6.35|       38.15|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n\n",
    "err": null
   },
   "m2.chain5.step2": {
    "code": "trips.filter(F.col(\"tip_amount\") > 0).select(\"PULocationID\", \"tip_amount\").show()",
    "out": "+------------+----------+\n|PULocationID|tip_amount|\n+------------+----------+\n|          41|      2.46|\n|          97|       2.0|\n|           7|       6.0|\n|           7|      0.96|\n|          74|      1.86|\n|          33|      4.47|\n|          33|      6.35|\n+------------+----------+\n\n",
    "err": null
   },
   "m2.chain5.step3": {
    "code": "(\n    trips.filter(F.col(\"tip_amount\") > 0)\n    .select(\"PULocationID\", \"tip_amount\")\n    .groupBy(\"PULocationID\")\n    .show()\n)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 43>\", line 5, in <module>\n    .show()\n     ^^^^\nAttributeError: 'GroupedData' object has no attribute 'show'"
   },
   "m2.chain5.step3_type": {
    "code": "type(\n    trips.filter(F.col(\"tip_amount\") > 0)\n    .select(\"PULocationID\", \"tip_amount\")\n    .groupBy(\"PULocationID\")\n)",
    "out": "<class 'pyspark.sql.connect.group.GroupedData'>",
    "err": null
   },
   "m2.chain5.step4": {
    "code": "(\n    trips.filter(F.col(\"tip_amount\") > 0)\n    .select(\"PULocationID\", \"tip_amount\")\n    .groupBy(\"PULocationID\")\n    .count()\n    .show()\n)",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|          41|    1|\n|           7|    2|\n|          97|    1|\n|          33|    2|\n|          74|    1|\n+------------+-----+\n\n",
    "err": null
   },
   "m2.chain5.step5": {
    "code": "(\n    trips.filter(F.col(\"tip_amount\") > 0)\n    .select(\"PULocationID\", \"tip_amount\")\n    .groupBy(\"PULocationID\")\n    .count()\n    .orderBy(F.desc(\"count\"), \"PULocationID\")\n    .show()\n)",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|           7|    2|\n|          33|    2|\n|          41|    1|\n|          74|    1|\n|          97|    1|\n+------------+-----+\n\n",
    "err": null
   },
   "m2.def_no_return": {
    "code": "def top_pickups(df):\n    df.groupBy(\"PULocationID\").count().orderBy(F.desc(\"count\"), \"PULocationID\")\n\ntop_pickups(trips).show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 47>\", line 4, in <module>\n    top_pickups(trips).show()\n    ^^^^^^^^^^^^^^^^^^^^^^^\nAttributeError: 'NoneType' object has no attribute 'show'"
   },
   "m2.def_with_return": {
    "code": "def top_pickups(df):\n    return df.groupBy(\"PULocationID\").count().orderBy(F.desc(\"count\"), \"PULocationID\")\n\ntop_pickups(trips).show()",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|           7|    4|\n|          33|    2|\n|          41|    2|\n|          74|    2|\n|          75|    1|\n|          97|    1|\n+------------+-----+\n\n",
    "err": null
   },
   "m2.lazy.select_PULocationId": {
    "code": "x = trips.select(\"PULocationId\")\ntype(x)",
    "out": "<class 'pyspark.sql.connect.dataframe.DataFrame'>",
    "err": null
   },
   "m2.lazy.select_PULocationId.show": {
    "code": "x.show()",
    "out": "+------------+\n|PULocationId|\n+------------+\n|          41|\n|          97|\n|           7|\n|           7|\n|          74|\n|          33|\n|          41|\n|           7|\n|          75|\n|          74|\n|           7|\n|          33|\n+------------+\n\n",
    "err": null
   },
   "m2.lazy.select_typo": {
    "code": "pu = trips.select(\"PULocatonID\")\ntype(pu)",
    "out": "<class 'pyspark.sql.connect.dataframe.DataFrame'>",
    "err": null
   },
   "m2.lazy.select_typo.show": {
    "code": "pu.show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 52>\", line 1, in <module>\n    pu.show()\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID]\n+- Relation [VendorID#276,lpep_pickup_datetime#277,store_and_fwd_flag#278,PULocationID#279,DOLocationID#280,passenger_count#281,trip_distance#282,fare_amount#283,tip_amount#284,total_amount#285] csv"
   },
   "m2.lazy.filter_typo": {
    "code": "big = trips.filter(F.col(\"fare_amt\") > 10)\ntype(big)",
    "out": "<class 'pyspark.sql.connect.dataframe.DataFrame'>",
    "err": null
   },
   "m2.lazy.filter_typo.count": {
    "code": "big.count()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 54>\", line 1, in <module>\n    big.count()\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `fare_amt` cannot be resolved. Did you mean one of the following? [`fare_amount`, `tip_amount`, `VendorID`, `total_amount`, `trip_distance`]. SQLSTATE: 42703;\n'Aggregate [unresolvedalias(count(1))]\n+- 'Filter '`>`('fare_amt, 10)\n   +- Relation [VendorID#276,lpep_pickup_datetime#277,store_and_fwd_flag#278,PULocationID#279,DOLocationID#280,passenger_count#281,trip_distance#282,fare_amount#283,tip_amount#284,total_amount#285] csv"
   },
   "m2.explain_taxi12": {
    "code": "trips.groupBy(\"PULocationID\").count().orderBy(F.desc(\"count\")).explain()",
    "out": "== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- Sort [count#4148L DESC NULLS LAST], true, 0\n   +- Exchange rangepartitioning(count#4148L DESC NULLS LAST, 200), ENSURE_REQUIREMENTS, [plan_id=2362]\n      +- HashAggregate(keys=[PULocationID#3420], functions=[count(1)])\n         +- Exchange hashpartitioning(PULocationID#3420, 200), ENSURE_REQUIREMENTS, [plan_id=2359]\n            +- HashAggregate(keys=[PULocationID#3420], functions=[partial_count(1)])\n               +- FileScan csv [PULocationID#3420] Batched: false, DataFilters: [], Format: CSV, Location: InMemoryFileIndex(1 paths)[dbfs:/Volumes/workspace/default/bdcc/lessons/taxi12.csv], PartitionFilters: [], PushedFilters: [], ReadSchema: struct<PULocationID:int>\n\n\n",
    "err": null
   },
   "m2.explain_taxi12_var": {
    "code": "trips2 = trips.groupBy(\"PULocationID\").count().orderBy(F.desc(\"count\"))\ntrips2.explain()",
    "out": "== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- Sort [count#4153L DESC NULLS LAST], true, 0\n   +- Exchange rangepartitioning(count#4153L DESC NULLS LAST, 200), ENSURE_REQUIREMENTS, [plan_id=2382]\n      +- HashAggregate(keys=[PULocationID#3420], functions=[count(1)])\n         +- Exchange hashpartitioning(PULocationID#3420, 200), ENSURE_REQUIREMENTS, [plan_id=2379]\n            +- HashAggregate(keys=[PULocationID#3420], functions=[partial_count(1)])\n               +- FileScan csv [PULocationID#3420] Batched: false, DataFilters: [], Format: CSV, Location: InMemoryFileIndex(1 paths)[dbfs:/Volumes/workspace/default/bdcc/lessons/taxi12.csv], PartitionFilters: [], PushedFilters: [], ReadSchema: struct<PULocationID:int>\n\n\n",
    "err": null
   },
   "m2.wildcard.import": {
    "code": "from pyspark.sql.functions import *",
    "out": "",
    "err": null
   },
   "m2.wildcard.round": {
    "code": "round(4.567, 1)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 2>\", line 1, in <module>\n    round(4.567, 1)\n  ...\nAssertionError"
   },
   "m2.wildcard.max": {
    "code": "max(3, 7)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 3>\", line 1, in <module>\n    max(3, 7)\n  ...\nTypeError: max() takes 1 positional argument but 2 were given"
   },
   "m2.wildcard.sum": {
    "code": "sum([1, 2, 3])",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 4>\", line 1, in <module>\n    sum([1, 2, 3])\n  ...\nAssertionError"
   },
   "m2.wildcard.round_repr": {
    "code": "round",
    "out": "<function round at 0x0000020F4F8F3560>",
    "err": null
   },
   "m1.ddl_int.read": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\nschema = \"\"\"\nVendorID INT,\nlpep_pickup_datetime TIMESTAMP,\nstore_and_fwd_flag INT,\nPULocationID INT,\nDOLocationID INT,\npassenger_count INT,\ntrip_distance FLOAT,\nfare_amount FLOAT,\ntip_amount FLOAT,\ntotal_amount FLOAT\n\"\"\"\ntrips = spark.read.csv(\n    f\"{BASE}/lessons/taxi12.csv\",\n    sep=\",\",\n    header=True,\n    schema=schema,\n)",
    "out": "",
    "err": null
   },
   "m1.ddl_int.printSchema": {
    "code": "trips.printSchema()",
    "out": "root\n |-- VendorID: integer (nullable = true)\n |-- lpep_pickup_datetime: timestamp (nullable = true)\n |-- store_and_fwd_flag: integer (nullable = true)\n |-- PULocationID: integer (nullable = true)\n |-- DOLocationID: integer (nullable = true)\n |-- passenger_count: integer (nullable = true)\n |-- trip_distance: float (nullable = true)\n |-- fare_amount: float (nullable = true)\n |-- tip_amount: float (nullable = true)\n |-- total_amount: float (nullable = true)\n\n",
    "err": null
   },
   "m1.ddl_int.show": {
    "code": "trips.show()",
    "out": "+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|VendorID|lpep_pickup_datetime|store_and_fwd_flag|PULocationID|DOLocationID|passenger_count|trip_distance|fare_amount|tip_amount|total_amount|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|       2| 2017-10-02 08:00:03|              NULL|          41|         238|              1|         1.94|       11.5|      2.46|       14.76|\n|       2| 2017-10-02 08:00:06|              NULL|          97|         137|              1|         5.08|       22.0|       2.0|        24.8|\n|       1| 2017-10-02 08:00:14|              NULL|           7|         261|              1|          9.8|       34.5|       6.0|        41.3|\n|       2| 2017-10-02 08:00:15|              NULL|           7|         179|              1|         0.37|        4.0|      0.96|        5.76|\n|       2| 2017-10-02 08:00:16|              NULL|          74|         166|              1|          1.4|        8.5|      1.86|       11.16|\n|       2| 2017-10-02 08:00:30|              NULL|          33|         140|              1|          8.1|       29.0|      4.47|       34.27|\n|       2| 2017-10-02 08:00:38|              NULL|          41|         238|              1|         1.76|       12.0|       0.0|        12.8|\n|       2| 2017-10-02 08:00:51|              NULL|           7|         260|              1|         1.51|        8.0|       0.0|         8.8|\n|       2| 2017-10-02 08:01:03|              NULL|          75|          41|              1|         1.56|        8.0|       0.0|         8.8|\n|       1| 2017-10-02 08:01:08|              NULL|          74|          75|              1|          1.0|        6.0|       0.0|         6.8|\n|       2| 2017-10-02 08:01:38|              NULL|           7|         223|              2|         2.15|       10.5|       0.0|        11.3|\n|       1| 2017-10-02 10:47:29|              NULL|          33|         143|              1|          7.1|       31.0|      6.35|       38.15|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n\n",
    "err": null
   },
   "m1.ddl_int.groupby_flag": {
    "code": "trips.groupBy(\"store_and_fwd_flag\").count().show()",
    "out": "+------------------+-----+\n|store_and_fwd_flag|count|\n+------------------+-----+\n|              NULL|   12|\n+------------------+-----+\n\n",
    "err": null
   },
   "m1.ddl_int.count_Y": {
    "code": "trips.filter(trips.store_and_fwd_flag == \"Y\").count()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 4>\", line 1, in <module>\n    trips.filter(trips.store_and_fwd_flag == \"Y\").count()\n  ...\npyspark.errors.exceptions.connect.NumberFormatException: [CAST_INVALID_INPUT] The value 'Y' of the type \"STRING\" cannot be cast to \"BIGINT\" because it is malformed. Correct the value as per the syntax, or change its target type. Use `try_cast` to tolerate malformed input and return NULL instead. SQLSTATE: 22018\n== DataFrame ==\n\"__eq__\" was called from\n<cell 4>:1"
   },
   "m1.ddl_int.count_null": {
    "code": "trips.filter(trips.store_and_fwd_flag.isNull()).count()",
    "out": "12",
    "err": null
   },
   "m1.nameerror_fresh": {
    "code": "trips.show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 1>\", line 1, in <module>\n    trips.show()\n    ^^^^^\nNameError: name 'trips' is not defined"
   },
   "m1.columns": {
    "code": "trips.columns",
    "out": "['VendorID',\n 'lpep_pickup_datetime',\n 'store_and_fwd_flag',\n 'PULocationID',\n 'DOLocationID',\n 'passenger_count',\n 'trip_distance',\n 'fare_amount',\n 'tip_amount',\n 'total_amount']",
    "err": null
   },
   "full.csv.count": {
    "code": "trips.count()",
    "out": "2705926",
    "err": null
   },
   "full.csv_infer.total_gt_1000": {
    "code": "trips.filter(trips.total_amount > 1000).count()",
    "out": "5",
    "err": null
   },
   "full.csv_infer.groupby_pu_desc": {
    "code": "trips.groupBy(\"PULocationID\").count().orderBy(F.desc(\"count\")).show()",
    "out": "+------------+------+\n|PULocationID| count|\n+------------+------+\n|          74|167207|\n|          41|150186|\n|          75|149227|\n|           7|137966|\n|          82|127071|\n|         166|114460|\n|         255| 92982|\n|          42| 88615|\n|         181| 87262|\n|          97| 84196|\n|         129| 76111|\n|          33| 73776|\n|          95| 71792|\n|          25| 69632|\n|          65| 65991|\n|         244| 64259|\n|         260| 59804|\n|          66| 54805|\n|         223| 54271|\n|         116| 39841|\n+------------+------+\nonly showing top 20 rows\n",
    "err": null
   },
   "full.pq.explain": {
    "code": "trips2 = trips.groupBy(\"PULocationID\").count().orderBy(F.desc(\"count\"))\ntrips2.explain()",
    "out": "== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- Sort [count#4183L DESC NULLS LAST], true, 0\n   +- Exchange rangepartitioning(count#4183L DESC NULLS LAST, 200), ENSURE_REQUIREMENTS, [plan_id=2438]\n      +- HashAggregate(keys=[PULocationID#4163], functions=[count(1)])\n         +- Exchange hashpartitioning(PULocationID#4163, 200), ENSURE_REQUIREMENTS, [plan_id=2435]\n            +- HashAggregate(keys=[PULocationID#4163], functions=[partial_count(1)])\n               +- FileScan parquet [PULocationID#4163] Batched: true, DataFilters: [], Format: Parquet, Location: InMemoryFileIndex(1 paths)[dbfs:/Volumes/workspace/default/bdcc/nyctaxi/green_2017], PartitionFilters: [], PushedFilters: [], ReadSchema: struct<PULocationID:int>\n\n\n",
    "err": null
   },
   "m2x.app.read": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\ntrips = spark.read.csv(f\"{BASE}/lessons/taxi12.csv\", header=True, inferSchema=True)\nfrom pyspark.sql.functions import *",
    "out": "",
    "err": null
   },
   "m2x.app.and": {
    "code": "tipped = trips.filter(trips.tip_amount > 0 and trips.fare_amount > 5)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 2>\", line 1, in <module>\n    tipped = trips.filter(trips.tip_amount > 0 and trips.fare_amount > 5)\n                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.base.PySparkValueError: [CANNOT_CONVERT_COLUMN_INTO_BOOL] Cannot convert column into bool: please use '&' for 'and', '|' for 'or', '~' for 'not' when building DataFrame boolean expressions."
   },
   "m2x.app.and_fix": {
    "code": "tipped = trips.filter((trips.tip_amount > 0) & (trips.fare_amount > 5))\ntipped.count()",
    "out": "6",
    "err": null
   },
   "m2x.app.typo_line": {
    "code": "by_zone = tipped.groupBy(\"PULocationID\").agg(mean(\"tip_amont\").alias(\"avg_tip\"))\ntype(by_zone)",
    "out": "<class 'pyspark.sql.connect.dataframe.DataFrame'>",
    "err": null
   },
   "m2x.app.typo_show": {
    "code": "by_zone.orderBy(desc(\"avg_tip\")).show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 5>\", line 1, in <module>\n    by_zone.orderBy(desc(\"avg_tip\")).show()\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `tip_amont` cannot be resolved. Did you mean one of the following? [`tip_amount`, `fare_amount`, `total_amount`, `VendorID`, `trip_distance`]. SQLSTATE: 42703;\n'Sort ['avg_tip DESC NULLS LAST], true\n+- 'Aggregate [PULocationID#21], [PULocationID#21, 'avg('tip_amont) AS avg_tip#37]\n   +- Filter ((tip_amount#26 > cast(0 as double)) AND (fare_amount#25 > cast(5 as double)))\n      +- Relation [VendorID#18,lpep_pickup_datetime#19,store_and_fwd_flag#20,PULocationID#21,DOLocationID#22,passenger_count#23,trip_distance#24,fare_amount#25,tip_amount#26,total_amount#27] csv"
   },
   "m2x.app.typo_fix": {
    "code": "by_zone = tipped.groupBy(\"PULocationID\").agg(mean(\"tip_amount\").alias(\"avg_tip\"))\nby_zone.orderBy(desc(\"avg_tip\"), \"PULocationID\").show()",
    "out": "+------------+-------+\n|PULocationID|avg_tip|\n+------------+-------+\n|           7|    6.0|\n|          33|   5.41|\n|          41|   2.46|\n|          97|    2.0|\n|          74|   1.86|\n+------------+-------+\n\n",
    "err": null
   },
   "m2x.app.round": {
    "code": "share = round(tipped.count() / trips.count(), 2)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 7>\", line 1, in <module>\n    share = round(tipped.count() / trips.count(), 2)\n            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\nAssertionError"
   },
   "m2x.app.no_return": {
    "code": "def best_zones(df):\n    df.groupBy(\"PULocationID\").agg(mean(\"tip_amount\").alias(\"avg_tip\")).orderBy(desc(\"avg_tip\"), \"PULocationID\")\n\nbest_zones(tipped).show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 8>\", line 4, in <module>\n    best_zones(tipped).show()\n    ^^^^^^^^^^^^^^^^^^^^^^^\nAttributeError: 'NoneType' object has no attribute 'show'"
   },
   "m2x.app.builtins_back": {
    "code": "from builtins import abs, ascii, bin, filter, hash, hex, max, min, pow, round, slice, sum\n\nprint(round(4.567, 1), max(3, 7), sum([1, 2, 3]))",
    "out": "4.6 7 6\n",
    "err": null
   },
   "m2x.fixed.read": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\nfrom pyspark.sql import functions as F\n\ntrips = spark.read.csv(f\"{BASE}/lessons/taxi12.csv\", header=True, inferSchema=True)",
    "out": "",
    "err": null
   },
   "m2x.fixed.best": {
    "code": "def best_zones(df):\n    tipped = df.filter((F.col(\"tip_amount\") > 0) & (F.col(\"fare_amount\") > 5))\n    by_zone = tipped.groupBy(\"PULocationID\").agg(F.mean(\"tip_amount\").alias(\"avg_tip\"))\n    return by_zone.orderBy(F.desc(\"avg_tip\"), \"PULocationID\")\n\nbest = best_zones(trips)\nbest.show()",
    "out": "+------------+-------+\n|PULocationID|avg_tip|\n+------------+-------+\n|           7|    6.0|\n|          33|   5.41|\n|          41|   2.46|\n|          97|    2.0|\n|          74|   1.86|\n+------------+-------+\n\n",
    "err": null
   },
   "m2x.fixed.share": {
    "code": "tipped = trips.filter((F.col(\"tip_amount\") > 0) & (F.col(\"fare_amount\") > 5))\nprint(round(tipped.count() / trips.count(), 2))",
    "out": "0.5\n",
    "err": null
   },
   "m2x.fixed.explain": {
    "code": "best.explain()",
    "out": "== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- Sort [avg_tip#191 DESC NULLS LAST, PULocationID#93 ASC NULLS FIRST], true, 0\n   +- Exchange rangepartitioning(avg_tip#191 DESC NULLS LAST, PULocationID#93 ASC NULLS FIRST, 200), ENSURE_REQUIREMENTS, [plan_id=435]\n      +- HashAggregate(keys=[PULocationID#93], functions=[avg(tip_amount#98)])\n         +- Exchange hashpartitioning(PULocationID#93, 200), ENSURE_REQUIREMENTS, [plan_id=432]\n            +- HashAggregate(keys=[PULocationID#93], functions=[partial_avg(tip_amount#98)])\n               +- Project [PULocationID#93, tip_amount#98]\n                  +- Filter (((isnotnull(tip_amount#98) AND isnotnull(fare_amount#97)) AND (tip_amount#98 > 0.0)) AND (fare_amount#97 > 5.0))\n                     +- FileScan csv [PULocationID#93,fare_amount#97,tip_amount#98] Batched: false, DataFilters: [isnotnull(tip_amount#98), isnotnull(fare_amount#97), (tip_amount#98 > 0.0), (fare_amount#97 > 5.0)], Format: CSV, Location: InMemoryFileIndex(1 paths)[dbfs:/Volumes/workspace/default/bdcc/lessons/taxi12.csv], PartitionFilters: [], PushedFilters: [IsNotNull(tip_amount), IsNotNull(fare_amount), GreaterThan(tip_amount,0.0), GreaterThan(fare_amount,5.0)], ReadSchema: struct<PULocationID:int,fare_amount:double,tip_amount:double>\n\n\n",
    "err": null
   },
   "m2x.lazy.read": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\ntrips = spark.read.csv(f\"{BASE}/lessons/taxi12.csv\", header=True, inferSchema=True)\nfrom pyspark.sql import functions as F",
    "out": "",
    "err": null
   },
   "m2x.lazy.bad_select": {
    "code": "bad = trips.select(\"PULocatonID\", \"tip_amount\")\ntype(bad)",
    "out": "<class 'pyspark.sql.connect.dataframe.DataFrame'>",
    "err": null
   },
   "m2x.lazy.bad_then_groupby_ok": {
    "code": "bad.groupBy(\"tip_amount\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 3>\", line 1, in <module>\n    bad.groupBy(\"tip_amount\")\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID, tip_amount#223]\n+- Relation [VendorID#215,lpep_pickup_datetime#216,store_and_fwd_flag#217,PULocationID#218,DOLocationID#219,passenger_count#220,trip_distance#221,fare_amount#222,tip_amount#223,total_amount#224] csv"
   },
   "m2x.lazy.bad_then_filter": {
    "code": "bad.filter(F.col(\"tip_amount\") > 0)",
    "out": "",
    "err": "Traceback (most recent call last):\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Filter '`>`('tip_amount, 0)\n+- 'Project ['PULocatonID, tip_amount#223]\n   +- Relation [VendorID#215,lpep_pickup_datetime#216,store_and_fwd_flag#217,PULocationID#218,DOLocationID#219,passenger_count#220,trip_distance#221,fare_amount#222,tip_amount#223,total_amount#224] csv"
   },
   "m2x.lazy.bad_columns": {
    "code": "bad.columns",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 5>\", line 1, in <module>\n    bad.columns\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID, tip_amount#223]\n+- Relation [VendorID#215,lpep_pickup_datetime#216,store_and_fwd_flag#217,PULocationID#218,DOLocationID#219,passenger_count#220,trip_distance#221,fare_amount#222,tip_amount#223,total_amount#224] csv"
   },
   "m2x.lazy.getitem_typo": {
    "code": "trips[\"PULocatonID\"]",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 6>\", line 1, in <module>\n    trips[\"PULocatonID\"]\n    ~~~~~^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID]\n+- Relation [VendorID#246,lpep_pickup_datetime#247,store_and_fwd_flag#248,PULocationID#249,DOLocationID#250,passenger_count#251,trip_distance#252,fare_amount#253,tip_amount#254,total_amount#255] csv"
   },
   "m2x.lazy.getattr_typo": {
    "code": "trips.PULocatonID",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 7>\", line 1, in <module>\n    trips.PULocatonID\n  ...\npyspark.errors.exceptions.base.PySparkAttributeError: [ATTRIBUTE_NOT_SUPPORTED] Attribute `PULocatonID` is not supported.. Did you mean: 'PULocationID'?"
   },
   "m2x.lazy.groupby_typo": {
    "code": "trips.groupBy(\"PULocatonID\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 8>\", line 1, in <module>\n    trips.groupBy(\"PULocatonID\")\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID]\n+- Relation [VendorID#246,lpep_pickup_datetime#247,store_and_fwd_flag#248,PULocationID#249,DOLocationID#250,passenger_count#251,trip_distance#252,fare_amount#253,tip_amount#254,total_amount#255] csv"
   },
   "m2x.lazy.orderby_typo": {
    "code": "srt = trips.orderBy(\"fare_amt\")\ntype(srt)",
    "out": "<class 'pyspark.sql.connect.dataframe.DataFrame'>",
    "err": null
   },
   "m2x.lazy.orderby_typo_show": {
    "code": "srt.show(3)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 10>\", line 1, in <module>\n    srt.show(3)\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `fare_amt` cannot be resolved. Did you mean one of the following? [`fare_amount`, `tip_amount`, `VendorID`, `total_amount`, `trip_distance`]. SQLSTATE: 42703;\n'Sort ['fare_amt ASC NULLS FIRST], true\n+- Relation [VendorID#246,lpep_pickup_datetime#247,store_and_fwd_flag#248,PULocationID#249,DOLocationID#250,passenger_count#251,trip_distance#252,fare_amount#253,tip_amount#254,total_amount#255] csv"
   },
   "m2x.lazy.multiline": {
    "code": "pu = trips.select(\"PULocatonID\")\nn = trips.count()\nprint(n)\npu.show()",
    "out": "12\n",
    "err": "Traceback (most recent call last):\n  File \"<cell 11>\", line 4, in <module>\n    pu.show()\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID]\n+- Relation [VendorID#246,lpep_pickup_datetime#247,store_and_fwd_flag#248,PULocationID#249,DOLocationID#250,passenger_count#251,trip_distance#252,fare_amount#253,tip_amount#254,total_amount#255] csv"
   },
   "m2x.lazy.desc_repr": {
    "code": "F.desc(\"count\")",
    "out": "Column<'count DESC NULLS LAST'>",
    "err": null
   },
   "m2x.lazy.col_gt_repr": {
    "code": "F.col(\"fare_amount\") > 10",
    "out": "Column<'>(fare_amount, 10)'>",
    "err": null
   },
   "m2x.lazy.dir_trunc": {
    "code": "[name for name in dir(F) if \"trunc\" in name]",
    "out": "['date_trunc', 'trunc']",
    "err": null
   },
   "m2x.lazy.sql_gt_1000": {
    "code": "trips.filter(\"total_amount > 1000\").count()",
    "out": "0",
    "err": null
   },
   "m2x.lazy.where_sql_30": {
    "code": "trips.where(\"total_amount > 30\").count()",
    "out": "3",
    "err": null
   },
   "m2x.lazy.assembly": {
    "code": "(\n    trips.select(\"PULocationID\")\n    .groupBy(\"PULocationID\")\n    .count()\n    .orderBy(F.desc(\"count\"), \"PULocationID\")\n    .show()\n)",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|           7|    4|\n|          33|    2|\n|          41|    2|\n|          74|    2|\n|          75|    1|\n|          97|    1|\n+------------+-----+\n\n",
    "err": null
   },
   "m2x.lazy.groupby_show": {
    "code": "trips.groupBy(\"PULocationID\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 18>\", line 1, in <module>\n    trips.groupBy(\"PULocationID\").show()\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\nAttributeError: 'GroupedData' object has no attribute 'show'"
   },
   "m2x.lazy.cell63_F": {
    "code": "(\n    trips.freqItems([\"PULocationID\"], 0.3)\n    .withColumn(\"freq_items\", F.explode(\"PULocationID_freqItems\"))\n    .drop(\"PULocationID_freqItems\")\n    .show()\n)",
    "out": "+----------+\n|freq_items|\n+----------+\n|        33|\n|         7|\n|        74|\n+----------+\n\n",
    "err": null
   },
   "m2x.lazy.fare_select_group": {
    "code": "(\n    trips.filter(F.col(\"fare_amount\") > 10)\n    .select(\"PULocationID\", \"fare_amount\")\n    .groupBy(\"PULocationID\")\n    .count()\n    .orderBy(F.desc(\"count\"), \"PULocationID\")\n    .show()\n)",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|           7|    2|\n|          33|    2|\n|          41|    2|\n|          97|    1|\n+------------+-----+\n\n",
    "err": null
   },
   "m2x.lazy.top_pickups_show5": {
    "code": "def top_pickups(df):\n    \"\"\"Return the pickup zones with their trip counts, busiest first.\"\"\"\n    return df.groupBy(\"PULocationID\").count().orderBy(F.desc(\"count\"), \"PULocationID\")\n\n\ntop_pickups(trips).show(5)",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|           7|    4|\n|          33|    2|\n|          41|    2|\n|          74|    2|\n|          75|    1|\n+------------+-----+\nonly showing top 5 rows\n",
    "err": null
   },
   "m2x.lazy.explain_cell98": {
    "code": "trips2 = trips.groupby(trips[\"PULocationID\"]).count().orderBy(F.desc(\"count\"))\ntrips2.explain()",
    "out": "== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- Sort [count#346L DESC NULLS LAST], true, 0\n   +- Exchange rangepartitioning(count#346L DESC NULLS LAST, 200), ENSURE_REQUIREMENTS, [plan_id=860]\n      +- HashAggregate(keys=[PULocationID#249], functions=[count(1)])\n         +- Exchange hashpartitioning(PULocationID#249, 200), ENSURE_REQUIREMENTS, [plan_id=857]\n            +- HashAggregate(keys=[PULocationID#249], functions=[partial_count(1)])\n               +- FileScan csv [PULocationID#249] Batched: false, DataFilters: [], Format: CSV, Location: InMemoryFileIndex(1 paths)[dbfs:/Volumes/workspace/default/bdcc/lessons/taxi12.csv], PartitionFilters: [], PushedFilters: [], ReadSchema: struct<PULocationID:int>\n\n\n",
    "err": null
   },
   "m2x.lazy.trips2_show": {
    "code": "trips2.show(5)",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|           7|    4|\n|          41|    2|\n|          33|    2|\n|          74|    2|\n|          97|    1|\n+------------+-----+\nonly showing top 5 rows\n",
    "err": null
   },
   "m2x.lazy.printSchema": {
    "code": "trips.printSchema()",
    "out": "root\n |-- VendorID: integer (nullable = true)\n |-- lpep_pickup_datetime: timestamp (nullable = true)\n |-- store_and_fwd_flag: string (nullable = true)\n |-- PULocationID: integer (nullable = true)\n |-- DOLocationID: integer (nullable = true)\n |-- passenger_count: integer (nullable = true)\n |-- trip_distance: double (nullable = true)\n |-- fare_amount: double (nullable = true)\n |-- tip_amount: double (nullable = true)\n |-- total_amount: double (nullable = true)\n\n",
    "err": null
   },
   "m2x.lazy.dtypes6": {
    "code": "trips.dtypes[:6]",
    "out": "[('VendorID', 'int'),\n ('lpep_pickup_datetime', 'timestamp'),\n ('store_and_fwd_flag', 'string'),\n ('PULocationID', 'int'),\n ('DOLocationID', 'int'),\n ('passenger_count', 'int')]",
    "err": null
   },
   "m2x.noimport.read": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\ntrips = spark.read.csv(f\"{BASE}/lessons/taxi12.csv\", header=True, inferSchema=True)",
    "out": "",
    "err": null
   },
   "m2x.noimport.def_desc": {
    "code": "def top_pickups(df):\n    return df.groupBy(\"PULocationID\").count().orderBy(desc(\"count\"))\n\ntop_pickups(trips).show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 2>\", line 4, in <module>\n    top_pickups(trips).show()\n    ^^^^^^^^^^^^^^^^^^\n  File \"<cell 2>\", line 2, in top_pickups\n    return df.groupBy(\"PULocationID\").count().orderBy(desc(\"count\"))\n                                                      ^^^^\nNameError: name 'desc' is not defined"
   },
   "m2x.wait.read": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\ntrips = spark.read.csv(f\"{BASE}/lessons/taxi12.csv\", header=True, inferSchema=True)\nfrom pyspark.sql import functions as F",
    "out": "",
    "err": null
   },
   "m2x.wait.bad": {
    "code": "bad = trips.select(\"PULocatonID\", \"tip_amount\")",
    "out": "",
    "err": null
   },
   "m2x.wait.filter_on_bad": {
    "code": "x1 = bad.filter(F.col(\"tip_amount\") > 0)\nprint(\"no error\")",
    "out": "no error\n",
    "err": null
   },
   "m2x.wait.orderby_on_bad": {
    "code": "x2 = bad.orderBy(\"tip_amount\")\nprint(\"no error\")",
    "out": "no error\n",
    "err": null
   },
   "m2x.wait.select_on_bad": {
    "code": "x3 = bad.select(\"tip_amount\")\nprint(\"no error\")",
    "out": "no error\n",
    "err": null
   },
   "m2x.wait.groupby_on_bad": {
    "code": "x4 = bad.groupBy(\"tip_amount\")\nprint(\"no error\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 6>\", line 1, in <module>\n    x4 = bad.groupBy(\"tip_amount\")\n         ^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID, tip_amount#26]\n+- Relation [VendorID#18,lpep_pickup_datetime#19,store_and_fwd_flag#20,PULocationID#21,DOLocationID#22,passenger_count#23,trip_distance#24,fare_amount#25,tip_amount#26,total_amount#27] csv"
   },
   "m2x.wait.getitem_on_bad": {
    "code": "x6 = bad[\"tip_amount\"]\nprint(\"no error\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 7>\", line 1, in <module>\n    x6 = bad[\"tip_amount\"]\n         ~~~^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID, tip_amount#26]\n+- Relation [VendorID#18,lpep_pickup_datetime#19,store_and_fwd_flag#20,PULocationID#21,DOLocationID#22,passenger_count#23,trip_distance#24,fare_amount#25,tip_amount#26,total_amount#27] csv"
   },
   "m2x.wait.count_on_bad": {
    "code": "n = bad.count()\nprint(\"no error\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 8>\", line 1, in <module>\n    n = bad.count()\n        ^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Aggregate [unresolvedalias(count(1))]\n+- 'Project ['PULocatonID, tip_amount#26]\n   +- Relation [VendorID#18,lpep_pickup_datetime#19,store_and_fwd_flag#20,PULocationID#21,DOLocationID#22,passenger_count#23,trip_distance#24,fare_amount#25,tip_amount#26,total_amount#27] csv"
   },
   "m2x.wait.withcolumn_typo": {
    "code": "x7 = trips.withColumn(\"x\", F.col(\"fare_amt\") * 2)\nprint(\"no error\")",
    "out": "no error\n",
    "err": null
   },
   "m2x.wait.agg_typo": {
    "code": "x8 = trips.agg(F.mean(\"tip_amont\"))\nprint(\"no error\")",
    "out": "no error\n",
    "err": null
   },
   "m2x.wait.groupby_agg_typo": {
    "code": "x9 = trips.groupBy(\"VendorID\").agg(F.mean(\"tip_amont\"))\nprint(\"no error\")",
    "out": "no error\n",
    "err": null
   },
   "m2x.wait.filter_typo": {
    "code": "x10 = trips.filter(F.col(\"fare_amt\") > 10)\nprint(\"no error\")",
    "out": "no error\n",
    "err": null
   },
   "m2x.wait.filter_typo_then_groupby": {
    "code": "x11 = x10.groupBy(\"PULocationID\")\nprint(\"no error\")",
    "out": "no error\n",
    "err": null
   },
   "m2x.wait.groupby_typo_assign": {
    "code": "g = trips.groupBy(\"PULocatonID\")\nprint(\"no error\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 14>\", line 1, in <module>\n    g = trips.groupBy(\"PULocatonID\")\n        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID]\n+- Relation [VendorID#50,lpep_pickup_datetime#51,store_and_fwd_flag#52,PULocationID#53,DOLocationID#54,passenger_count#55,trip_distance#56,fare_amount#57,tip_amount#58,total_amount#59] csv"
   },
   "m2x.wait.dot_typo_assign": {
    "code": "c = trips.PULocatonID\nprint(\"no error\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 15>\", line 1, in <module>\n    c = trips.PULocatonID\n        ^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.base.PySparkAttributeError: [ATTRIBUTE_NOT_SUPPORTED] Attribute `PULocatonID` is not supported.. Did you mean: 'PULocationID'?"
   },
   "m2x.wait.repr_bad": {
    "code": "bad",
    "out": "",
    "err": "Traceback (most recent call last):\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID, tip_amount#26]\n+- Relation [VendorID#18,lpep_pickup_datetime#19,store_and_fwd_flag#20,PULocationID#21,DOLocationID#22,passenger_count#23,trip_distance#24,fare_amount#25,tip_amount#26,total_amount#27] csv"
   },
   "m2x.wait.toPandas_bad": {
    "code": "bad.toPandas()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 17>\", line 1, in <module>\n    bad.toPandas()\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID, tip_amount#26]\n+- Relation [VendorID#18,lpep_pickup_datetime#19,store_and_fwd_flag#20,PULocationID#21,DOLocationID#22,passenger_count#23,trip_distance#24,fare_amount#25,tip_amount#26,total_amount#27] csv"
   },
   "m2x.wait.first_bad": {
    "code": "bad.first()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 18>\", line 1, in <module>\n    bad.first()\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'GlobalLimit 1\n+- 'LocalLimit 1\n   +- 'Project ['PULocatonID, tip_amount#26]\n      +- Relation [VendorID#18,lpep_pickup_datetime#19,store_and_fwd_flag#20,PULocationID#21,DOLocationID#22,passenger_count#23,trip_distance#24,fare_amount#25,tip_amount#26,total_amount#27] csv"
   },
   "m2x.wait.printSchema_bad": {
    "code": "bad.printSchema()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 19>\", line 1, in <module>\n    bad.printSchema()\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. Did you mean one of the following? [`PULocationID`, `DOLocationID`, `VendorID`, `tip_amount`, `fare_amount`]. SQLSTATE: 42703;\n'Project ['PULocatonID, tip_amount#26]\n+- Relation [VendorID#18,lpep_pickup_datetime#19,store_and_fwd_flag#20,PULocationID#21,DOLocationID#22,passenger_count#23,trip_distance#24,fare_amount#25,tip_amount#26,total_amount#27] csv"
   },
   "m2x.imp.none.round": {
    "code": "round(4.567, 1)",
    "out": "4.6",
    "err": null
   },
   "m2x.imp.none.max": {
    "code": "max(3, 7)",
    "out": "7",
    "err": null
   },
   "m2x.imp.none.sum": {
    "code": "sum([1, 2, 3])",
    "out": "6",
    "err": null
   },
   "m2x.imp.none.desc": {
    "code": "desc(\"count\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 4>\", line 1, in <module>\n    desc(\"count\")\n    ^^^^\nNameError: name 'desc' is not defined"
   },
   "m2x.imp.none.Fdesc": {
    "code": "F.desc(\"count\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 5>\", line 1, in <module>\n    F.desc(\"count\")\n    ^\nNameError: name 'F' is not defined"
   },
   "m2x.imp.one.import": {
    "code": "from pyspark.sql.functions import desc",
    "out": "",
    "err": null
   },
   "m2x.imp.one.round": {
    "code": "round(4.567, 1)",
    "out": "4.6",
    "err": null
   },
   "m2x.imp.one.max": {
    "code": "max(3, 7)",
    "out": "7",
    "err": null
   },
   "m2x.imp.one.sum": {
    "code": "sum([1, 2, 3])",
    "out": "6",
    "err": null
   },
   "m2x.imp.one.desc": {
    "code": "desc(\"count\")",
    "out": "Column<'count DESC NULLS LAST'>",
    "err": null
   },
   "m2x.imp.one.Fdesc": {
    "code": "F.desc(\"count\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 6>\", line 1, in <module>\n    F.desc(\"count\")\n    ^\nNameError: name 'F' is not defined"
   },
   "m2x.imp.star.import": {
    "code": "from pyspark.sql.functions import *",
    "out": "",
    "err": null
   },
   "m2x.imp.star.round": {
    "code": "round(4.567, 1)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 2>\", line 1, in <module>\n    round(4.567, 1)\n  ...\nAssertionError"
   },
   "m2x.imp.star.max": {
    "code": "max(3, 7)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 3>\", line 1, in <module>\n    max(3, 7)\n  ...\nTypeError: max() takes 1 positional argument but 2 were given"
   },
   "m2x.imp.star.sum": {
    "code": "sum([1, 2, 3])",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 4>\", line 1, in <module>\n    sum([1, 2, 3])\n  ...\nAssertionError"
   },
   "m2x.imp.star.desc": {
    "code": "desc(\"count\")",
    "out": "Column<'count DESC NULLS LAST'>",
    "err": null
   },
   "m2x.imp.star.Fdesc": {
    "code": "F.desc(\"count\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 6>\", line 1, in <module>\n    F.desc(\"count\")\n    ^\nNameError: name 'F' is not defined"
   },
   "m2x.imp.F.import": {
    "code": "from pyspark.sql import functions as F",
    "out": "",
    "err": null
   },
   "m2x.imp.F.round": {
    "code": "round(4.567, 1)",
    "out": "4.6",
    "err": null
   },
   "m2x.imp.F.max": {
    "code": "max(3, 7)",
    "out": "7",
    "err": null
   },
   "m2x.imp.F.sum": {
    "code": "sum([1, 2, 3])",
    "out": "6",
    "err": null
   },
   "m2x.imp.F.desc": {
    "code": "desc(\"count\")",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 5>\", line 1, in <module>\n    desc(\"count\")\n    ^^^^\nNameError: name 'desc' is not defined"
   },
   "m2x.imp.F.Fdesc": {
    "code": "F.desc(\"count\")",
    "out": "Column<'count DESC NULLS LAST'>",
    "err": null
   },
   "m2x.app2.read": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\ntrips = spark.read.csv(f\"{BASE}/lessons/taxi12.csv\", header=True, inferSchema=True)\nfrom pyspark.sql.functions import *",
    "out": "",
    "err": null
   },
   "m2x.app2.and_parens": {
    "code": "tipped = trips.filter((trips.tip_amount > 0) and (trips.fare_amount > 5))",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 2>\", line 1, in <module>\n    tipped = trips.filter((trips.tip_amount > 0) and (trips.fare_amount > 5))\n                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.base.PySparkValueError: [CANNOT_CONVERT_COLUMN_INTO_BOOL] Cannot convert column into bool: please use '&' for 'and', '|' for 'or', '~' for 'not' when building DataFrame boolean expressions."
   },
   "m2x.app2.amp_no_parens": {
    "code": "tipped = trips.filter(trips.tip_amount > 0 & trips.fare_amount > 5)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 3>\", line 1, in <module>\n    tipped = trips.filter(trips.tip_amount > 0 & trips.fare_amount > 5)\n                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.base.PySparkValueError: [CANNOT_CONVERT_COLUMN_INTO_BOOL] Cannot convert column into bool: please use '&' for 'and', '|' for 'or', '~' for 'not' when building DataFrame boolean expressions."
   },
   "m2x.app2.two_filters": {
    "code": "tipped = trips.filter(trips.tip_amount > 0).filter(trips.fare_amount > 5)\ntipped.count()",
    "out": "6",
    "err": null
   },
   "m2x.app2.or_count": {
    "code": "trips.filter((trips.tip_amount > 0) | (trips.fare_amount > 5)).count()",
    "out": "12",
    "err": null
   },
   "m2x.fixed2.read": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\nfrom pyspark.sql import functions as F\n\ntrips = spark.read.csv(f\"{BASE}/lessons/taxi12.csv\", header=True, inferSchema=True)",
    "out": "",
    "err": null
   },
   "m2x.fixed2.dir_mean": {
    "code": "[name for name in dir(F) if \"mean\" in name]",
    "out": "['mean']",
    "err": null
   },
   "m2x.fixed2.fare0": {
    "code": "tipped = trips.filter((F.col(\"tip_amount\") > 0) & (F.col(\"fare_amount\") > 0))\nby_zone = tipped.groupBy(\"PULocationID\").agg(F.mean(\"tip_amount\").alias(\"avg_tip\"))\nby_zone.orderBy(F.desc(\"avg_tip\"), \"PULocationID\").show()",
    "out": "+------------+-------+\n|PULocationID|avg_tip|\n+------------+-------+\n|          33|   5.41|\n|           7|   3.48|\n|          41|   2.46|\n|          97|    2.0|\n|          74|   1.86|\n+------------+-------+\n\n",
    "err": null
   },
   "m2x.fixed2.fare10": {
    "code": "tipped = trips.filter((F.col(\"tip_amount\") > 0) & (F.col(\"fare_amount\") > 10))\nby_zone = tipped.groupBy(\"PULocationID\").agg(F.mean(\"tip_amount\").alias(\"avg_tip\"))\nby_zone.orderBy(F.desc(\"avg_tip\"), \"PULocationID\").show()",
    "out": "+------------+-------+\n|PULocationID|avg_tip|\n+------------+-------+\n|           7|    6.0|\n|          33|   5.41|\n|          41|   2.46|\n|          97|    2.0|\n+------------+-------+\n\n",
    "err": null
   },
   "m2x.fixed2.fare20": {
    "code": "tipped = trips.filter((F.col(\"tip_amount\") > 0) & (F.col(\"fare_amount\") > 20))\nby_zone = tipped.groupBy(\"PULocationID\").agg(F.mean(\"tip_amount\").alias(\"avg_tip\"))\nby_zone.orderBy(F.desc(\"avg_tip\"), \"PULocationID\").show()",
    "out": "+------------+-------+\n|PULocationID|avg_tip|\n+------------+-------+\n|           7|    6.0|\n|          33|   5.41|\n|          97|    2.0|\n+------------+-------+\n\n",
    "err": null
   },
   "m2x.fixed2.fare5_counts": {
    "code": "tipped = trips.filter((F.col(\"tip_amount\") > 0) & (F.col(\"fare_amount\") > 5))\ntipped.groupBy(\"PULocationID\").count().orderBy(\"PULocationID\").show()",
    "out": "+------------+-----+\n|PULocationID|count|\n+------------+-----+\n|           7|    1|\n|          33|    2|\n|          41|    1|\n|          74|    1|\n|          97|    1|\n+------------+-----+\n\n",
    "err": null
   },
   "m2x.full.read": {
    "code": "BASE = \"/Volumes/workspace/default/bdcc\"\nfrom pyspark.sql import functions as F\n\ntrips = spark.read.csv(f\"{BASE}/nyctaxi/green_tripdata_2017-1*.csv\", header=True, inferSchema=True)",
    "out": "",
    "err": null
   },
   "m2x.full.best_show5": {
    "code": "def best_zones(df):\n    tipped = df.filter((F.col(\"tip_amount\") > 0) & (F.col(\"fare_amount\") > 5))\n    by_zone = tipped.groupBy(\"PULocationID\").agg(F.mean(\"tip_amount\").alias(\"avg_tip\"))\n    return by_zone.orderBy(F.desc(\"avg_tip\"), \"PULocationID\")\n\nbest = best_zones(trips)\nbest.show(5)",
    "out": "+------------+-----------------+\n|PULocationID|          avg_tip|\n+------------+-----------------+\n|           6|         20.88875|\n|         115|18.66923076923077|\n|          23|           18.162|\n|         221|16.19958333333333|\n|         176|             14.8|\n+------------+-----------------+\nonly showing top 5 rows\n",
    "err": null
   },
   "m2x.full.count_rows": {
    "code": "best.count()",
    "out": "236",
    "err": null
   },
   "m2x.full.tipped_count": {
    "code": "tipped = trips.filter((F.col(\"tip_amount\") > 0) & (F.col(\"fare_amount\") > 5))\ntipped.count()",
    "out": "964733",
    "err": null
   },
   "m2x.full.share": {
    "code": "print(round(tipped.count() / trips.count(), 2))",
    "out": "0.36\n",
    "err": null
   },
   "m2x.full.best_with_n": {
    "code": "by_zone = tipped.groupBy(\"PULocationID\").agg(\n    F.mean(\"tip_amount\").alias(\"avg_tip\"),\n    F.count(\"tip_amount\").alias(\"tipped_trips\"),\n)\nby_zone.orderBy(F.desc(\"avg_tip\"), \"PULocationID\").show(5)",
    "out": "+------------+-----------------+------------+\n|PULocationID|          avg_tip|tipped_trips|\n+------------+-----------------+------------+\n|           6|         20.88875|           8|\n|         115|18.66923076923077|          39|\n|          23|           18.162|          10|\n|         221|16.19958333333333|          24|\n|         176|             14.8|           2|\n+------------+-----------------+------------+\nonly showing top 5 rows\n",
    "err": null
   },
   "m2x.full.best_min100": {
    "code": "(\n    by_zone.filter(F.col(\"tipped_trips\") >= 100)\n    .orderBy(F.desc(\"avg_tip\"), \"PULocationID\")\n    .show(5)\n)",
    "out": "+------------+------------------+------------+\n|PULocationID|           avg_tip|tipped_trips|\n+------------+------------------+------------+\n|         265|10.656204819277109|         166|\n|         132| 9.439441860465116|         215|\n|         138| 8.042696078431371|         204|\n|          31| 5.815219665271965|         956|\n|         174| 5.418501529051991|         654|\n+------------+------------------+------------+\nonly showing top 5 rows\n",
    "err": null
   },
   "m2x.full.zones_kept": {
    "code": "by_zone.filter(F.col(\"tipped_trips\") >= 100).count()",
    "out": "128",
    "err": null
   },
   "m2x.full.explain": {
    "code": "best.explain()",
    "out": "== Physical Plan ==\nAdaptiveSparkPlan isFinalPlan=false\n+- Sort [avg_tip#559 DESC NULLS LAST, PULocationID#264 ASC NULLS FIRST], true, 0\n   +- Exchange rangepartitioning(avg_tip#559 DESC NULLS LAST, PULocationID#264 ASC NULLS FIRST, 200), ENSURE_REQUIREMENTS, [plan_id=1134]\n      +- HashAggregate(keys=[PULocationID#264], functions=[avg(tip_amount#271)])\n         +- Exchange hashpartitioning(PULocationID#264, 200), ENSURE_REQUIREMENTS, [plan_id=1131]\n            +- HashAggregate(keys=[PULocationID#264], functions=[partial_avg(tip_amount#271)])\n               +- Project [PULocationID#264, tip_amount#271]\n                  +- Filter (((isnotnull(tip_amount#271) AND isnotnull(fare_amount#268)) AND (tip_amount#271 > 0.0)) AND (fare_amount#268 > 5.0))\n                     +- FileScan csv [PULocationID#264,fare_amount#268,tip_amount#271] Batched: false, DataFilters: [isnotnull(tip_amount#271), isnotnull(fare_amount#268), (tip_amount#271 > 0.0), (fare_amount#268 > 5.0)], Format: CSV, Location: InMemoryFileIndex(3 paths)[dbfs:/Volumes/workspace/default/bdcc/nyctaxi/green_tripdata_2017-10.csv, dbfs:/Volumes/workspace/default/bdcc/nyctaxi/green_tripdata_2017-11.csv, dbfs:/Volumes/workspace/default/bdcc/nyctaxi/green_tripdata_2017-12.csv], PartitionFilters: [], PushedFilters: [IsNotNull(tip_amount), IsNotNull(fare_amount), GreaterThan(tip_amount,0.0), GreaterThan(fare_amount,5.0)], ReadSchema: struct<PULocationID:int,fare_amount:double,tip_amount:double>\n\n\n",
    "err": null
   },
   "m2x.full.typo_show": {
    "code": "bad = tipped.groupBy(\"PULocationID\").agg(F.mean(\"tip_amont\").alias(\"avg_tip\"))\nbad.show(5)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 10>\", line 2, in <module>\n    bad.show(5)\n  ...\npyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `tip_amont` cannot be resolved. Did you mean one of the following? [`tip_amount`, `fare_amount`, `tolls_amount`, `total_amount`, `trip_type`]. SQLSTATE: 42703;\n'Aggregate [PULocationID#463], [PULocationID#463, 'avg('tip_amont) AS avg_tip#566]\n+- Filter ((tip_amount#470 > cast(0 as double)) AND (fare_amount#467 > cast(5 as double)))\n   +- Relation [VendorID#458,lpep_pickup_datetime#459,lpep_dropoff_datetime#460,store_and_fwd_flag#461,RatecodeID#462,PULocationID#463,DOLocationID#464,passenger_count#465,trip_distance#466,fare_amount#467,extra#468,mta_tax#469,tip_amount#470,tolls_amount#471,ehail_fee#472,improvement_surcharge#473,total_amount#474,payment_type#475,trip_type#476] csv"
   }
  };
  // Ten real lines of the untrimmed 97-line traceback of m2.lazy.select_typo.show (local paths shortened to …\pyspark\).
  const RECEIPT = [
   {
    "id": "frame",
    "bin": "mine",
    "text": "File \"<cell 52>\", line 1, in <module>"
   },
   {
    "id": "code",
    "bin": "mine",
    "text": "pu.show()"
   },
   {
    "id": "show-frame",
    "bin": "skip",
    "text": "File \"…\\pyspark\\sql\\connect\\dataframe.py\", line 1119, in show"
   },
   {
    "id": "show-code",
    "bin": "skip",
    "text": "print(self._show_string(n, truncate, vertical))"
   },
   {
    "id": "rpc-frame",
    "bin": "skip",
    "text": "File \"…\\pyspark\\sql\\connect\\client\\core.py\", line 1882, in _handle_rpc_error"
   },
   {
    "id": "raise",
    "bin": "skip",
    "text": "raise convert_exception("
   },
   {
    "id": "message",
    "bin": "message",
    "text": "pyspark.errors.exceptions.connect.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocatonID` cannot be resolved. …"
   },
   {
    "id": "plan",
    "bin": "message",
    "text": "'Project ['PULocatonID]"
   },
   {
    "id": "jvm",
    "bin": "skip",
    "text": "JVM stacktrace:"
   },
   {
    "id": "java-at",
    "bin": "skip",
    "text": "at org.apache.spark.sql.catalyst.analysis.CheckAnalysis.$anonfun$checkAnalysis0$7(CheckAnalysis.scala:404)"
   }
  ];
  const RECEIPT_FULL_LINES = 96;

  // ==========================================================================================
  // MODULE spark-df-debugging (Sessions 3-4): imports, method chains, filters, functions, lazy
  // evaluation and reading errors. Every output a learner sees is either computed by the engine
  // above on taxi12 (checked against real Spark in examples.yaml, fn realMatch) or copied from REAL.
  // Conventions (SOURCE_NOTES.md): taxi12 read with header=True, inferSchema=True; trips are numbered
  // 1-12 in file order; Spark 4 with ANSI mode on; column names are matched without caring about case.
  // ==========================================================================================
  const T12_PATH = DF_VOLUME + '/lessons/taxi12.csv';
  const TRIPS = dfReadCsv(DF_TAXI12_CSV, { header: true, inferSchema: true, path: T12_PATH });
  const T12_LINES = DF_TAXI12_CSV.split('\n').filter((l) => l.length > 0); // header + 12 data lines
  const ALL_IDX = TRIPS.rows.map((r, i) => i);
  const SHOW_COLS = ['PULocationID', 'fare_amount', 'tip_amount', 'total_amount'];

  // ---- small helpers -------------------------------------------------------------------------
  const txt = (s) => dfToTextBlock(String(s));
  const realEntry = (k) => {
    const e = REAL[k];
    if (!e) throw new Error('REAL has no entry ' + k);
    return e;
  };
  const realText = (k) => {
    const e = realEntry(k);
    return e.err ? (e.out ? e.out : '') + e.err : e.out;
  };
  // The exception line of a trimmed traceback: the first line after the indented frame lines.
  function finalLine(err) {
    const ls = String(err).split('\n');
    let i = 1;
    while (i < ls.length && /^\s/.test(ls[i])) i++;
    return i < ls.length ? ls[i] : ls[ls.length - 1];
  }
  const shortClass = (line) => line.split(':')[0].split('.').pop();
  // Display only (REAL stays untouched): a trimmed traceback keeps the frame, `...`, the exception line and the
  // first plan line (blueprint §4); the later plan lines (`+- Relation [VendorID#276, ...] csv`) are dropped.
  function firstPlanOnly(err) {
    const ls = String(err).split('\n');
    const i = ls.indexOf(finalLine(err));
    return i >= 0 && i + 2 < ls.length ? ls.slice(0, i + 2).join('\n') : String(err);
  }
  const sub = (idx) => dfWithRows(TRIPS, TRIPS.columns, idx.map((i) => TRIPS.rows[i]));
  const showText = (t, o) => dfShowString(t, o).replace(/\n+$/, '');
  const tripNums = (idx) => idx.map((i) => String(i + 1));
  const lit = (v) => String(v); // a Python number literal as the learner would type it (11.5, 22, 0)
  const colOf = (t, name) => dfFindColumn(t.columns, name);
  const countBy = (t, key) => dfGroupCount(dfGroupBy(t, [key]));
  const sortCounts = (t, key) => dfOrderBy(countBy(t, key), [{ desc: 'count' }, key]);
  const codeSpan = (s) => (s.indexOf('`') >= 0 ? '`` ' + s + ' ``' : '`' + s + '`');
  const pyClass = (k) => DF_PY_TYPES[k];

  // ---- generic real cell ------------------------------------------------------------------
  // Any REAL entry as a notebook cell: the code, what it printed (```text block), and the error class.
  // plan: 1 = show only the first plan line under a Spark error (null = every plan line, as printed).
  function realCell({ key, plan = null }) {
    const e = realEntry(key);
    const fl = e.err ? finalLine(e.err) : null;
    const shown = e.err && plan === 1 ? (e.out || '') + firstPlanOnly(e.err) : realText(key);
    return {
      key, code: e.code, out: txt(shown), ok: !e.err, printed: e.out.replace(/\n+$/, ''),
      final: fl, ename: fl ? shortClass(fl) : null, codeLines: e.code.split('\n').length,
    };
  }

  // ---- the twelve trips as a table ----------------------------------------------------------
  // Matrix props (cells as show() prints them, row labels = trip numbers 1-12) and a Markdown table.
  function tripsView({ cols = SHOW_COLS, rows = null }) {
    const idx = rows || ALL_IDX;
    const t = sub(idx);
    const m = dfToMatrix(t, { cols, rowLabels: tripNums(idx), emptyLabel: 'NULL' }); // cells in show() text: 22.0 stays 22.0
    return { rows: m.rows, cols: m.cols, values: m.values, emptyLabel: m.emptyLabel, md: dfToMarkdownTable(t, { cols }), n: idx.length };
  }

  // The taxi12 dataset (datasets/taxi12.yaml) equals the engine's inferSchema read of the lesson CSV.
  function datasetCheck({ table }) {
    const same = JSON.stringify(table.columns) === JSON.stringify(dfColumns(TRIPS)) && JSON.stringify(table.rows) === JSON.stringify(TRIPS.rows);
    return { same, rows: table.rows.length, columns: table.columns.length, types: dfDtypes(TRIPS).map((d) => d[1]) };
  }

  // ---- imports: what each import style makes available (scene toolbox, section import-styles) ----
  const IMPORT_LINES = {
    none: '# (no import line yet)',
    one: 'from pyspark.sql.functions import desc',
    star: 'from pyspark.sql.functions import *',
    F: 'from pyspark.sql import functions as F',
  };
  const PROBES = [['round', 'round(4.567, 1)'], ['max', 'max(3, 7)'], ['sum', 'sum([1, 2, 3])'], ['desc', 'desc("count")'], ['Fdesc', 'F.desc("count")']];
  function importScope({ style = 'F' }) {
    if (!IMPORT_LINES[style]) throw new Error('importScope: unknown style ' + style);
    const rows = PROBES.map(([k, code]) => {
      const e = realEntry('m2x.imp.' + style + '.' + k);
      const ok = !e.err;
      return { name: k, code, ok, result: ok ? e.out.replace(/\n+$/, '') : finalLine(e.err) };
    });
    const md = '| You run | The notebook answers |\n| --- | --- |\n' +
      rows.map((r) => '| `' + r.code + '` | ' + (r.ok ? '`' + r.result + '`' : 'error: `' + r.result + '`') + ' |').join('\n');
    const okNames = rows.filter((r) => r.ok).map((r) => r.name);
    return {
      style, importLine: IMPORT_LINES[style], rows, md, okCount: okNames.length,
      roundWorks: okNames.indexOf('round') >= 0, descWorks: okNames.indexOf('desc') >= 0, fdescWorks: okNames.indexOf('Fdesc') >= 0,
      code: IMPORT_LINES[style] + '\n\n' + PROBES.map((p) => p[1]).join('\n'),
    };
  }

  // ---- the built-in clash (scene two-sums) --------------------------------------------------
  // star = true: after `from pyspark.sql.functions import *` (fresh kernel, truth m2.wildcard.*).
  function clashCell({ call = 'round', star = false }) {
    const key = (star ? 'm2.wildcard.' : 'm2.builtins.') + call;
    const e = realEntry(key);
    const fl = e.err ? finalLine(e.err) : null;
    // The real run used two cells (the traceback says <cell 2>, line 1), so the code marks where each cell starts.
    return {
      call, star, key, code: star ? '# cell 1\nfrom pyspark.sql.functions import *\n\n# cell 2\n' + e.code : e.code,
      out: txt(e.err || e.out), ok: !e.err, final: fl || e.out.trim(), ename: fl ? shortClass(fl) : null,
    };
  }

  // ---- the assembly line (scene assembly-line) ----------------------------------------------
  const STATIONS = [
    { code: 'trips', note: 'the twelve trips' },
    { code: '.select("PULocationID")', note: 'keep one column' },
    { code: '.groupBy("PULocationID")', note: 'sort the trips into one group per zone' },
    { code: '.count()', note: 'count the trips in each group' },
    { code: '.orderBy(F.desc("count"), "PULocationID")', note: 'biggest count first; ties by zone number' },
  ];
  function stationTable(upTo) {
    let t = TRIPS;
    if (upTo >= 1) t = dfSelect(t, ['PULocationID']);
    if (upTo === 2) return null; // GroupedData: not a table
    if (upTo >= 3) t = countBy(t, 'PULocationID');
    if (upTo >= 4) t = dfOrderBy(t, [{ desc: 'count' }, 'PULocationID']);
    return t;
  }
  // upTo 0-4: the chain cut after that station, then .show(); at station 2 (GroupedData, nothing to show) the
  // cell asks for the type instead, which is what the real output (m2.type_groupby) prints.
  function stationView({ upTo = 4 }) {
    const k = Math.max(0, Math.min(4, upTo));
    const lines = STATIONS.slice(0, k + 1).map((s) => '    ' + s.code);
    const code = k === 2 ? 'type(\n' + lines.join('\n') + '\n)' : '(\n' + lines.concat(['    .show()']).join('\n') + '\n)';
    const t = stationTable(k);
    return {
      upTo: k, code, note: STATIONS[k].note, station: STATIONS[k].code,
      grouped: t === null, type: t === null ? pyClass('GroupedData') : pyClass('DataFrame'),
      out: t === null ? txt(realText('m2.type_groupby')) : dfShowBlock(t),
      rows: t === null ? null : dfCount(t), cols: t === null ? null : dfColumns(t).length,
    };
  }

  // ---- count-along tally (scene assembly-line, StepPlayer) ----------------------------------
  function firstOrder(key) {
    const ki = colOf(TRIPS, key);
    const keys = [];
    for (const r of TRIPS.rows) if (keys.indexOf(r[ki]) < 0) keys.push(r[ki]);
    return keys;
  }
  // Worksheet: one row per zone (in the order the trips first meet them), the trip numbers and the
  // running count after the first `upTo` trips. Unreached cells are null (blank).
  function tallySheet({ upTo = 0, key = 'PULocationID' }) {
    const ki = colOf(TRIPS, key);
    const keys = firstOrder(key);
    const seen = {};
    TRIPS.rows.slice(0, Math.max(0, upTo)).forEach((r, i) => { (seen[r[ki]] = seen[r[ki]] || []).push(i + 1); });
    const values = keys.map((k) => (seen[k] ? ['\\text{' + seen[k].join(', ') + '}', seen[k].length] : [null, null]));
    return { rows: keys.map(String), cols: ['trips', 'count'], values, emptyLabel: '', upTo, counted: Math.min(upTo, TRIPS.rows.length) };
  }
  // roles: trips (Matrix of taxi12, row labels 1-12), tally (Matrix from tallySheet). Patches tallyUpTo.
  function tallyWalk({ key = 'PULocationID' }) {
    const ki = colOf(TRIPS, key);
    const tally = {};
    const trace = [{ label: 'An empty tally: no trip counted yet.', patch: { tallyUpTo: 0 }, ops: [{ role: 'trips', cmd: 'clear' }, { role: 'tally', cmd: 'clear' }] }];
    TRIPS.rows.forEach((r, i) => {
      const z = r[ki];
      tally[z] = (tally[z] || 0) + 1;
      trace.push({
        label: 'Trip ' + (i + 1) + ' starts in zone ' + z + ': zone ' + z + ' now has $' + tally[z] + '$ trip' + (tally[z] > 1 ? 's.' : '.'),
        vars: { trip: i + 1, zone: z, count: tally[z] },
        patch: { tallyUpTo: i + 1 },
        ops: [{ role: 'trips', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: 'accent' } }, { role: 'tally', cmd: 'highlight', args: { sel: 'row:' + z, tone: 'accent' } }],
      });
    });
    const sorted = dfCollect(sortCounts(TRIPS, key));
    const top = sorted[0];
    const tied = sorted.filter((o) => o.count === 2).map((o) => o[key]);
    trace.push({
      label: 'All 12 trips counted. The biggest count: zone ' + top[key] + ' with $' + top.count + '$ trips.',
      patch: { tallyUpTo: TRIPS.rows.length },
      ops: [{ role: 'tally', cmd: 'highlight', args: { sel: 'row:' + top[key], tone: 'good' } }],
    });
    trace.push({
      label: 'Zones ' + tied.join(', ') + ' tie at $2$. The count alone cannot decide which of them comes first.',
      patch: { tallyUpTo: TRIPS.rows.length },
      ops: [{ role: 'tally', cmd: 'highlight', args: { sel: tied.map((z) => 'row:' + z), tone: 'warn' } }],
    });
    return { trace, steps: trace.length, top: top[key], topCount: top.count, tied, order: sorted.map((o) => o[key]) };
  }

  // ---- sorting the counts (scene assembly-line) ---------------------------------------------
  const SORTS = {
    none: { code: 'trips.groupBy("PULocationID").count().show()', key: 'm2.groupby_count', fixed: false },
    desc: { code: 'trips.groupBy("PULocationID").count().orderBy(F.desc("count")).show()', key: 'm2.groupby_count_desc', fixed: false },
    descTie: { code: 'trips.groupBy("PULocationID").count().orderBy(F.desc("count"), "PULocationID").show()', key: 'm2.groupby_count_desc_tiebreak', fixed: true },
  };
  function sortView({ order = 'descTie' }) {
    const s = SORTS[order];
    if (!s) throw new Error('sortView: unknown order ' + order);
    const e = realEntry(s.key);
    const firstZone = Number(e.out.split('\n')[3].split('|')[1].trim());
    const printedRows = e.out.split('\n').filter((l) => /^\|\s*\d/.test(l)).map((l) => l.split('|').slice(1, 3).map((x) => Number(x.trim())));
    const zones = printedRows.map((r) => r[0]);
    const tied = printedRows.filter((r) => r[1] === 2).map((r) => r[0]); // the zones with 2 trips, in printed order
    return { order, code: e.code, out: txt(e.out), fixed: s.fixed, firstZone, zones, tied };
  }

  // ---- filter conditions (scene filter-conditions, section filter-rows) ---------------------
  const CONDS = {
    fare10: { cond: 'F.col("fare_amount") > 10', pred: { col: 'fare_amount', op: '>', value: 10 }, show: 'm2.filter_gt10_show' },
    fareTip: { cond: '(F.col("fare_amount") > 10) & (F.col("tip_amount") > 0)', pred: { and: [{ col: 'fare_amount', op: '>', value: 10 }, { col: 'tip_amount', op: '>', value: 0 }] }, show: 'm2.filter_and' },
    zone7or33: { cond: '(F.col("PULocationID") == 7) | (F.col("PULocationID") == 33)', pred: { or: [{ col: 'PULocationID', op: '==', value: 7 }, { col: 'PULocationID', op: '==', value: 33 }] }, show: 'm2.filter_or' },
    notN: { cond: '~(F.col("store_and_fwd_flag") == "N")', pred: { not: { col: 'store_and_fwd_flag', op: '==', value: 'N' } }, show: null },
    total30: { cond: '"total_amount > 30"', pred: 'total_amount > 30', show: 'm2.filter_sql_string_show' },
    pyAnd: { cond: '(F.col("fare_amount") > 10) and (F.col("tip_amount") > 0)', error: 'm2.filter_python_and' },
    strGt: { cond: '"total_amount" > 1000', error: 'm2.filter_str_gt' },
  };
  const FILTER_COLS = SHOW_COLS.concat(['store_and_fwd_flag']);
  // One condition: which trips it keeps (a check column), the count, and the real output or error.
  function filterView({ cond = 'fare10' }) {
    const c = CONDS[cond];
    if (!c) throw new Error('filterView: unknown condition ' + cond);
    const base = tripsView({ cols: FILTER_COLS }); // the flag column too, so the ~ (not) condition can be checked by eye
    if (c.error) {
      const e = realEntry(c.error);
      return {
        cond, code: e.code, error: true, count: null, kept: [], dropped: [], final: finalLine(e.err), ename: shortClass(finalLine(e.err)),
        out: txt(e.err), rows: base.rows, cols: base.cols.concat(['kept']), values: base.values.map((v) => v.concat([null])), emptyLabel: '?',
      };
    }
    const keep = ALL_IDX.filter((i) => dfCount(dfFilter(sub([i]), c.pred)) === 1);
    const t = dfFilter(TRIPS, c.pred);
    return {
      cond, code: 'trips.filter(' + c.cond + ').show()', error: false, count: dfCount(t), final: null, ename: null,
      kept: keep.map((i) => i + 1), dropped: ALL_IDX.filter((i) => keep.indexOf(i) < 0).map((i) => i + 1),
      hl: keep.map((i) => 'row:' + (i + 1)),
      out: c.show ? txt(realEntry(c.show).out) : dfShowBlock(t),
      rows: base.rows, cols: base.cols.concat(['kept']),
      values: base.values.map((v, i) => v.concat([keep.indexOf(i) >= 0 ? '\\checkmark' : '\\cdot'])), emptyLabel: '',
    };
  }
  // Math & Code trace (section filter-rows): every trip, both tests, the running count.
  // roles: trips (live Matrix, row labels 1-12). anchors: fare, tip, count
  function filterCode({ x = 10, y = 0 }) {
    const fi = colOf(TRIPS, 'fare_amount');
    const ti = colOf(TRIPS, 'tip_amount');
    let kept = 0;
    const trace = [];
    TRIPS.rows.forEach((r, i) => {
      const n = i + 1;
      const a = r[fi] > x;
      const b = r[ti] > y;
      const ops0 = i === 0 ? [{ role: 'trips', cmd: 'clear' }] : [];
      trace.push({
        label: 'Trip ' + n + ': fare $' + dfJavaDouble(r[fi]) + ' > ' + x + '$ is ' + (a ? 'true' : 'false') + '.',
        code: 'fare', math: 'fare', vars: { trip: n, fare_amount: r[fi], fare_test: a },
        ops: ops0.concat([{ role: 'trips', cmd: 'highlight', args: { sel: 'cell:' + n + ',fare_amount', tone: a ? 'good' : 'bad' } }]),
      });
      if (a && b) kept++;
      trace.push({
        label: 'Tip $' + dfJavaDouble(r[ti]) + ' > ' + y + '$ is ' + (b ? 'true' : 'false') +
          (a && b ? ': both true, keep it.' : !a && b ? ', but the fare test failed, so `&` drops it.' : ': drop it.') + ' Kept: $' + kept + '$.',
        code: 'tip', math: 'tip', vars: { trip: n, tip_amount: r[ti], tip_test: b, kept },
        ops: [{ role: 'trips', cmd: 'highlight', args: { sel: 'cell:' + n + ',tip_amount', tone: b ? 'good' : 'bad' } },
          { role: 'trips', cmd: 'annotate', args: { sel: 'row:' + n, text: a && b ? 'kept' : 'dropped' } }],
      });
    });
    const keptRows = ALL_IDX.filter((i) => TRIPS.rows[i][fi] > x && TRIPS.rows[i][ti] > y).map((i) => 'row:' + (i + 1));
    trace.push({ label: '`count()` is the action: $' + kept + '$ trips pass both tests.', code: 'count', math: 'count', vars: { count: kept },
      ops: [keptRows.length
        ? { role: 'trips', cmd: 'highlight', args: { sel: keptRows, tone: 'good' } }
        : { role: 'trips', cmd: 'highlight', args: { sel: 'col:fare_amount', tone: 'muted' } }] });
    return { trace, count: kept, x, y };
  }

  // ---- reading a chain one station at a time (scene read-a-chain) ----------------------------
  const CHAIN5 = ['m2.chain5.step1', 'm2.chain5.step2', 'm2.chain5.step3', 'm2.chain5.step4', 'm2.chain5.step5'];
  function chain5Table(k) {
    let t = dfFilter(TRIPS, { col: 'tip_amount', op: '>', value: 0 });
    if (k >= 2) t = dfSelect(t, ['PULocationID', 'tip_amount']);
    if (k === 3) return null;
    if (k >= 4) t = countBy(t, 'PULocationID');
    if (k >= 5) t = dfOrderBy(t, [{ desc: 'count' }, 'PULocationID']);
    return t;
  }
  // k = 1-5: the real cell that runs the chain up to station k, then .show().
  function chainPrefix({ k = 5 }) {
    const kk = Math.max(1, Math.min(5, k));
    const e = realEntry(CHAIN5[kk - 1]);
    const t = chain5Table(kk);
    return {
      k: kk, code: e.code, error: !!e.err, out: txt(e.err || e.out),
      type: t === null ? pyClass('GroupedData') : pyClass('DataFrame'),
      rows: t === null ? null : dfCount(t), final: e.err ? finalLine(e.err) : null,
    };
  }

  // ---- the Session 3 "Frequent items" chain: freqItems -> explode -> drop (section chain-steps) ----
  // anchors: freq, explode, drop, show. roles: trips (live Matrix of the PULocationID column)
  function freqChainCode({ support = 0.3 }) {
    const s1 = dfFreqItems(TRIPS, ['PULocationID'], support);
    const s2 = dfWithColumn(s1, 'freq_items', { explode: 'PULocationID_freqItems' });
    const s3 = dfDrop(s2, ['PULocationID_freqItems']);
    const items = s1.rows[0][0];
    const pi = colOf(TRIPS, 'PULocationID');
    const hits = ALL_IDX.filter((i) => items.indexOf(TRIPS.rows[i][pi]) >= 0).map((i) => 'row:' + (i + 1));
    const list = '[' + items.join(', ') + ']';
    const n = TRIPS.rows.length;
    const counts = {};
    dfCollect(countBy(TRIPS, 'PULocationID')).forEach((o) => { counts[o.PULocationID] = o.count; });
    const sure = items.filter((z) => counts[z] / n >= support);
    const extra = items.filter((z) => counts[z] / n < support);
    const firstRow = (z) => 'row:' + (TRIPS.rows.findIndex((r) => r[pi] === z) + 1);
    const pct = Math.round(support * 100) + '%';
    const frac = (z) => '$' + counts[z] + '/' + n + ' = ' + dfPyFixed(counts[z] / n, 2) + '$';
    const supportLabel = extra.length
      ? 'Only zone ' + sure.join(', ') + ' truly reaches ' + pct + ': ' + frac(sure[0]) + '. Zones ' + extra.join(' and ') + ', at ' + frac(extra[0]) + ', are approximate extras.'
      : 'Every listed zone reaches ' + pct + ', for example zone ' + items[0] + ': ' + frac(items[0]) + '.';
    const fr = (i, c, v) => ({ role: 'freq', cmd: 'fill', args: { cell: (i + 1) + ',' + c, value: v } });
    const trace = [
      { label: '`freqItems` returns one row holding one list: `' + list + '`.', code: 'freq', math: 'freq', vars: { freqItems: list, rows: dfCount(s1) },
        ops: [{ role: 'trips', cmd: 'clear' }, { role: 'freq', cmd: 'clear' }, { role: 'trips', cmd: 'highlight', args: { sel: hits, tone: 'accent' } }] },
      { label: supportLabel, code: 'freq', math: 'freq', vars: { support },
        ops: items.map((z) => ({ role: 'trips', cmd: 'annotate', args: { sel: firstRow(z), text: 'zone ' + z + ': ' + counts[z] + ' of ' + n } })) },
      { label: '`explode` gives each list item its own row: $' + dfCount(s2) + '$ rows.', code: 'explode', math: 'explode', vars: { rows: dfCount(s2), columns: dfColumns(s2).length },
        ops: items.flatMap((z, i) => [fr(i, 'PULocationID_freqItems', dfTexText(list)), fr(i, 'freq_items', z)]) },
      { label: '`drop` removes the list column. One column is left: `freq_items`.', code: 'drop', math: 'drop', vars: { columns: dfColumns(s3).join(', ') },
        ops: [{ role: 'freq', cmd: 'mask', args: { sel: 'col:freq_items' } }] },
      { label: '`show()` is the only action: Spark runs all three stations now.', code: 'show', math: 'show', vars: { printed: items.join(', ') },
        ops: [{ role: 'freq', cmd: 'highlight', args: { sel: 'col:freq_items', tone: 'good' } }] },
    ];
    return {
      trace, items, sure, extra, rows: dfCount(s3), step1: dfShowBlock(s1, { truncate: false }), step2: dfShowBlock(s2), step3: dfShowBlock(s3),
      empty: { rows: items.map((z, i) => String(i + 1)), cols: ['PULocationID_freqItems', 'freq_items'], values: items.map(() => [null, null]), emptyLabel: '' },
    };
  }

  // ---- group, count, sort (section group-count-order) ---------------------------------------
  // anchors: group, count, order, show. roles: trips (live Matrix), tally (live Matrix from groupCountCode().empty)
  // n: the number passed to show(n) (the notebook's tie-break cell uses show(5)); null = show() with every row.
  function groupCountCode({ key = 'PULocationID', n = null }) {
    const ki = colOf(TRIPS, key);
    const keys = firstOrder(key);
    const tally = {};
    const trace = [{ label: '`groupBy` sorts the 12 trips into one group per zone: $' + keys.length + '$ groups.', code: 'group', math: 'group',
      vars: { groups: keys.length }, ops: [{ role: 'trips', cmd: 'clear' }, { role: 'tally', cmd: 'clear' }, { role: 'trips', cmd: 'highlight', args: { sel: 'col:' + key, tone: 'accent' } }] }];
    TRIPS.rows.forEach((r, i) => {
      const z = r[ki];
      tally[z] = (tally[z] || 0) + 1;
      trace.push({
        label: 'Trip ' + (i + 1) + ': zone ' + z + ', count now $' + tally[z] + '$.', code: 'count', math: 'count',
        vars: { trip: i + 1, zone: z, count: tally[z] },
        ops: [{ role: 'trips', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: 'accent' } },
          { role: 'tally', cmd: 'fill', args: { cell: z + ',count', value: tally[z] } }],
      });
    });
    const sorted = dfCollect(sortCounts(TRIPS, key));
    trace.push({ label: 'Sort by `count`, biggest first, then by zone number: ' + sorted.map((o) => o[key]).join(', ') + '.', code: 'order', math: 'order',
      vars: { first: sorted[0][key], order: sorted.map((o) => o[key]).join(', ') },
      ops: sorted.map((o, j) => ({ role: 'tally', cmd: 'annotate', args: { sel: 'row:' + o[key], text: '#' + (j + 1) } })) });
    const shown = n == null ? sorted.length : Math.min(n, sorted.length);
    trace.push({
      label: n == null
        ? '`show()` is the action: Spark runs the whole chain and prints $' + sorted.length + '$ rows.'
        : '`show(' + n + ')` is the action: Spark runs the chain and prints the first $' + shown + '$ of $' + sorted.length + '$ rows.',
      code: 'show', math: 'show', vars: { rows: sorted.length, shown },
      ops: [{ role: 'tally', cmd: 'highlight', args: { sel: sorted.slice(0, shown).map((o) => 'row:' + o[key]), tone: 'good' } }],
    });
    return {
      trace, groups: keys.length, top: sorted[0][key], topCount: sorted[0].count, shown,
      empty: { rows: keys.map(String), cols: ['count'], values: keys.map(() => [null]), emptyLabel: '' },
      out: dfShowBlock(sortCounts(TRIPS, key), n == null ? {} : { n }),
    };
  }
  // count(z) as a sum of 0/1 terms over the twelve trips: "0 + 0 + 1 + 1 + ... = 4".
  function zoneCount({ zone = 7, key = 'PULocationID' }) {
    const ki = colOf(TRIPS, key);
    const bits = TRIPS.rows.map((r) => (r[ki] === zone ? 1 : 0));
    const count = bits.reduce((s, b) => s + b, 0);
    return { zone, bits, count, terms: bits.join(' + '), trips: bits.map((b, i) => (b ? i + 1 : null)).filter((x) => x !== null) };
  }

  // ---- wrapping a chain in a function (scene wrap-in-function, section function-wrap) -------
  function wrapCell({ withReturn = true }) {
    return realCell({ key: withReturn ? 'm2.def_with_return' : 'm2.def_no_return' });
  }
  // anchors: def, call, ret (the call line also holds .show(n)).
  // roles: trips (live Matrix, PULocationID), result (live Matrix of the returned table, from functionCode().result)
  function functionCode({ n = 5 }) {
    const res = sortCounts(TRIPS, 'PULocationID');
    const rows = dfCollect(res);
    const first = rows[0];
    const shown = Math.min(n, rows.length);
    const resRow = (i) => 'row:' + (i + 1);
    const trace = [
      { label: '`def` stores the function under the name `top_pickups`. Nothing runs yet.', code: 'def', math: 'def', vars: { top_pickups: 'function' },
        ops: [{ role: 'trips', cmd: 'clear' }, { role: 'result', cmd: 'clear' }] },
      { label: '`top_pickups(trips)` runs the body with `df` standing for `trips`: all $' + TRIPS.rows.length + '$ trips go in.', code: 'call', math: 'call', vars: { df: 'trips (12 rows)' },
        ops: [{ role: 'trips', cmd: 'highlight', args: { sel: 'col:PULocationID', tone: 'accent' } }] },
      { label: 'The chain builds the sorted count table; `return` hands it back: $' + rows.length + '$ rows.', code: 'ret', math: 'ret', vars: { returned: 'DataFrame', rows: rows.length },
        ops: [{ role: 'result', cmd: 'highlight', args: { sel: rows.map((o, i) => resRow(i)), tone: 'accent' } }] },
      { label: '`.show(' + n + ')` prints the first $' + shown + '$ rows: zone ' + first.PULocationID + ' leads with $' + first.count + '$ trips.', code: 'call', math: 'call', vars: { shown },
        ops: [{ role: 'result', cmd: 'highlight', args: { sel: rows.slice(0, shown).map((o, i) => resRow(i)), tone: 'good' } }]
          .concat(rows.slice(shown).map((o, j) => ({ role: 'result', cmd: 'annotate', args: { sel: resRow(shown + j), text: 'not shown' } }))) },
    ];
    const m = dfToMatrix(res, { numbers: 'raw', rowLabels: 'one' });
    return { trace, rows: rows.length, shown, out: dfShowBlock(res, { n }), result: { rows: m.rows, cols: m.cols, values: m.values } };
  }

  // ---- lazy evaluation: the shopping list (scene shopping-list, section lazy-plan) -----------
  const LAZY_STEPS = [
    { code: 'trips = spark.read.csv(f"{BASE}/lessons/taxi12.csv", header=True, inferSchema=True)', item: 'Read `taxi12.csv` (first line = names, guess the types).' },
    { code: 'pu = trips.select("{NAME}")', item: 'Keep only the column `{NAME}`.' },
    { code: 'type(pu)', item: null },
    { code: 'pu.show()', item: null },
  ];
  // The plan so far in plain words, and what each cell printed, after the first `upTo` cells.
  function planView({ upTo = 0, typo = true }) {
    const name = typo ? 'PULocatonID' : 'PULocationID';
    const k = Math.max(0, Math.min(4, upTo));
    const items = LAZY_STEPS.slice(0, k).filter((s) => s.item).map((s, i) => (i + 1) + '. ' + s.item.replace('{NAME}', name));
    const outs = [];
    if (k >= 3) outs.push(realEntry(typo ? 'm2.lazy.select_typo' : 'm2.lazy.select_PULocationId').out.replace(/\n+$/, ''));
    let status = k < 4 ? 'waiting' : typo ? 'error' : 'done';
    if (k >= 4) outs.push(typo ? firstPlanOnly(realEntry('m2.lazy.select_typo.show').err) : showText(dfSelect(TRIPS, ['PULocationID'])));
    return {
      upTo: k, typo, status, checked: k >= 4,
      list: items.length ? items.join('\n') : 'Nothing on the list yet.',
      code: LAZY_STEPS.slice(0, Math.max(1, k)).map((s) => s.code.replace('{NAME}', name)).join('\n'),
      out: outs.length ? txt(outs.join('\n\n')) : txt('(no output)'),
    };
  }
  // roles: cells (Code widget, one line per cell). Patches planUpTo.
  function lazyWalk({ typo = true }) {
    const trace = [{ label: 'An empty shopping list: nothing has run.', patch: { planUpTo: 0 }, ops: [{ role: 'cells', cmd: 'clear' }] }];
    const labels = [
      'Reading the file only writes step 1 on the list.',
      typo ? 'A misspelled name goes on the list too. No error yet.' : 'Keeping one column goes on the list. Still nothing runs.',
      '`type(pu)` says DataFrame: the list is still waiting.',
      typo ? '`show()` is an action. Spark checks every name now and stops at `PULocatonID`.' : '`show()` is an action. Spark checks the names, runs the list and prints 12 rows.',
    ];
    labels.forEach((label, i) => trace.push({ label, patch: { planUpTo: i + 1 }, ops: [{ role: 'cells', cmd: 'highlight', args: { sel: 'line:' + (i + 1), tone: i === 3 && typo ? 'bad' : 'accent' } }] }));
    return { trace, steps: trace.length, errorAt: typo ? 4 : null };
  }
  // anchors: read, plan, explain, select, type, action (section lazy-plan; Session 4 "Transformations, actions and the plan" and "a typo that waits")
  // roles: vars (live Matrix from lazyCode().empty: each variable, the plan it holds, and what checking found)
  function lazyCode({ typo = true }) {
    const name = typo ? 'PULocatonID' : 'PULocationID';
    const r = dfTry(() => dfSelect(TRIPS, [name]));
    const fill = (row, col, text) => ({ role: 'vars', cmd: 'fill', args: { cell: row + ',' + col, value: dfTexText(text) } });
    const hl = (row, tone) => ({ role: 'vars', cmd: 'highlight', args: { sel: 'row:' + row, tone: tone || 'accent' } });
    const nRows = dfCount(TRIPS);
    const explainFirst = realEntry('m2x.lazy.explain_cell98').out.split('\n')[0];
    const trace = [
      { label: 'Step 1 on the list: read the file. `trips` holds a plan.', code: 'read', math: 'read', vars: { trips: 'DataFrame' },
        ops: [{ role: 'vars', cmd: 'clear' }, fill('trips', 'plan', 'read taxi12.csv'), hl('trips')] },
      { label: '`trips2` adds three steps: group by zone, count, sort. Nothing is counted yet.', code: 'plan', math: 'plan', vars: { trips2: 'DataFrame' },
        ops: [fill('trips2', 'plan', 'read, group, count, sort'), hl('trips2')] },
      { label: '`explain()` prints that plan, from the bottom up. It still counts nothing.', code: 'explain', math: 'explain', vars: { printed: explainFirst },
        ops: [hl('trips2')] },
      { label: 'Another step goes on a list: keep `' + name + '`. Nothing is checked yet.', code: 'select', math: 'select', vars: { pu: 'DataFrame' },
        ops: [fill('pu', 'plan', 'read, keep ' + name), hl('pu')] },
      { label: '`type(pu)` is still DataFrame: a plan, not data.', code: 'type', math: 'type', vars: { type: pyClass('DataFrame') },
        ops: [hl('pu')] },
      r.ok
        ? { label: '`show()` sends the plan. Every name exists, so Spark prints $' + nRows + '$ rows.', code: 'action', math: 'action', vars: { rows: nRows },
          ops: [fill('pu', 'checked', 'all names found'), hl('pu', 'good')] }
        : { label: '`show()` sends the plan. Spark finds no `' + name + '` and raises AnalysisException.', code: 'action', math: 'action',
          vars: { error: 'AnalysisException', suggestion: r.error.suggestions[0] },
          ops: [fill('pu', 'checked', 'AnalysisException'), hl('pu', 'bad')] },
    ];
    return {
      trace, ok: r.ok, suggestion: r.ok ? null : r.error.suggestions[0],
      empty: { rows: ['trips', 'trips2', 'pu'], cols: ['plan', 'checked'], values: [[null, null], [null, null], [null, null]], emptyLabel: '' },
    };
  }

  // Where does a wrong column name raise? (verified on Spark 4.0.1 Connect, SOURCE_NOTES "Conventions").
  // steps: [{ op, typo }] with op in read | select | filter | orderBy | withColumn | agg | groupBy | getitem | attr | show | count.
  // Rules: select/filter/orderBy/withColumn/agg with a wrong name only write it into the plan; groupBy("name"),
  // df["name"] and df.name check the name on that very line; an action raises if the plan holds a wrong name.
  // (groupBy/getitem on a table whose plan already holds a wrong name is not modelled: callers avoid it.)
  function failLine({ steps }) {
    let broken = false;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (['groupBy', 'getitem', 'attr'].indexOf(s.op) >= 0) {
        if (s.typo) return { line: i + 1, why: 'that command looks the name up on its own line' };
        if (broken) throw new Error('failLine: groupBy/getitem after a broken plan is not modelled');
      } else if (['select', 'filter', 'orderBy', 'withColumn', 'agg'].indexOf(s.op) >= 0) {
        if (s.typo) broken = true;
      } else if (['show', 'count', 'collect', 'toPandas', 'columns'].indexOf(s.op) >= 0) {
        if (broken) return { line: i + 1, why: 'the action sends the plan and Spark checks every name' };
      }
    }
    return { line: null, why: 'no error' };
  }

  // ---- reading the receipt (scene read-the-receipt) -----------------------------------------
  function receipt() {
    const solution = {};
    RECEIPT.forEach((c) => { solution[c.id] = c.bin; });
    return {
      chips: RECEIPT.map((c) => ({ id: c.id, label: codeSpan(c.text) })),
      bins: [{ id: 'mine', label: 'Your code' }, { id: 'message', label: 'The message' }, { id: 'skip', label: 'Skip it' }],
      solution, trimmed: txt(firstPlanOnly(realEntry('m2.lazy.select_typo.show').err)), fullLines: RECEIPT_FULL_LINES,
    };
  }
  // The parts of a real trimmed traceback: frames in your cells, the exception line and its pieces.
  function tracebackParts({ key }) {
    const err = realEntry(key).err;
    if (!err) throw new Error('tracebackParts: ' + key + ' has no error');
    const ls = err.split('\n');
    const frames = [];
    ls.forEach((l, i) => {
      const m = /^ {2}File "<cell (\d+)>", line (\d+), in (.+)$/.exec(l);
      if (m) frames.push({ cell: +m[1], line: +m[2], scope: m[3], code: (ls[i + 1] || '').trim() });
    });
    const fl = finalLine(err);
    const ec = /\[([A-Z_.]+)\]/.exec(fl);
    const sug = /Did you mean one of the following\? \[([^\]]*)\]/.exec(fl);
    const planStart = ls.indexOf(fl) + 1;
    return {
      key, frames, frame: frames.length ? frames[frames.length - 1] : null, final: fl, cls: shortClass(fl),
      errorClass: ec ? ec[1] : null, suggestions: sug ? sug[1].split(', ').map((s) => s.replace(/`/g, '')) : [],
      planFirst: planStart > 0 && planStart < ls.length ? ls[planStart] : null, lines: ls.length,
    };
  }

  // ---- the four common errors (scene error-zoo) -------------------------------------------
  const ZOO = {
    analysis: { key: 'm2.lazy.select_typo.show', check: 'trips.columns', checkOut: () => dfColumnsRepr(TRIPS) },
    name: { key: 'm2.desc_without_import', check: 'from pyspark.sql import functions as F\n\ntrips.groupBy("PULocationID").count().orderBy(F.desc("count")).show()', checkOut: () => realEntry('m2.groupby_count_desc').out },
    type: { key: 'm2.filter_str_gt', check: 'type("total_amount")', checkOut: () => pyClass('str') },
    silent: { key: 'm1.ddl_int.show', check: 'trips.printSchema()', checkOut: () => realEntry('m1.ddl_int.printSchema').out },
  };
  function errorZoo({ kind = 'analysis' }) {
    const z = ZOO[kind];
    if (!z) throw new Error('errorZoo: unknown kind ' + kind);
    const e = realEntry(z.key);
    return {
      kind, code: e.code, out: txt(e.err ? firstPlanOnly(e.err) : e.out), silent: !e.err, final: e.err ? finalLine(e.err) : null,
      ename: e.err ? shortClass(finalLine(e.err)) : null, check: z.check, checkOut: txt(z.checkOut()),
    };
  }

  // ---- finding help (scene ask-for-help) ---------------------------------------------------
  const HELP = {
    dirHour: 'm2.dir_F_hour', dirTrunc: 'm2x.lazy.dir_trunc', helpDateTrunc: 'm2.help_date_trunc', dateTrunc: 'm2.date_trunc_alias_show',
    helpFilter: 'm2.help_filter', sqlFilter: 'm2.filter_sql_string', whereAlias: 'm2.where_alias', whereSql: 'm2x.lazy.where_sql_30',
  };
  function helpView({ topic = 'dirHour' }) {
    const k = HELP[topic];
    if (!k) throw new Error('helpView: unknown topic ' + topic);
    const e = realEntry(k);
    const printed = e.out.replace(/\n+$/, '');
    const sig = printed.split('\n').find((l) => /^[a-z_]+\(/.test(l)) || null; // the manual's signature line
    return { topic, key: k, code: e.code, out: txt(e.out), printed, sig };
  }
  // date_trunc on the pickup times, computed by the engine (unit hour = truth m2.date_trunc_alias_show).
  function dateTruncView({ unit = 'hour' }) {
    const alias = 'pickup_' + unit;
    const t = dfSelect(TRIPS, ['lpep_pickup_datetime', { dateTrunc: unit, col: 'lpep_pickup_datetime', alias }]);
    return {
      unit, code: 'trips.select(\n    "lpep_pickup_datetime",\n    F.date_trunc("' + unit + '", "lpep_pickup_datetime").alias("' + alias + '"),\n).show()',
      out: dfShowBlock(t), first: t.rows[0][1],
    };
  }

  // ---- debugging recipe (section debug-recipe) -------------------------------------------
  // trips.dtypes as Matrix props: one row per column name, its type in show() words.
  function dtypesView() {
    const d = dfDtypes(TRIPS);
    return { rows: d.map((x) => x[0]), cols: ['type'], values: d.map((x) => [dfTexText(x[1])]), repr: txt(dfDtypesRepr(TRIPS)) };
  }
  // anchors: broken, inspect, fix, sql (section debug-recipe; Session 4 "a TypeError" and "other ways to filter")
  // roles: types (live Matrix from dtypesView), trips (live Matrix of total_amount, row labels 1-12)
  function debugCode() {
    const err = realEntry('m2.filter_str_gt').err;
    const pred = { col: 'total_amount', op: '>', value: 1000 };
    const fixed = dfCount(dfFilter(TRIPS, pred));
    const sqlCount = dfCount(dfFilter(TRIPS, 'total_amount > 1000'));
    const full = Number(realEntry('full.csv_infer.total_gt_1000').out.trim());
    const ti = colOf(TRIPS, 'total_amount');
    let top = 0;
    TRIPS.rows.forEach((r, i) => { if (r[ti] > TRIPS.rows[top][ti]) top = i; });
    const topText = dfFormatValue(TRIPS.rows[top][ti], TRIPS.columns[ti].type, true);
    const trace = [
      { label: 'Run the cell. Python stops with a TypeError before Spark sees anything.', code: 'broken', math: 'broken', vars: { error: 'TypeError' },
        ops: [{ role: 'types', cmd: 'clear' }, { role: 'trips', cmd: 'clear' }] },
      { label: 'Read the last line first: `>` cannot compare a str with an int.', code: 'broken', math: 'broken', vars: { last_line: finalLine(err) },
        ops: [{ role: 'types', cmd: 'highlight', args: { sel: 'row:total_amount', tone: 'warn' } }] },
      { label: 'Inspect the suspect: `type("total_amount")` is str, plain text, not the column.', code: 'inspect', math: 'inspect', vars: { type: pyClass('str') },
        ops: [{ role: 'types', cmd: 'annotate', args: { sel: 'row:total_amount', text: 'the column is a number' } }] },
      { label: 'Fix: compare the column. The largest of the twelve totals is $' + topText + '$, so the count is $' + fixed + '$.', code: 'fix', math: 'fix', vars: { count: fixed },
        ops: [{ role: 'trips', cmd: 'highlight', args: { sel: 'col:total_amount', tone: 'accent' } }, { role: 'trips', cmd: 'annotate', args: { sel: 'row:' + (top + 1), text: 'largest' } }] },
      { label: 'On the full quarter the same line returns $' + full + '$ trips.', code: 'fix', math: 'fix', vars: { full_data_count: full },
        ops: [{ role: 'trips', cmd: 'highlight', args: { sel: 'col:total_amount', tone: 'muted' } }] },
      { label: 'The manual\'s other forms: a SQL string, and its twin `where`. Same count: $' + sqlCount + '$.', code: 'sql', math: 'sql', vars: { count: sqlCount },
        ops: [{ role: 'trips', cmd: 'highlight', args: { sel: 'col:total_amount', tone: 'accent' } }] },
    ];
    return { trace, fixed, sqlCount, full };
  }

  // ---- filter count-along (scene filter-conditions) -----------------------------------------
  const OP_TEX = { '>': '>', '>=': '\\ge', '<': '<', '<=': '\\le', '==': '=' };
  // One simple test { col, op, value } on one row: true/false and the arithmetic as TeX ("$11.5 > 10$").
  function atomTest(p, row) {
    const ci = colOf(TRIPS, p.col);
    const ok = dfCount(dfFilter(dfWithRows(TRIPS, TRIPS.columns, [row]), p)) === 1;
    return { ok, col: TRIPS.columns[ci].name, tex: '$' + dfFormatValue(row[ci], TRIPS.columns[ci].type, true) + ' ' + OP_TEX[p.op] + ' ' + p.value + '$' };
  }
  const walkable = (c) => c && !c.error && typeof c.pred === 'object' && !c.pred.not;
  // Worksheet: the twelve trips with the `kept` column filled (tick or dot) for the first `upTo` trips only.
  function filterSheet({ cond = 'fare10', upTo = 12 }) {
    const fv = filterView({ cond });
    const k = Math.max(0, Math.min(TRIPS.rows.length, upTo));
    const values = fv.error ? fv.values : fv.values.map((v, i) => (i < k ? v : v.slice(0, -1).concat([null])));
    const ticks = fv.error ? 0 : fv.kept.filter((n) => n <= k).length;
    return { rows: fv.rows, cols: fv.cols, values, emptyLabel: fv.error ? '?' : '', upTo: k, ticks, count: fv.count };
  }
  // roles: trips (Matrix from filterSheet, row labels 1-12). Patches fUpTo.
  function filterWalk({ cond = 'fare10' }) {
    const c = CONDS[cond];
    if (!walkable(c)) throw new Error('filterWalk: cannot walk ' + cond);
    const atoms = c.pred.and || c.pred.or || [c.pred];
    const any = !!c.pred.or;
    const trace = [{ label: 'No trip tested yet. A tick will mean "keep this row".', patch: { fUpTo: 0 }, ops: [{ role: 'trips', cmd: 'clear' }] }];
    const bits = [];
    TRIPS.rows.forEach((r, i) => {
      const tests = atoms.map((a) => atomTest(a, r));
      const keep = any ? tests.some((t) => t.ok) : tests.every((t) => t.ok);
      bits.push(keep ? 1 : 0);
      const n = i + 1;
      const ticks = bits.reduce((s, b) => s + b, 0);
      trace.push({
        label: 'Trip ' + n + ': ' + tests.map((t) => t.tex + ' ' + (t.ok ? 'true' : 'false')).join(', ') + (keep ? ': tick.' : ': dot.') + ' Ticks: $' + ticks + '$.',
        vars: { trip: n, keep, ticks },
        patch: { fUpTo: n },
        ops: tests.map((t) => ({ role: 'trips', cmd: 'highlight', args: { sel: 'cell:' + n + ',' + t.col, tone: t.ok ? 'good' : 'bad' } })),
      });
    });
    const total = bits.reduce((s, b) => s + b, 0);
    trace.push({ label: 'Add the ticks: $' + bits.join('+') + ' = ' + total + '$ trips kept.', patch: { fUpTo: TRIPS.rows.length },
      ops: [{ role: 'trips', cmd: 'highlight', args: { sel: 'col:kept', tone: 'good' } }] });
    return { trace, steps: trace.length, count: total, bits };
  }

  // ---- which commands check a column name at once? (scene shopping-list, DropBins) ----------
  // Bins come from the real runs: a REAL entry with an error means "raises on this very line".
  const EAGER = [
    { id: 'select', label: 'trips.select("PULocatonID")', key: 'm2.lazy.select_typo' },
    { id: 'filter', label: 'trips.filter(F.col("fare_amt") > 10)', key: 'm2x.wait.filter_typo' },
    { id: 'orderby', label: 'trips.orderBy("fare_amt")', key: 'm2x.lazy.orderby_typo' },
    { id: 'withcolumn', label: 'trips.withColumn("x", F.col("fare_amt") * 2)', key: 'm2x.wait.withcolumn_typo' },
    { id: 'groupby', label: 'trips.groupBy("PULocatonID")', key: 'm2x.wait.groupby_typo_assign' },
    { id: 'getitem', label: 'trips["PULocatonID"]', key: 'm2x.lazy.getitem_typo' },
    { id: 'attr', label: 'trips.PULocatonID', key: 'm2x.wait.dot_typo_assign' },
  ];
  function eagerBins() {
    const solution = {};
    EAGER.forEach((c) => {
      const e = realEntry(c.key);
      if (e.code.indexOf(c.label) < 0) throw new Error('eagerBins: ' + c.key + ' does not run ' + c.label);
      solution[c.id] = e.err ? 'now' : 'wait';
    });
    const ids = Object.keys(solution);
    return {
      chips: EAGER.map((c) => ({ id: c.id, label: codeSpan(c.label) })),
      bins: [{ id: 'wait', label: 'No error yet: waits for an action' }, { id: 'now', label: 'Raises on this very line' }],
      solution, waits: ids.filter((k) => solution[k] === 'wait').length, now: ids.filter((k) => solution[k] === 'now').length,
    };
  }

  // ---- import styles step by step (section import-styles) ----------------------------------
  // The notebook's name table: what round, max, sum, desc and F mean, changed line by line.
  const NAME_ROWS = ['round', 'max', 'sum', 'desc', 'F'];
  const PY_BUILTIN = '\\text{Python built-in}';
  const SPARK_FN = '\\text{PySpark function}';
  // anchors: builtin, import-f, fdesc, star, clash, fix (Session 3 "Imports: borrowing tools" and "the wildcard import").
  // roles: names (live Matrix from importCode().start: rows round, max, sum, desc, F; column "means")
  function importCode() {
    const one = (k) => realEntry(k).out.replace(/\n+$/, '');
    const fill = (row, v) => ({ role: 'names', cmd: 'fill', args: { cell: row + ',means', value: v } });
    const hl = (rows, tone) => ({ role: 'names', cmd: 'highlight', args: { sel: rows.map((r) => 'row:' + r), tone: tone || 'accent' } });
    const clash = finalLine(realEntry('m2.wildcard.round').err);
    const fixed = one('m2x.app.builtins_back');
    const trace = [
      { label: 'Python\'s own `round(4.567, 1)` prints $' + one('m2.builtins.round') + '$. No import needed.', code: 'builtin', math: 'builtin',
        vars: { printed: one('m2.builtins.round') }, ops: [{ role: 'names', cmd: 'clear' }, hl(['round'])] },
      { label: '`max(3, 7)` prints $' + one('m2.builtins.max') + '$: the larger number.', code: 'builtin', math: 'builtin', vars: { printed: one('m2.builtins.max') }, ops: [hl(['max'])] },
      { label: '`sum([1, 2, 3])` prints $' + one('m2.builtins.sum') + '$: the list added up.', code: 'builtin', math: 'builtin', vars: { printed: one('m2.builtins.sum') }, ops: [hl(['sum'])] },
      { label: '`as F` creates one new name, `F`: the whole toolbox. Nothing else changes.', code: 'import-f', math: 'import-f',
        vars: { F: 'module' }, ops: [fill('F', '\\text{PySpark functions module}'), hl(['F'], 'good')] },
      { label: '`type(F)` confirms it: ' + codeSpan(one('m2.type_F')) + '.', code: 'import-f', math: 'import-f', vars: { printed: one('m2.type_F') }, ops: [hl(['F'])] },
      { label: '`F.desc("count")` finds Spark\'s `desc` inside the box: a sort instruction.', code: 'fdesc', math: 'fdesc',
        vars: { printed: one('m2x.imp.F.Fdesc') }, ops: [hl(['F'], 'good')] },
      { label: 'The star copies every tool under its bare name. `round`, `max`, `sum` are now Spark\'s.', code: 'star', math: 'star',
        vars: { round: 'PySpark function' }, ops: ['round', 'max', 'sum', 'desc'].map((r) => fill(r, SPARK_FN)).concat([hl(['round', 'max', 'sum'], 'bad')]) },
      { label: 'Spark\'s `round` wants a column, not $4.567$. The cell stops: ' + codeSpan(clash) + '.', code: 'clash', math: 'clash',
        vars: { error: clash }, ops: [hl(['round'], 'bad')] },
      { label: '`from builtins import ...` takes Python\'s own versions back.', code: 'fix', math: 'fix',
        vars: { round: 'Python built-in' }, ops: ['round', 'max', 'sum'].map((r) => fill(r, PY_BUILTIN)).concat([hl(['round', 'max', 'sum'], 'good')]) },
      { label: 'The same three calls print `' + fixed + '` again.', code: 'fix', math: 'fix', vars: { printed: fixed }, ops: [hl(['round', 'max', 'sum'], 'good')] },
    ];
    return {
      trace, steps: trace.length, clash, fixed,
      results: { round: one('m2.builtins.round'), max: one('m2.builtins.max'), sum: one('m2.builtins.sum'), typeF: one('m2.type_F'), fdesc: one('m2x.imp.F.Fdesc') },
      start: { rows: NAME_ROWS, cols: ['means'], values: [[PY_BUILTIN], [PY_BUILTIN], [PY_BUILTIN], [null], [null]], emptyLabel: 'not defined' },
    };
  }

  // ---- application: Bea's fixed notebook with a live fare cut-off (application cell fixed-notebook) ----
  // Average tip per pickup zone over the trips with a tip and a fare above minFare, best first, the zone number as
  // the tie-break. minFare = 5 is the real run m2x.fixed.best; 0, 10 and 20 are the real runs m2x.fixed2.fare*.
  const BEST_CODE = REAL['m2x.fixed.best'].code;
  const tippedAbove = (minFare) => dfFilter(TRIPS, { and: [{ col: 'tip_amount', op: '>', value: 0 }, { col: 'fare_amount', op: '>', value: minFare }] });
  const bestTable = (kept) => dfOrderBy(dfAgg(dfGroupBy(kept, ['PULocationID']), [{ fn: 'mean', col: 'tip_amount', alias: 'avg_tip' }]), [{ desc: 'avg_tip' }, 'PULocationID']);
  const perZone = (kept) => dfOrderBy(countBy(kept, 'PULocationID'), ['PULocationID']);
  function bestZones({ minFare = 5 }) {
    const kept = tippedAbove(minFare);
    const best = bestTable(kept);
    const counts = perZone(kept);
    const fare = '(F.col("fare_amount") > ' + lit(minFare) + ')';
    const code = BEST_CODE.replace('(F.col("fare_amount") > 5)', fare);
    const countsCode = 'tipped = trips.filter((F.col("tip_amount") > 0) & ' + fare + ')\n' +
      'tipped.groupBy("PULocationID").count().orderBy("PULocationID").show()';
    const zi = colOf(best, 'PULocationID');
    const ai = colOf(best, 'avg_tip');
    const zones = best.rows.map((r) => r[zi]);
    const ni = colOf(counts, 'count');
    const most = counts.rows.reduce((m, r) => Math.max(m, r[ni]), 0);
    const keep = ALL_IDX.filter((i) => kept.rows.indexOf(TRIPS.rows[i]) >= 0);
    const base = tripsView({ cols: ['PULocationID', 'fare_amount', 'tip_amount'] });
    // The arithmetic behind one zone's average, from the kept trips: "(4.47 + 6.35) / 2 = 5.41" (show() digits).
    const kz = colOf(kept, 'PULocationID');
    const kt = colOf(kept, 'tip_amount');
    const avgMath = (z) => {
      if (z === null) return null;
      const tips = kept.rows.filter((r) => r[kz] === z).map((r) => dfJavaDouble(r[kt]));
      const avg = dfFormatValue(best.rows[zones.indexOf(z)][ai], best.columns[ai].type, true);
      return tips.length === 1 ? tips[0] + ', from one trip' : '(' + tips.join(' + ') + ') / ' + tips.length + ' = ' + avg;
    };
    return {
      rows: base.rows, cols: base.cols.concat(['kept']),
      values: base.values.map((v, i) => v.concat([keep.indexOf(i) >= 0 ? '\\checkmark' : '\\cdot'])),
      minFare, code, out: txt(dfShowOutput(best)), countsCode, countsOut: txt(dfShowOutput(counts)),
      tipped: dfCount(kept), trips: tripNums(keep), zones: zones.length, ranking: zones.join(', '),
      top: zones.length ? zones[0] : null, topAvg: zones.length ? best.rows[0][ai] : null,
      second: zones.length > 1 ? zones[1] : null, mostTrips: most,
      topMath: avgMath(zones.length ? zones[0] : null), secondMath: avgMath(zones.length > 1 ? zones[1] : null),
    };
  }

  // ---- checks against real Spark (examples.yaml) ------------------------------------------
  // For each REAL key: the engine's version of the same text. part: out | err | final (exception line only).
  const fare10 = () => dfFilter(TRIPS, CONDS.fare10.pred);
  const tipped6 = () => dfFilter(TRIPS, { and: [{ col: 'tip_amount', op: '>', value: 0 }, { col: 'fare_amount', op: '>', value: 5 }] });
  const ENGINE_OF = {
    'm2.select_pu': () => ({ part: 'out', text: dfShowOutput(dfSelect(TRIPS, ['PULocationID'])) }),
    'm2.select_two': () => ({ part: 'out', text: dfShowOutput(dfSelect(TRIPS, ['PULocationID', 'DOLocationID'])) }),
    'm2.describe_two': () => ({ part: 'out', text: dfShowOutput(dfDescribe(TRIPS, ['PULocationID', 'DOLocationID'])) }),
    'm2.groupby_count': () => ({ part: 'out', text: dfShowOutput(countBy(TRIPS, 'PULocationID')) }),
    'm2.groupby_count_desc': () => ({ part: 'out', text: dfShowOutput(dfOrderBy(countBy(TRIPS, 'PULocationID'), [{ desc: 'count' }])) }),
    'm2.groupby_count_desc_tiebreak': () => ({ part: 'out', text: dfShowOutput(sortCounts(TRIPS, 'PULocationID')) }),
    'm2.def_with_return': () => ({ part: 'out', text: dfShowOutput(sortCounts(TRIPS, 'PULocationID')) }),
    'm2.filter_gt10_count': () => ({ part: 'out', text: String(dfCount(fare10())) }),
    'm2.where_alias': () => ({ part: 'out', text: String(dfCount(fare10())) }),
    'm2.filter_gt10_show': () => ({ part: 'out', text: dfShowOutput(fare10()) }),
    'm2.filter_and': () => ({ part: 'out', text: dfShowOutput(dfFilter(TRIPS, CONDS.fareTip.pred)) }),
    'm2.filter_or': () => ({ part: 'out', text: dfShowOutput(dfFilter(TRIPS, CONDS.zone7or33.pred)) }),
    'm2.filter_sql_string': () => ({ part: 'out', text: String(dfCount(dfFilter(TRIPS, 'total_amount > 30'))) }),
    'm2.filter_sql_string_show': () => ({ part: 'out', text: dfShowOutput(dfFilter(TRIPS, 'total_amount > 30')) }),
    'm2x.lazy.where_sql_30': () => ({ part: 'out', text: String(dfCount(dfFilter(TRIPS, 'total_amount > 30'))) }),
    'm2x.lazy.sql_gt_1000': () => ({ part: 'out', text: String(dfCount(dfFilter(TRIPS, 'total_amount > 1000'))) }),
    'm2.withcolumn_cast_sum': () => ({ part: 'out', text: dfShowOutput(dfGroupedAgg(dfGroupBy(dfWithColumn(TRIPS, 'total_amount', { cast: 'float', col: 'total_amount' }), ['VendorID']), 'sum', ['total_amount'])) }),
    'm2.withcolumn_cast_sum_double': () => ({ part: 'out', text: dfShowOutput(dfOrderBy(dfGroupedAgg(dfGroupBy(TRIPS, ['VendorID']), 'sum', ['total_amount']), ['VendorID'])) }),
    'm2.agg_sum_show': () => ({ part: 'out', text: dfShowOutput(dfAgg(TRIPS, [{ fn: 'sum', col: 'fare_amount' }])) }),
    'm2.dtypes': () => ({ part: 'out', text: dfDtypesRepr(TRIPS) }),
    'm1.columns': () => ({ part: 'out', text: dfColumnsRepr(TRIPS) }),
    'm2.date_trunc_show': () => ({ part: 'out', text: dfShowOutput(dfSelect(TRIPS, ['lpep_pickup_datetime', { dateTrunc: 'hour', col: 'lpep_pickup_datetime' }])) }),
    'm2.date_trunc_alias_show': () => ({ part: 'out', text: dfShowOutput(dfSelect(TRIPS, ['lpep_pickup_datetime', { dateTrunc: 'hour', col: 'lpep_pickup_datetime', alias: 'pickup_hour' }])) }),
    'm2.freqitems.step1': () => ({ part: 'out', text: dfShowOutput(dfFreqItems(TRIPS, ['PULocationID'], 0.3)) }),
    'm2.freqitems.step1_0.2': () => ({ part: 'out', text: dfShowOutput(dfFreqItems(TRIPS, ['PULocationID'], 0.2), { truncate: false }) }),
    'm2.freqitems.step2': () => ({ part: 'out', text: dfShowOutput(dfWithColumn(dfFreqItems(TRIPS, ['PULocationID'], 0.3), 'freq_items', { explode: 'PULocationID_freqItems' })) }),
    'm2.freqitems.step3': () => ({ part: 'out', text: dfShowOutput(dfDrop(dfWithColumn(dfFreqItems(TRIPS, ['PULocationID'], 0.3), 'freq_items', { explode: 'PULocationID_freqItems' }), ['PULocationID_freqItems'])) }),
    'm2x.lazy.cell63_F': () => ({ part: 'out', text: dfShowOutput(dfDrop(dfWithColumn(dfFreqItems(TRIPS, ['PULocationID'], 0.3), 'freq_items', { explode: 'PULocationID_freqItems' }), ['PULocationID_freqItems'])) }),
    'm2.chain5.step1': () => ({ part: 'out', text: dfShowOutput(chain5Table(1)) }),
    'm2.chain5.step2': () => ({ part: 'out', text: dfShowOutput(chain5Table(2)) }),
    'm2.chain5.step4': () => ({ part: 'out', text: dfShowOutput(chain5Table(4)) }),
    'm2.chain5.step5': () => ({ part: 'out', text: dfShowOutput(chain5Table(5)) }),
    'm2.chain5.step3': () => ({ part: 'final', text: dfPyErrorText('AttributeError', { type: 'GroupedData', attr: 'show' }) }),
    'm2.def_no_return': () => ({ part: 'final', text: dfPyErrorText('AttributeError', { type: 'NoneType', attr: 'show' }) }),
    'm2.desc_without_import': () => ({ part: 'final', text: dfPyErrorText('NameError', { name: 'desc' }) }),
    'm2.filter_python_and': () => ({ part: 'final', text: dfPyErrorText('columnBool') }),
    'm2.filter_str_gt': () => ({ part: 'final', text: dfPyErrorText('compare', { op: '>', left: 'str', right: 'int' }) }),
    'm2.wildcard.max': () => ({ part: 'final', text: dfPyErrorText('shadowedMax') }),
    'm2.wildcard.round': () => ({ part: 'final', text: dfPyErrorText('shadowedBuiltin') }),
    'm2.lazy.select_PULocationId.show': () => ({ part: 'out', text: dfShowOutput(dfSelect(TRIPS, ['PULocationId'])) }),
    'm2.lazy.select_typo.show': () => ({ part: 'err', text: dfTraceback({ cell: 52, code: 'pu.show()', error: dfTry(() => dfSelect(TRIPS, ['PULocatonID'])).error, plan: dfPlanLines('select', TRIPS, ['PULocatonID'], { startId: 276 }) }) }),
    'm2x.lazy.multiline': () => ({ part: 'err', text: dfTraceback({ cell: 11, line: 4, code: 'pu.show()', error: dfTry(() => dfSelect(TRIPS, ['PULocatonID'])).error, plan: dfPlanLines('select', TRIPS, ['PULocatonID'], { startId: 246 }) }) }),
    'm2.lazy.filter_typo.count': () => ({ part: 'final', text: dfErrorText(dfTry(() => dfFilter(TRIPS, { col: 'fare_amt', op: '>', value: 10 })).error) }),
    'm2x.lazy.orderby_typo_show': () => ({ part: 'final', text: dfErrorText(dfTry(() => dfOrderBy(TRIPS, ['fare_amt'])).error) }),
    'm2x.lazy.groupby_typo': () => ({ part: 'final', text: dfErrorText(dfTry(() => dfGroupBy(TRIPS, ['PULocatonID'])).error) }),
    'm2x.lazy.getitem_typo': () => ({ part: 'final', text: dfErrorText(dfTry(() => dfSelect(TRIPS, ['PULocatonID'])).error) }),
    'm2x.lazy.assembly': () => ({ part: 'out', text: dfShowOutput(sortCounts(dfSelect(TRIPS, ['PULocationID']), 'PULocationID')) }),
    'm2x.lazy.fare_select_group': () => ({ part: 'out', text: dfShowOutput(sortCounts(dfSelect(fare10(), ['PULocationID', 'fare_amount']), 'PULocationID')) }),
    'm2x.lazy.top_pickups_show5': () => ({ part: 'out', text: dfShowOutput(sortCounts(TRIPS, 'PULocationID'), { n: 5 }) }),
    'm2x.lazy.printSchema': () => ({ part: 'out', text: dfPrintSchemaString(TRIPS) + '\n' }),
    'm1.ddl_int.show': () => ({ part: 'out', text: dfShowOutput(dfReadCsv(DF_TAXI12_CSV, { header: true, schema: DF_TAXI12_DDL_INT, path: T12_PATH })) }),
    'm1.ddl_int.printSchema': () => ({ part: 'out', text: dfPrintSchemaString(dfReadCsv(DF_TAXI12_CSV, { header: true, schema: DF_TAXI12_DDL_INT, path: T12_PATH })) + '\n' }),
    'm1.ddl_int.groupby_flag': () => ({ part: 'out', text: dfShowOutput(countBy(dfReadCsv(DF_TAXI12_CSV, { header: true, schema: DF_TAXI12_DDL_INT, path: T12_PATH }), 'store_and_fwd_flag')) }),
    'm2x.app.and_fix': () => ({ part: 'out', text: String(dfCount(tipped6())) }),
    'm2x.app.typo_show': () => ({ part: 'final', text: dfErrorText(dfTry(() => dfAgg(dfGroupBy(tipped6(), ['PULocationID']), [{ fn: 'mean', col: 'tip_amont', alias: 'avg_tip' }])).error) }),
    'm2x.fixed.best': () => ({ part: 'out', text: dfShowOutput(dfOrderBy(dfAgg(dfGroupBy(tipped6(), ['PULocationID']), [{ fn: 'mean', col: 'tip_amount', alias: 'avg_tip' }]), [{ desc: 'avg_tip' }, 'PULocationID'])) }),
    'm2x.app.typo_fix': () => ({ part: 'out', text: dfShowOutput(dfOrderBy(dfAgg(dfGroupBy(tipped6(), ['PULocationID']), [{ fn: 'mean', col: 'tip_amount', alias: 'avg_tip' }]), [{ desc: 'avg_tip' }, 'PULocationID'])) }),
    'm2x.app2.two_filters': () => ({ part: 'out', text: String(dfCount(dfFilter(dfFilter(TRIPS, { col: 'tip_amount', op: '>', value: 0 }), { col: 'fare_amount', op: '>', value: 5 }))) }),
    'm2x.app2.or_count': () => ({ part: 'out', text: String(dfCount(dfFilter(TRIPS, { or: [{ col: 'tip_amount', op: '>', value: 0 }, { col: 'fare_amount', op: '>', value: 5 }] }))) }),
    'm2x.fixed2.fare0': () => ({ part: 'out', text: dfShowOutput(bestTable(tippedAbove(0))) }),
    'm2x.fixed2.fare10': () => ({ part: 'out', text: dfShowOutput(bestTable(tippedAbove(10))) }),
    'm2x.fixed2.fare20': () => ({ part: 'out', text: dfShowOutput(bestTable(tippedAbove(20))) }),
    'm2x.fixed2.fare5_counts': () => ({ part: 'out', text: dfShowOutput(perZone(tippedAbove(5))) }),
    'm2x.app2.and_parens': () => ({ part: 'final', text: dfPyErrorText('columnBool') }),
    'm2x.app2.amp_no_parens': () => ({ part: 'final', text: dfPyErrorText('columnBool') }),
  };
  // Does the engine reproduce the real output of `key`? (Used by examples.yaml.)
  function realMatch({ key }) {
    const f = ENGINE_OF[key];
    if (!f) throw new Error('realMatch: no engine version for ' + key);
    const e = realEntry(key);
    const mine = f();
    let real;
    if (mine.part === 'out') real = e.out;
    else if (mine.part === 'err') real = e.err;
    else real = finalLine(e.err).replace(/;$/, '');
    return { key, part: mine.part, same: mine.text === real, engine: mine.text, real };
  }

  // ==========================================================================================
  // QUIZ GENERATORS. Small tables are random subsets of the twelve real trips (never invented
  // values); every answer and misconception is computed by the engine or by the fns above.
  // ==========================================================================================
  const sorted = (a) => a.slice().sort((p, q) => p - q);
  const uniq = (a) => a.filter((v, i) => a.indexOf(v) === i);
  const sample = (rng, k) => sorted(rng.sample(ALL_IDX, k));
  const tableMd = (idx, cols) => dfToMarkdownTable(sub(idx), { cols });
  const valuesOf = (idx, col) => idx.map((i) => TRIPS.rows[i][colOf(TRIPS, col)]);
  const cnt = (t, pred) => dfCount(dfFilter(t, pred));
  const distinctOk = (a) => uniq(a).length === a.length;

  // filter-count-numeric: one comparison, > is strict
  function filterCountQ({ rng, difficulty }) {
    const k = [6, 8, 10][difficulty - 1] || 8;
    for (let tries = 0; tries < 200; tries++) {
      const idx = sample(rng, k);
      const col = rng.pick(['fare_amount', 'tip_amount', 'total_amount']);
      const x = rng.pick(uniq(valuesOf(idx, col)));
      const t = sub(idx);
      const answer = cnt(t, { col, op: '>', value: x });
      const geq = cnt(t, { col, op: '>=', value: x });
      const lt = cnt(t, { col, op: '<', value: x });
      if (answer === 0 || answer === k || !distinctOk([answer, geq, lt, k])) continue;
      return {
        vars: { table: tableMd(idx, ['PULocationID', col]), col, x, k, answer, geq, lt, code: 'trips.filter(F.col("' + col + '") > ' + lit(x) + ').count()' },
        misconceptions: [
          { var: 'geq', feedback: 'You also kept the trips equal to {=x}. `>` is strict: "greater than", not "at least".' },
          { var: 'lt', feedback: 'You counted the trips that fail the test. `filter` keeps the rows where the condition is true.' },
          { var: 'k', feedback: 'That is every row. The condition removes the rows where it is false.' },
        ],
      };
    }
    throw new Error('filterCountQ: no unambiguous draw');
  }

  // filter-and-numeric: two conditions joined with &
  function filterAndQ({ rng, difficulty }) {
    const k = [8, 10, 12][difficulty - 1] || 10;
    for (let tries = 0; tries < 200; tries++) {
      const idx = sample(rng, k);
      const x = rng.pick(uniq(valuesOf(idx, 'fare_amount')));
      const y = rng.pick([0, 2]);
      const t = sub(idx);
      const A = { col: 'fare_amount', op: '>', value: x };
      const B = { col: 'tip_amount', op: '>', value: y };
      const answer = cnt(t, { and: [A, B] });
      const orCount = cnt(t, { or: [A, B] });
      const firstOnly = cnt(t, A);
      const secondOnly = cnt(t, B);
      if (answer === 0 || !distinctOk([answer, orCount, firstOnly, secondOnly])) continue;
      return {
        vars: { table: tableMd(idx, ['PULocationID', 'fare_amount', 'tip_amount']), x, y, k, answer, orCount, firstOnly, secondOnly,
          code: 'trips.filter((F.col("fare_amount") > ' + lit(x) + ') & (F.col("tip_amount") > ' + y + ')).count()' },
        misconceptions: [
          { var: 'orCount', feedback: 'That is the `|` (or) count. With `&` a trip must pass **both** tests.' },
          { var: 'firstOnly', feedback: 'You checked only the fare. The tip test must also be true.' },
          { var: 'secondOnly', feedback: 'You checked only the tip. The fare test must also be true.' },
        ],
      };
    }
    throw new Error('filterAndQ: no unambiguous draw');
  }

  // filter-or-numeric: two conditions joined with |
  function filterOrQ({ rng, difficulty }) {
    const k = [8, 10, 12][difficulty - 1] || 10;
    for (let tries = 0; tries < 300; tries++) {
      const idx = sample(rng, k);
      const z = rng.pick(uniq(valuesOf(idx, 'PULocationID')));
      const x = rng.pick(uniq(valuesOf(idx, 'fare_amount')));
      const t = sub(idx);
      const A = { col: 'PULocationID', op: '==', value: z };
      const B = { col: 'fare_amount', op: '>', value: x };
      const answer = cnt(t, { or: [A, B] });
      const andCount = cnt(t, { and: [A, B] });
      const sumBoth = cnt(t, A) + cnt(t, B);
      if (andCount === 0 || answer === k || !distinctOk([answer, andCount, sumBoth])) continue;
      return {
        vars: { table: tableMd(idx, ['PULocationID', 'fare_amount']), z, x, k, answer, andCount, sumBoth,
          code: 'trips.filter((F.col("PULocationID") == ' + z + ') | (F.col("fare_amount") > ' + lit(x) + ')).count()' },
        misconceptions: [
          { var: 'andCount', feedback: 'That is the `&` (and) count. With `|` one true test is enough.' },
          { var: 'sumBoth', feedback: 'You counted the trips that pass both tests twice. Each row is kept once at most.' },
        ],
      };
    }
    throw new Error('filterOrQ: no unambiguous draw');
  }

  // or-not-numeric: ~ (not) inside an | (or). Kept = zone trips + untipped trips - the trips that are both.
  function orNotQ({ rng }) {
    for (let tries = 0; tries < 300; tries++) {
      const k = rng.pick([9, 10, 11]); // a fresh subset of the twelve trips
      const idx = sample(rng, k);
      const z = rng.pick(uniq(valuesOf(idx, 'PULocationID')));
      const t = sub(idx);
      const A = { col: 'PULocationID', op: '==', value: z };
      const T = { col: 'tip_amount', op: '>', value: 0 };
      const answer = cnt(t, { or: [A, { not: T }] });
      const zoneN = cnt(t, A);
      const notN = cnt(t, { not: T });
      const both = cnt(t, { and: [A, { not: T }] });
      const withoutNot = cnt(t, { or: [A, T] });
      const sumBoth = zoneN + notN;
      if (both === 0 || answer === k || !distinctOk([answer, withoutNot, sumBoth, both])) continue;
      return {
        vars: { table: tableMd(idx, ['PULocationID', 'tip_amount']), z, k, answer, zoneN, notN, both, withoutNot, sumBoth,
          code: 'trips.filter((F.col("PULocationID") == ' + z + ') | ~(F.col("tip_amount") > 0)).count()' },
        misconceptions: [
          { var: 'withoutNot', feedback: 'You kept the tipped trips. `~` flips the test: it keeps the trips whose tip is **not** above 0.' },
          { var: 'sumBoth', feedback: 'You counted the trips that pass both tests twice. Each row is kept once at most.' },
          { var: 'both', feedback: 'That is the `&` (and) count. With `|` one true test is enough.' },
        ],
      };
    }
    throw new Error('orNotQ: no unambiguous draw');
  }

  // group-count-numeric: the count next to one zone
  function groupCountQ({ rng, difficulty }) {
    const k = [6, 9, 12][difficulty - 1] || 9;
    for (let tries = 0; tries < 200; tries++) {
      const idx = sample(rng, k);
      const t = sub(idx);
      const counts = dfCollect(countBy(t, 'PULocationID'));
      const groups = counts.length;
      const pick = rng.pick(counts);
      const answer = pick.count;
      const firstPos = idx.findIndex((i) => TRIPS.rows[i][colOf(TRIPS, 'PULocationID')] === pick.PULocationID) + 1;
      if (!distinctOk([answer, k, groups])) continue;
      return {
        vars: { table: tableMd(idx, ['PULocationID', 'fare_amount']), zone: pick.PULocationID, answer, k, groups, firstPos, result: dfShowBlock(countBy(t, 'PULocationID')) },
        misconceptions: [
          { var: 'k', feedback: 'That is the number of trips in the whole table. `count()` counts the trips **in each group**.' },
          { var: 'groups', feedback: 'That is the number of groups (rows of the result), not the count for zone {=zone}.' },
        ],
      };
    }
    throw new Error('groupCountQ: no unambiguous draw');
  }

  // group-rows-numeric: how many rows groupBy(col).count() returns
  function groupRowsQ({ rng, difficulty }) {
    const k = [6, 9, 12][difficulty - 1] || 9;
    for (let tries = 0; tries < 200; tries++) {
      const idx = sample(rng, k);
      const col = rng.pick(['PULocationID', 'DOLocationID', 'VendorID', 'passenger_count']);
      const t = sub(idx);
      const res = dfCollect(countBy(t, col));
      const answer = res.length;
      const topCount = Math.max.apply(null, res.map((o) => o.count));
      if (!distinctOk([answer, k, topCount])) continue;
      return {
        vars: { table: tableMd(idx, [col, 'fare_amount']), col, k, answer, topCount, code: 'trips.groupBy("' + col + '").count().show()' },
        misconceptions: [
          { var: 'k', feedback: 'One row per **trip** is the input. The result has one row per distinct value of `{=col}`.' },
          { var: 'topCount', feedback: 'That is the biggest count inside the result, not the number of rows.' },
        ],
      };
    }
    throw new Error('groupRowsQ: no unambiguous draw');
  }

  // top-zone-numeric: which zone is printed in row r after orderBy(desc count, zone)
  function topZoneQ({ rng, difficulty }) {
    const k = [7, 9, 12][difficulty - 1] || 9;
    for (let tries = 0; tries < 300; tries++) {
      const idx = sample(rng, k);
      const t = sub(idx);
      const c = countBy(t, 'PULocationID');
      const right = dfCollect(dfOrderBy(c, [{ desc: 'count' }, 'PULocationID']));
      if (right.length < 3) continue;
      const r = difficulty === 1 ? 1 : rng.int(1, Math.min(3, right.length));
      const answer = right[r - 1].PULocationID;
      const asc = dfCollect(dfOrderBy(c, ['count', 'PULocationID']))[r - 1].PULocationID;
      const tieDesc = dfCollect(dfOrderBy(c, [{ desc: 'count' }, { desc: 'PULocationID' }]))[r - 1].PULocationID;
      const byZone = dfCollect(dfOrderBy(c, ['PULocationID']))[r - 1].PULocationID;
      const seen = uniq(valuesOf(idx, 'PULocationID'));
      const tableOrder = seen[Math.min(r, seen.length) - 1];
      if (answer === asc) continue;
      if (difficulty >= 2 && answer === tieDesc) continue; // make the tie-break matter
      if ([tieDesc, byZone, tableOrder].filter((v) => v !== answer).length < 1) continue; // at least two live misconceptions with asc
      return {
        vars: { table: tableMd(idx, ['PULocationID', 'tip_amount']), r, answer, asc, tieDesc, byZone, tableOrder, k, result: dfShowBlock(dfOrderBy(c, [{ desc: 'count' }, 'PULocationID'])) },
        misconceptions: [
          { var: 'asc', feedback: '`F.desc("count")` sorts the biggest count first. You sorted the smallest first.' },
          { var: 'tieDesc', feedback: 'Right count, wrong tie-break. `"PULocationID"` sorts tied zones from the **smallest** number up.' },
          { var: 'byZone', feedback: 'You sorted by zone number only. The first sort key is the count.' },
          { var: 'tableOrder', feedback: 'That is the order in which the zones first appear in the table. `orderBy` re-sorts the counts.' },
        ],
      };
    }
    throw new Error('topZoneQ: no unambiguous draw');
  }

  // chain-rows-numeric: rows after filter -> groupBy -> count
  function chainRowsQ({ rng, difficulty }) {
    const k = [8, 10, 12][difficulty - 1] || 10;
    for (let tries = 0; tries < 200; tries++) {
      const idx = sample(rng, k);
      const t = sub(idx);
      const col = rng.pick(['tip_amount', 'fare_amount']);
      const x = col === 'tip_amount' ? 0 : rng.pick(uniq(valuesOf(idx, 'fare_amount')));
      const f = dfFilter(t, { col, op: '>', value: x });
      const answer = dfCount(countBy(f, 'PULocationID'));
      const afterFilter = dfCount(f);
      const allGroups = dfCount(countBy(t, 'PULocationID'));
      if (answer === 0 || !distinctOk([answer, afterFilter, allGroups])) continue;
      return {
        vars: { table: tableMd(idx, ['PULocationID', col]), col, x, k, answer, afterFilter, allGroups,
          code: '(\n    trips.filter(F.col("' + col + '") > ' + lit(x) + ')\n    .groupBy("PULocationID")\n    .count()\n)' },
        misconceptions: [
          { var: 'afterFilter', feedback: 'That is the number of trips after `filter`. `groupBy` + `count` then makes one row per zone.' },
          { var: 'allGroups', feedback: 'You grouped every trip. The filter runs first, so only the kept trips are grouped.' },
        ],
      };
    }
    throw new Error('chainRowsQ: no unambiguous draw');
  }

  // function-rows-numeric: a function with a parameter and a helper variable
  function functionRowsQ({ rng, difficulty }) {
    const k = [8, 10, 11][difficulty - 1] || 10;
    for (let tries = 0; tries < 300; tries++) {
      const idx = sample(rng, k);
      const m = rng.pick([2, 3]);
      const c = countBy(sub(idx), 'PULocationID');
      const kept = dfCollect(dfFilter(c, { col: 'count', op: '>=', value: m }));
      const answer = kept.length;
      const strict = dfCount(dfFilter(c, { col: 'count', op: '>', value: m }));
      const tripsIn = kept.reduce((s, o) => s + o.count, 0);
      if (answer === 0 || !distinctOk([answer, strict, tripsIn])) continue;
      const code = 'def busy_zones(df, min_trips):\n    counts = df.groupBy("PULocationID").count()\n    return counts.filter(F.col("count") >= min_trips)\n\nbusy_zones(trips, ' + m + ').count()';
      return {
        vars: { table: tableMd(idx, ['PULocationID', 'total_amount']), m, k, answer, strict, tripsIn, groups: dfCount(c), code, result: dfShowBlock(dfOrderBy(c, [{ desc: 'count' }, 'PULocationID'])) },
        misconceptions: [
          { var: 'strict', feedback: '`>=` keeps zones with exactly {=m} trips too. You used a strict `>`.' },
          { var: 'tripsIn', feedback: 'That is the number of trips in those zones. The function returns one row per zone.' },
        ],
      };
    }
    throw new Error('functionRowsQ: no unambiguous draw');
  }

  // lazy-line-numeric: which cell raises when a column name is misspelled?
  const TYPO_LAZY = [
    { op: 'select', code: (v, src) => v + ' = ' + src + '.select("PULocatonID", "fare_amount", "tip_amount")', name: 'PULocatonID' },
    { op: 'filter', code: (v, src) => v + ' = ' + src + '.filter(F.col("fare_amt") > 10)', name: 'fare_amt' },
    { op: 'orderBy', code: (v, src) => v + ' = ' + src + '.orderBy("fare_amt")', name: 'fare_amt' },
    { op: 'withColumn', code: (v, src) => v + ' = ' + src + '.withColumn("tip_x2", F.col("tip_amont") * 2)', name: 'tip_amont' },
  ];
  const TYPO_EAGER = [
    { op: 'groupBy', code: (v, src) => v + ' = ' + src + '.groupBy("PULocatonID")', name: 'PULocatonID' },
    { op: 'getitem', code: (v, src) => v + ' = ' + src + '["fare_amt"]', name: 'fare_amt' },
  ];
  const GOOD_STEPS = [
    { op: 'filter', code: (v, src) => v + ' = ' + src + '.filter(F.col("tip_amount") > 0)' },
    { op: 'orderBy', code: (v, src) => v + ' = ' + src + '.orderBy(F.desc("fare_amount"))' },
    { op: 'filter', code: (v, src) => v + ' = ' + src + '.filter(F.col("fare_amount") > 5)' },
  ];
  const ACTIONS = [{ op: 'show', code: (src) => src + '.show()' }, { op: 'count', code: (src) => src + '.count()' }];
  function lazyLineQ({ rng, difficulty }) {
    for (let tries = 0; tries < 200; tries++) {
      const eager = difficulty === 1 ? false : rng.bool(0.4);
      const nGood = rng.int(1, 2);
      const typoAt = 2 + (eager ? rng.int(0, nGood) : rng.int(0, nGood - 1)); // cell number of the typo
      const steps = [{ op: 'read', typo: false, code: 'trips = spark.read.csv(path, header=True, inferSchema=True)' }];
      const names = ['a', 'b', 'c', 'd'];
      let src = 'trips';
      let v = 0;
      let typoName = null;
      const goods = rng.shuffle(GOOD_STEPS).slice(0, nGood);
      let gi = 0;
      const total = 1 + nGood + 1; // read + good steps + typo
      for (let cellNo = 2; cellNo <= total; cellNo++) {
        const name = names[v++];
        if (cellNo === typoAt) {
          const T = eager ? rng.pick(TYPO_EAGER) : rng.pick(TYPO_LAZY);
          steps.push({ op: T.op, typo: true, code: T.code(name, src) });
          typoName = T.name;
          if (eager) { src = null; break; }
        } else {
          const G = goods[gi++];
          steps.push({ op: G.op, typo: false, code: G.code(name, src) });
        }
        src = name;
      }
      if (eager) {
        // the eager line raises; later cells would never run, but show them anyway as the notebook would have them
        const A = rng.pick(ACTIONS);
        steps.push({ op: A.op, typo: false, code: A.code('trips') });
      } else {
        const A = rng.pick(ACTIONS);
        steps.push({ op: A.op, typo: false, code: A.code(src) });
      }
      const res = failLine({ steps });
      if (res.line === null) continue;
      const answer = res.line;
      const typoLine = steps.findIndex((s) => s.typo) + 1;
      const lastLine = steps.length;
      const wrong = eager ? lastLine : typoLine;
      if (!distinctOk([answer, wrong]) || (eager && answer === lastLine)) continue;
      const md = '| Cell | Code |\n| ---: | --- |\n' + steps.map((s, i) => '| ' + (i + 1) + ' | `' + s.code + '` |').join('\n');
      return {
        vars: { cells: md, n: steps.length, answer, typoLine, lastLine, wrong, typoName, eager, why: res.why },
        misconceptions: [
          { var: 'typoLine', feedback: 'The misspelling sits in cell {=typoLine}, but that command only adds a step to the plan. The error waits for an action.' },
          { var: 'lastLine', feedback: '`groupBy("name")` and `df["name"]` check the name on their own line, so the error comes before the last cell.' },
          { value: 1, feedback: 'Reading the file works: every name in the file is fine. Look for the misspelled name.' },
        ],
      };
    }
    throw new Error('lazyLineQ: no draw');
  }

  // traceback-line-numeric: read the frame of a real traceback
  // Only tracebacks of code the Path has taught by the read-the-receipt scene (no agg); answers 5, 4, 4 and 1.
  const TB_POOL = [
    { key: 'm2.chain5.step3', cause: 4 },
    { key: 'm2.def_no_return', cause: 2 },
    { key: 'm2x.lazy.multiline', cause: 1 },
    { key: 'm2x.wait.groupby_typo_assign', cause: 1 },
  ];
  function tracebackLineQ({ rng }) {
    const p = rng.pick(TB_POOL);
    const parts = tracebackParts({ key: p.key });
    const e = realEntry(p.key);
    const answer = parts.frame.line;
    const lines = e.code.split('\n').length;
    const misconceptions = [{ var: 'cell', feedback: 'That is the cell number in `<cell {=cell}>`. The line number comes after the word "line".' }];
    if (p.cause !== answer) misconceptions.push({ var: 'cause', feedback: 'Line {=cause} holds the cause, but the frame names the line where Python stopped: the one printed under it.' });
    if (lines !== answer && lines !== p.cause) misconceptions.push({ var: 'lines', feedback: 'That is the last line of the cell. Python stopped earlier, at the line the frame names; the lines after it never ran.' });
    return {
      vars: { code: e.code, errBlock: txt(firstPlanOnly(e.err)), answer, cell: parts.frame.cell, cause: p.cause, lines, frameCode: parts.frame.code, final: parts.final },
      misconceptions,
    };
  }

  // null-group-numeric: a schema that says INT for a column of letters
  function nullGroupQ({ rng, difficulty }) {
    const k = [5, 7, 9][difficulty - 1] || 7;
    const others = rng.sample(ALL_IDX.slice(0, 11), k - 1);
    const idx = sorted(others.concat([11])); // always include trip 12, the one Y flag
    const lines = [T12_LINES[0]].concat(idx.map((i) => T12_LINES[i + 1]));
    const t = dfReadCsv(lines, { header: true, schema: DF_TAXI12_DDL_INT, path: T12_PATH });
    const res = dfCollect(countBy(t, 'store_and_fwd_flag'));
    const answer = res[0].count;
    const flags = idx.map((i) => TRIPS.rows[i][colOf(TRIPS, 'store_and_fwd_flag')]);
    const nN = flags.filter((f) => f === 'N').length;
    const nY = flags.filter((f) => f === 'Y').length;
    return {
      vars: { csv: txt(lines.join('\n')), k, answer, groups: res.length, nN, nY, result: dfShowBlock(countBy(t, 'store_and_fwd_flag')) },
      misconceptions: [
        { var: 'nN', feedback: 'You counted the N trips. Under the INT schema no flag survives: N and Y both become NULL.' },
        { var: 'nY', feedback: 'You counted the Y trips. Under the INT schema Y becomes NULL too, so it joins the one NULL group.' },
      ],
    };
  }

  // chain-hand (hand-calc): filter -> select -> groupBy -> count -> orderBy, station by station
  function chainHandQ({ rng, difficulty }) {
    const k = [8, 10, 12][difficulty - 1] || 10;
    for (let tries = 0; tries < 300; tries++) {
      const idx = sample(rng, k);
      const t = sub(idx);
      const x = rng.pick(uniq(valuesOf(idx, 'fare_amount')));
      const f = dfFilter(t, { col: 'fare_amount', op: '>', value: x });
      const nf = dfCount(f);
      if (nf < 3 || nf === k) continue;
      const geq = cnt(t, { col: 'fare_amount', op: '>=', value: x });
      const res = dfCollect(sortCounts(dfSelect(f, ['PULocationID', 'fare_amount']), 'PULocationID'));
      const groups = res.length;
      const topCount = res[0].count;
      const topZone = res[0].PULocationID;
      const tiedTop = res.filter((o) => o.count === topCount).map((o) => o.PULocationID);
      const wrongTie = Math.max.apply(null, tiedTop);
      if (groups === nf) continue; // need at least one zone with 2 kept trips
      if (difficulty >= 2 && tiedTop.length < 2) continue;
      return {
        vars: { table: tableMd(idx, ['PULocationID', 'DOLocationID', 'fare_amount']), x, k, nf, geq, groups, topCount, topZone, wrongTie, cols: 2, allCols: 10,
          code: '(\n    trips.filter(F.col("fare_amount") > ' + lit(x) + ')\n    .select("PULocationID", "fare_amount")\n    .groupBy("PULocationID")\n    .count()\n    .orderBy(F.desc("count"), "PULocationID")\n)' },
      };
    }
    throw new Error('chainHandQ: no draw');
  }

  // group-hand (hand-calc): tally two zones, count the groups, find the first row
  function groupHandQ({ rng, difficulty }) {
    const k = [7, 9, 10][difficulty - 1] || 9;
    for (let tries = 0; tries < 400; tries++) {
      const idx = sample(rng, k);
      const t = sub(idx);
      const res = dfCollect(sortCounts(t, 'PULocationID'));
      if (res.length < 3) continue;
      const pair = rng.sample(res, 2);
      const a = pair[0];
      const b = pair[1];
      const top = res[0];
      const tiedTop = res.filter((o) => o.count === top.count).map((o) => o.PULocationID);
      if (difficulty >= 2 && tiedTop.length < 2) continue;
      return {
        vars: { table: tableMd(idx, ['PULocationID', 'fare_amount']), k, zoneA: a.PULocationID, countA: a.count, zoneB: b.PULocationID, countB: b.count,
          groups: res.length, topZone: top.PULocationID, topCount: top.count, wrongTie: Math.max.apply(null, tiedTop), result: dfShowBlock(sortCounts(t, 'PULocationID')) },
      };
    }
    throw new Error('groupHandQ: no draw');
  }

  // debug-chain-hand (hand-calc): a five-cell notebook (read, filter with & or |, groupBy + count, orderBy with a
  // tie-break, show) with one misspelled PULocationID. groupBy("typo") raises in its own cell; a typo in the
  // orderBy tie-break only goes on the plan and raises at show() (failLine rules, SOURCE_NOTES "Conventions").
  // Then the fixed notebook, station by station. A filter typo is never drawn: groupBy on a broken plan is not modelled.
  const DEBUG_TYPO_AT = [3, 4];
  function debugChainQ({ rng }) {
    for (let tries = 0; tries < 300; tries++) {
      const k = rng.pick([9, 10, 11]); // a fresh subset of the twelve trips
      const idx = sample(rng, k);
      const t = sub(idx);
      const x = rng.pick(uniq(valuesOf(idx, 'fare_amount')));
      const useOr = rng.bool(0.5);
      const A = { col: 'fare_amount', op: '>', value: x };
      const B = { col: 'tip_amount', op: '>', value: 0 };
      const kept = dfFilter(t, useOr ? { or: [A, B] } : { and: [A, B] });
      const nf = dfCount(kept);
      const otherOp = cnt(t, useOr ? { and: [A, B] } : { or: [A, B] });
      const fareOnly = cnt(t, A);
      if (nf < 3 || nf === k || !distinctOk([nf, otherOp, fareOnly])) continue;
      const res = dfCollect(sortCounts(kept, 'PULocationID'));
      const groups = res.length;
      if (groups === nf) continue; // at least one zone keeps two trips, so trips and zones differ
      const topZone = res[0].PULocationID;
      const topCount = res[0].count;
      const tiedTop = res.filter((o) => o.count === topCount).map((o) => o.PULocationID);
      if (useOr && tiedTop.length < 2) continue; // with |, make the tie-break decide the first row
      const typoCell = rng.pick(DEBUG_TYPO_AT);
      const name = (cell) => (cell === typoCell ? 'PULocatonID' : 'PULocationID');
      const op = useOr ? '|' : '&';
      const code = [
        'trips = spark.read.csv(path, header=True, inferSchema=True)',
        'kept = trips.filter((F.col("fare_amount") > ' + lit(x) + ') ' + op + ' (F.col("tip_amount") > 0))',
        'zones = kept.groupBy("' + name(3) + '").count()',
        'top = zones.orderBy(F.desc("count"), "' + name(4) + '")',
        'top.show()',
      ];
      const f = failLine({ steps: [{ op: 'read' }, { op: 'filter' }, { op: 'groupBy', typo: typoCell === 3 }, { op: 'orderBy', typo: typoCell === 4 }, { op: 'show' }] });
      if (f.line === null) continue;
      return {
        vars: { code: code.map((c, i) => '# cell ' + (i + 1) + '\n' + c).join('\n\n'), table: tableMd(idx, ['PULocationID', 'fare_amount', 'tip_amount']),
          k, x, op, opWord: useOr ? 'or' : 'and', nf, otherOp, fareOnly, groups, topZone, topCount, wrongTie: Math.max.apply(null, tiedTop),
          typoCell, failAt: f.line, lastCell: code.length, why: f.why, result: dfShowBlock(sortCounts(kept, 'PULocationID')) },
      };
    }
    throw new Error('debugChainQ: no draw');
  }

  // share-hand (hand-calc): Bea's share line on fresh trips. k is 10 or 11, so kept / k never ends in an exact
  // half at the third decimal and Math.round gives what Python's round(x, 2) prints.
  const round2 = (v) => Math.round(v * 100) / 100;
  function shareQ({ rng }) {
    for (let tries = 0; tries < 300; tries++) {
      const k = rng.pick([10, 11]);
      const idx = sample(rng, k);
      const t = sub(idx);
      const x = rng.pick(uniq(valuesOf(idx, 'fare_amount')));
      const A = { col: 'tip_amount', op: '>', value: 0 };
      const B = { col: 'fare_amount', op: '>', value: x };
      const nf = cnt(t, { and: [A, B] });
      const tipOnly = cnt(t, A);
      const fareOnly = cnt(t, B);
      if (nf < 2 || nf === k || !distinctOk([nf, tipOnly, fareOnly])) continue;
      const share = round2(nf / k);
      const shareTip = round2(tipOnly / k);
      const upsideDown = round2(k / nf);
      if (!distinctOk([share, shareTip, upsideDown])) continue;
      return {
        vars: { table: tableMd(idx, ['PULocationID', 'fare_amount', 'tip_amount']), k, x, nf, tipOnly, fareOnly, share, shareTip, upsideDown,
          code: 'tipped = trips.filter((trips.tip_amount > 0) & (trips.fare_amount > ' + lit(x) + '))\nprint(round(tipped.count() / trips.count(), 2))' },
      };
    }
    throw new Error('shareQ: no draw');
  }

  return {
    fns: {
      realCell, datasetCheck, tripsView, importScope, clashCell, stationView, tallySheet, tallyWalk, sortView, filterView, filterCode,
      chainPrefix, freqChainCode, groupCountCode, wrapCell, functionCode, planView, lazyWalk, lazyCode, failLine,
      receipt, tracebackParts, errorZoo, helpView, dateTruncView, debugCode, realMatch,
      zoneCount, filterSheet, filterWalk, eagerBins, importCode, dtypesView, bestZones,
    },
    generators: {
      filterCountQ, filterAndQ, filterOrQ, groupCountQ, groupRowsQ, topZoneQ, chainRowsQ, functionRowsQ, lazyLineQ,
      tracebackLineQ, nullGroupQ, chainHandQ, groupHandQ, orNotQ, debugChainQ, shareQ,
    },
  };
}
