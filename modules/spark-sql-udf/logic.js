// Qdigo module: spark-sql-udf (Spark SQL and User-Defined Functions)
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

  // ---- REAL outputs, copied by script (build_logic.mjs) from the harness JSON (run/out1-4.json).
  // Each entry: { code, out, err } = what the learner types, what the cell prints, the trimmed error (or null).
  // Real runs: PySpark 4.3.0, local[*], Python 3.14.1, pandas 2.3.3, pyarrow 26.0.0, Java 17, 2026-11-03.
  // Errors are trimmed: library frames become "  ...", local folders become <work> and <site-packages>.
  const REAL = {
   "setup.session": {
    "code": "from pyspark.sql import SparkSession\nspark = (SparkSession\n     .builder\n     .master('local[*]')\n     .config(\"spark.sql.execution.arrow.pyspark.enabled\", \"true\")\n     .getOrCreate())",
    "out": "",
    "err": null
   },
   "setup.read_trips": {
    "code": "trips = spark.read.csv('taxi12.csv', sep=',', header=True, inferSchema=True)",
    "out": "",
    "err": null
   },
   "setup.read_tweets": {
    "code": "tweets = spark.read.json('tweets8.jsonl')",
    "out": "",
    "err": null
   },
   "setup.trips_schema": {
    "code": "trips.printSchema()",
    "out": "root\n |-- VendorID: integer (nullable = true)\n |-- lpep_pickup_datetime: timestamp (nullable = true)\n |-- store_and_fwd_flag: string (nullable = true)\n |-- PULocationID: integer (nullable = true)\n |-- DOLocationID: integer (nullable = true)\n |-- passenger_count: integer (nullable = true)\n |-- trip_distance: double (nullable = true)\n |-- fare_amount: double (nullable = true)\n |-- tip_amount: double (nullable = true)\n |-- total_amount: double (nullable = true)\n\n",
    "err": null
   },
   "setup.tweets_schema": {
    "code": "tweets.printSchema()",
    "out": "root\n |-- entities: struct (nullable = true)\n |    |-- hashtags: array (nullable = true)\n |    |    |-- element: struct (containsNull = true)\n |    |    |    |-- text: string (nullable = true)\n |-- id: long (nullable = true)\n |-- place: struct (nullable = true)\n |    |-- country_code: string (nullable = true)\n |-- text: string (nullable = true)\n |-- user: struct (nullable = true)\n |    |-- created_at: string (nullable = true)\n |    |-- description: string (nullable = true)\n |    |-- friends_count: long (nullable = true)\n |    |-- id: long (nullable = true)\n |    |-- name: string (nullable = true)\n |    |-- screen_name: string (nullable = true)\n |    |-- statuses_count: long (nullable = true)\n\n",
    "err": null
   },
   "setup.trips_show": {
    "code": "trips.show()",
    "out": "+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|VendorID|lpep_pickup_datetime|store_and_fwd_flag|PULocationID|DOLocationID|passenger_count|trip_distance|fare_amount|tip_amount|total_amount|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n|       2| 2017-10-02 08:00:03|                 N|          41|         238|              1|         1.94|       11.5|      2.46|       14.76|\n|       2| 2017-10-02 08:00:06|                 N|          97|         137|              1|         5.08|       22.0|       2.0|        24.8|\n|       1| 2017-10-02 08:00:14|                 N|           7|         261|              1|          9.8|       34.5|       6.0|        41.3|\n|       2| 2017-10-02 08:00:15|                 N|           7|         179|              1|         0.37|        4.0|      0.96|        5.76|\n|       2| 2017-10-02 08:00:16|                 N|          74|         166|              1|          1.4|        8.5|      1.86|       11.16|\n|       2| 2017-10-02 08:00:30|                 N|          33|         140|              1|          8.1|       29.0|      4.47|       34.27|\n|       2| 2017-10-02 08:00:38|                 N|          41|         238|              1|         1.76|       12.0|       0.0|        12.8|\n|       2| 2017-10-02 08:00:51|                 N|           7|         260|              1|         1.51|        8.0|       0.0|         8.8|\n|       2| 2017-10-02 08:01:03|                 N|          75|          41|              1|         1.56|        8.0|       0.0|         8.8|\n|       1| 2017-10-02 08:01:08|                 N|          74|          75|              1|          1.0|        6.0|       0.0|         6.8|\n|       2| 2017-10-02 08:01:38|                 N|           7|         223|              2|         2.15|       10.5|       0.0|        11.3|\n|       1| 2017-10-02 10:47:29|                 Y|          33|         143|              1|          7.1|       31.0|      6.35|       38.15|\n+--------+--------------------+------------------+------------+------------+---------------+-------------+-----------+----------+------------+\n\n",
    "err": null
   },
   "setup.tweets_show": {
    "code": "tweets.select('id', 'user.name', 'user.statuses_count', 'place.country_code').show()",
    "out": "+----------------+-----------+--------------+------------+\n|              id|       name|statuses_count|country_code|\n+----------------+-----------+--------------+------------+\n|1178762251000001| Ana Santos|          1200|          PH|\n|1178762251000002|   Ben Cruz|           450|          PH|\n|1178762251000003|   Cara Lee|           800|          US|\n|1178762251000004|Daichi Mori|           640|          JP|\n|1178762251000005|Elena Ramos|          3000|          PH|\n|1178762251000006| Frank Hall|          2200|          US|\n|1178762251000007|   Gina Tan|            90|        NULL|\n|1178762251000008|  Hugo Diaz|          5010|        NULL|\n+----------------+-----------+--------------+------------+\n\n",
    "err": null
   },
   "setup.builtin_chain": {
    "code": "from pyspark.sql.functions import hour, round\n(trips.select('VendorID',\n              trips.PULocationID,\n              trips['DOLocationID'].alias('dropoff'),\n              hour('lpep_pickup_datetime'))\n      .withColumn('double vendor', trips['VendorID'] * 2)\n      .where(trips['VendorID'] == 1)\n      .limit(10)\n      .show())",
    "out": "+--------+------------+-------+--------------------------+-------------+\n|VendorID|PULocationID|dropoff|hour(lpep_pickup_datetime)|double vendor|\n+--------+------------+-------+--------------------------+-------------+\n|       1|           7|    261|                         8|            2|\n|       1|          74|     75|                         8|            2|\n|       1|          33|    143|                        10|            2|\n+--------+------------+-------+--------------------------+-------------+\n\n",
    "err": null
   },
   "udf.plain_def": {
    "code": "def pair_code(pu, do):\n    \"\"\"Concatenate PULocationID and DOLocationID with a hyphen\"\"\"\n    return f'{pu}-{do}'",
    "out": "",
    "err": null
   },
   "udf.plain_values": {
    "code": "pair_code(41, 238)",
    "out": "'41-238'\n",
    "err": null
   },
   "udf.plain_columns": {
    "code": "pair_code(trips.PULocationID, trips.DOLocationID)",
    "out": "\"Column<'PULocationID'>-Column<'DOLocationID'>\"\n",
    "err": null
   },
   "udf.plain_select": {
    "code": "(trips\n     .select(pair_code('PULocationID', 'DOLocationID'))\n     .show()\n)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 13>\", line 2, in <module>\n    .select(pair_code('PULocationID', 'DOLocationID'))\n     ~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `PULocationID-DOLocationID` cannot be resolved. Did you mean one of the following? [`DOLocationID`, `PULocationID`, `VendorID`, `passenger_count`, `tip_amount`]. SQLSTATE: 42703;\n'Project ['PULocationID-DOLocationID]\n+- Relation [VendorID#17,lpep_pickup_datetime#18,store_and_fwd_flag#19,PULocationID#20,DOLocationID#21,passenger_count#22,trip_distance#23,fare_amount#24,tip_amount#25,total_amount#26] csv"
   },
   "udf.plain_select_cols": {
    "code": "(trips\n     .select(pair_code(trips.PULocationID, trips.DOLocationID))\n     .show()\n)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 14>\", line 2, in <module>\n    .select(pair_code(trips.PULocationID, trips.DOLocationID))\n     ~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `Column<'PULocationID'>-Column<'DOLocationID'>` cannot be resolved. Did you mean one of the following? [`DOLocationID`, `PULocationID`, `passenger_count`, `tip_amount`, `total_amount`]. SQLSTATE: 42703;\n'Project ['Column<'PULocationID'>-Column<'DOLocationID'>]\n+- Relation [VendorID#17,lpep_pickup_datetime#18,store_and_fwd_flag#19,PULocationID#20,DOLocationID#21,passenger_count#22,trip_distance#23,fare_amount#24,tip_amount#25,total_amount#26] csv"
   },
   "udf.def": {
    "code": "from pyspark.sql.functions import udf\n\n@udf\ndef pair_code(pu, do):\n    \"\"\"Concatenate PULocationID and DOLocationID with a hyphen\"\"\"\n    return f'{pu}-{do}'",
    "out": "",
    "err": null
   },
   "udf.show": {
    "code": "(trips\n     .select(pair_code('PULocationID', 'DOLocationID'))\n     .show()\n)",
    "out": "+-------------------------------------+\n|pair_code(PULocationID, DOLocationID)|\n+-------------------------------------+\n|                               41-238|\n|                               97-137|\n|                                7-261|\n|                                7-179|\n|                               74-166|\n|                               33-140|\n|                               41-238|\n|                                7-260|\n|                                75-41|\n|                                74-75|\n|                                7-223|\n|                               33-143|\n+-------------------------------------+\n\n",
    "err": null
   },
   "udf.schema": {
    "code": "trips.select(pair_code('PULocationID', 'DOLocationID')).printSchema()",
    "out": "root\n |-- pair_code(PULocationID, DOLocationID): string (nullable = true)\n\n",
    "err": null
   },
   "udf.call_values": {
    "code": "pair_code(41, 238)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 20>\", line 1, in <module>\n    pair_code(41, 238)\n    ~~~~~~~~~^^^^^^^^^\n  ...\npyspark.errors.exceptions.base.PySparkTypeError: [NOT_EXPECTED_TYPE] Argument `col` should be Column or str, got int."
   },
   "udf.double_default_def": {
    "code": "@udf\ndef double_fare(fare):\n    \"\"\"Twice the fare\"\"\"\n    return fare * 2",
    "out": "",
    "err": null
   },
   "udf.double_default_show": {
    "code": "trips.select('fare_amount', double_fare('fare_amount')).show(4)",
    "out": "+-----------+------------------------+\n|fare_amount|double_fare(fare_amount)|\n+-----------+------------------------+\n|       11.5|                    23.0|\n|       22.0|                    44.0|\n|       34.5|                    69.0|\n|        4.0|                     8.0|\n+-----------+------------------------+\nonly showing top 4 rows\n",
    "err": null
   },
   "udf.double_default_schema": {
    "code": "trips.select(double_fare('fare_amount')).printSchema()",
    "out": "root\n |-- double_fare(fare_amount): string (nullable = true)\n\n",
    "err": null
   },
   "udf.double_int_def": {
    "code": "@udf('int')\ndef double_fare_int(fare):\n    \"\"\"Twice the fare, declared as an integer\"\"\"\n    return fare * 2",
    "out": "",
    "err": null
   },
   "udf.double_int_show": {
    "code": "trips.select('fare_amount', double_fare_int('fare_amount')).show(4)",
    "out": "+-----------+----------------------------+\n|fare_amount|double_fare_int(fare_amount)|\n+-----------+----------------------------+\n|       11.5|                          23|\n|       22.0|                          44|\n|       34.5|                          69|\n|        4.0|                           8|\n+-----------+----------------------------+\nonly showing top 4 rows\n",
    "err": null
   },
   "udf.double_double_def": {
    "code": "@udf('double')\ndef double_fare_dbl(fare):\n    \"\"\"Twice the fare, declared as a double\"\"\"\n    return fare * 2",
    "out": "",
    "err": null
   },
   "udf.double_double_show": {
    "code": "trips.select('fare_amount', double_fare_dbl('fare_amount')).show(4)",
    "out": "+-----------+----------------------------+\n|fare_amount|double_fare_dbl(fare_amount)|\n+-----------+----------------------------+\n|       11.5|                        23.0|\n|       22.0|                        44.0|\n|       34.5|                        69.0|\n|        4.0|                         8.0|\n+-----------+----------------------------+\nonly showing top 4 rows\n",
    "err": null
   },
   "udf.arrow_def": {
    "code": "@udf(useArrow=True)\ndef pair_code(pu, do):\n    \"\"\"Concatenate PULocationID and DOLocationID with a hyphen\"\"\"\n    return f'{pu}-{do}'",
    "out": "",
    "err": null
   },
   "udf.arrow_show": {
    "code": "(trips\n     .select(pair_code('PULocationID', 'DOLocationID'))\n     .show(4)\n)",
    "out": "+-------------------------------------+\n|pair_code(PULocationID, DOLocationID)|\n+-------------------------------------+\n|                               41-238|\n|                               97-137|\n|                                7-261|\n|                                7-179|\n+-------------------------------------+\nonly showing top 4 rows\n",
    "err": null
   },
   "udf.arrow_int_def": {
    "code": "@udf('int', useArrow=True)\ndef double_fare_int(fare):\n    \"\"\"Twice the fare, declared as an integer\"\"\"\n    return fare * 2",
    "out": "",
    "err": null
   },
   "udf.arrow_int_show": {
    "code": "trips.select('fare_amount', double_fare_int('fare_amount')).show(4)",
    "out": "+-----------+----------------------------+\n|fare_amount|double_fare_int(fare_amount)|\n+-----------+----------------------------+\n|       11.5|                          23|\n|       22.0|                          44|\n|       34.5|                          69|\n|        4.0|                           8|\n+-----------+----------------------------+\nonly showing top 4 rows\n",
    "err": null
   },
   "udf.arrow_conf": {
    "code": "spark.conf.set(\"spark.sql.execution.pythonUDF.arrow.enabled\", \"true\")",
    "out": "",
    "err": null
   },
   "udf.struct_type": {
    "code": "from pyspark.sql.types import StructType, StructField, StringType, LongType\n\nUserInfoType = StructType([\n    StructField('id', LongType()),\n    StructField('user', StructType([\n        StructField('name', StringType()),\n        StructField('description', StringType())\n    ]))\n])\n\nUserInfoType",
    "out": "StructType([StructField('id', LongType(), True), StructField('user', StructType([StructField('name', StringType(), True), StructField('description', StringType(), True)]), True)])\n",
    "err": null
   },
   "udf.struct_def": {
    "code": "@udf(UserInfoType)\ndef collect_user_info(user_id, user_name, user_description):\n    \"\"\"Create column with user ID, user name and description\"\"\"\n    return (user_id, (user_name, user_description))",
    "out": "",
    "err": null
   },
   "udf.struct_show": {
    "code": "(tweets\n    .select(collect_user_info('user.id', 'user.name', 'user.description'))\n    .show())",
    "out": "+-------------------------------------------------------+\n|collect_user_info(user.id, user.name, user.description)|\n+-------------------------------------------------------+\n|                                   {101, {Ana Santos...|\n|                                   {102, {Ben Cruz, ...|\n|                                   {103, {Cara Lee, ...|\n|                                   {104, {Daichi Mor...|\n|                                   {105, {Elena Ramo...|\n|                                   {106, {Frank Hall...|\n|                                    {107, {Gina Tan, }}|\n|                                   {108, {Hugo Diaz,...|\n+-------------------------------------------------------+\n\n",
    "err": null
   },
   "udf.struct_show_full": {
    "code": "(tweets\n    .select(collect_user_info('user.id', 'user.name', 'user.description'))\n    .show(truncate=False))",
    "out": "+-------------------------------------------------------+\n|collect_user_info(user.id, user.name, user.description)|\n+-------------------------------------------------------+\n|{101, {Ana Santos, Nurse. Coffee first.}}              |\n|{102, {Ben Cruz, Food and maps}}                       |\n|{103, {Cara Lee, Sports fan}}                          |\n|{104, {Daichi Mori, Tokyo night owl}}                  |\n|{105, {Elena Ramos, Data analyst}}                     |\n|{106, {Frank Hall, Researcher}}                        |\n|{107, {Gina Tan, }}                                    |\n|{108, {Hugo Diaz, Farmer who codes}}                   |\n+-------------------------------------------------------+\n\n",
    "err": null
   },
   "udf.struct_schema": {
    "code": "(tweets\n    .select(collect_user_info('user.id', 'user.name', 'user.description').alias('info'))\n    .printSchema())",
    "out": "root\n |-- info: struct (nullable = true)\n |    |-- id: long (nullable = true)\n |    |-- user: struct (nullable = true)\n |    |    |-- name: string (nullable = true)\n |    |    |-- description: string (nullable = true)\n\n",
    "err": null
   },
   "udf.ddl_def": {
    "code": "UserInfoType2 = \"\"\"\nid LONG,\nuser STRUCT <\n  name: STRING,\n  description: STRING\n>\n\"\"\"\n\n@udf(UserInfoType2)\ndef collect_user_info2(user_id, user_name, user_description):\n    \"\"\"Create column with user ID, user name and description\"\"\"\n    return (user_id, (user_name, user_description))",
    "out": "",
    "err": null
   },
   "udf.ddl_show": {
    "code": "(tweets\n    .select(collect_user_info2('user.id', 'user.name', 'user.description'))\n    .show(truncate=False))",
    "out": "+--------------------------------------------------------+\n|collect_user_info2(user.id, user.name, user.description)|\n+--------------------------------------------------------+\n|{101, {Ana Santos, Nurse. Coffee first.}}               |\n|{102, {Ben Cruz, Food and maps}}                        |\n|{103, {Cara Lee, Sports fan}}                           |\n|{104, {Daichi Mori, Tokyo night owl}}                   |\n|{105, {Elena Ramos, Data analyst}}                      |\n|{106, {Frank Hall, Researcher}}                         |\n|{107, {Gina Tan, }}                                     |\n|{108, {Hugo Diaz, Farmer who codes}}                    |\n+--------------------------------------------------------+\n\n",
    "err": null
   },
   "udf.struct_dot": {
    "code": "(tweets\n    .select(collect_user_info2('user.id', 'user.name', 'user.description').alias('info'))\n    .select('info.user.name')\n    .show(3))",
    "out": "+----------+\n|      name|\n+----------+\n|Ana Santos|\n|  Ben Cruz|\n|  Cara Lee|\n+----------+\nonly showing top 3 rows\n",
    "err": null
   },
   "rt.str_for_int_def": {
    "code": "@udf('int')\ndef zone_label(pu):\n    \"\"\"The pickup zone as text\"\"\"\n    return f'zone {pu}'",
    "out": "",
    "err": null
   },
   "rt.str_for_int_show": {
    "code": "trips.select('PULocationID', zone_label('PULocationID')).show(3)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 9>\", line 1, in <module>\n    trips.select('PULocationID', zone_label('PULocationID')).show(3)\n    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^\n  ...\npyspark.errors.exceptions.captured.PythonException: An exception was thrown from the Python worker:\nTraceback (most recent call last):\n  ...\npyarrow.lib.ArrowInvalid: Failed to parse string: 'zone 7' as a scalar of type int32"
   },
   "rt.str_digits_for_int_def": {
    "code": "@udf('int')\ndef zone_text(pu):\n    \"\"\"The pickup zone as a string of digits\"\"\"\n    return str(pu)",
    "out": "",
    "err": null
   },
   "rt.str_digits_for_int_show": {
    "code": "trips.select('PULocationID', zone_text('PULocationID')).show(3)",
    "out": "+------------+-----------------------+\n|PULocationID|zone_text(PULocationID)|\n+------------+-----------------------+\n|          41|                     41|\n|          97|                     97|\n|           7|                      7|\n+------------+-----------------------+\nonly showing top 3 rows\n",
    "err": null
   },
   "pd.clip_def": {
    "code": "import numpy as np\nimport pandas as pd\nfrom pyspark.sql.functions import pandas_udf\nfrom pyspark.sql.types import FloatType\n\n@pandas_udf(returnType=FloatType())\ndef clip_0_to_100(s: pd.Series) -> pd.Series:\n    \"\"\"Limit values to between 0 and 100\"\"\"\n    return np.clip(s, 0, 100)",
    "out": "",
    "err": null
   },
   "pd.clip_show": {
    "code": "(trips\n    .select(clip_0_to_100(trips.trip_distance).alias('clipped_distance'))\n    .show())",
    "out": "+----------------+\n|clipped_distance|\n+----------------+\n|            1.94|\n|            5.08|\n|             9.8|\n|            0.37|\n|             1.4|\n|             8.1|\n|            1.76|\n|            1.51|\n|            1.56|\n|             1.0|\n|            2.15|\n|             7.1|\n+----------------+\n\n",
    "err": null
   },
   "pd.clip5_def": {
    "code": "@pandas_udf(returnType=FloatType())\ndef clip_0_to_5(s: pd.Series) -> pd.Series:\n    \"\"\"Limit values to between 0 and 5\"\"\"\n    return np.clip(s, 0, 5)",
    "out": "",
    "err": null
   },
   "pd.clip5_show": {
    "code": "(trips\n    .select('trip_distance', clip_0_to_5(trips.trip_distance).alias('clipped'))\n    .show())",
    "out": "+-------------+-------+\n|trip_distance|clipped|\n+-------------+-------+\n|         1.94|   1.94|\n|         5.08|    5.0|\n|          9.8|    5.0|\n|         0.37|   0.37|\n|          1.4|    1.4|\n|          8.1|    5.0|\n|         1.76|   1.76|\n|         1.51|   1.51|\n|         1.56|   1.56|\n|          1.0|    1.0|\n|         2.15|   2.15|\n|          7.1|    5.0|\n+-------------+-------+\n\n",
    "err": null
   },
   "pd.batch_def": {
    "code": "@pandas_udf('long')\ndef batch_size(s: pd.Series) -> pd.Series:\n    \"\"\"How many rows arrived together in this call\"\"\"\n    return pd.Series([len(s)] * len(s))",
    "out": "",
    "err": null
   },
   "pd.batch_show": {
    "code": "trips.select('PULocationID', batch_size('PULocationID')).show(3)",
    "out": "+------------+------------------------+\n|PULocationID|batch_size(PULocationID)|\n+------------+------------------------+\n|          41|                       4|\n|          97|                       4|\n|           7|                       4|\n+------------+------------------------+\nonly showing top 3 rows\n",
    "err": null
   },
   "pd.batch_small": {
    "code": "spark.conf.set(\"spark.sql.execution.arrow.maxRecordsPerBatch\", \"5\")\ntrips.select('PULocationID', batch_size('PULocationID')).show()\nspark.conf.set(\"spark.sql.execution.arrow.maxRecordsPerBatch\", \"10000\")",
    "out": "+------------+------------------------+\n|PULocationID|batch_size(PULocationID)|\n+------------+------------------------+\n|          41|                       5|\n|          97|                       5|\n|           7|                       5|\n|           7|                       5|\n|          74|                       5|\n|          33|                       5|\n|          41|                       5|\n|           7|                       5|\n|          75|                       5|\n|          74|                       5|\n|           7|                       2|\n|          33|                       2|\n+------------+------------------------+\n\n",
    "err": null
   },
   "pd.seeds": {
    "code": "import json\nwith open('seeds.json') as f:\n    seeds = json.load(f)\nseeds",
    "out": "{'a': 193602, 'b': 15914, 'c': 1}\n",
    "err": null
   },
   "pd.mask_id": {
    "code": "import json\nfrom typing import Iterator\n\n@pandas_udf('long')\ndef mask_id(ids: Iterator[pd.Series]) -> Iterator[pd.Series]:\n    \"\"\"Compute hash of ids\"\"\"\n    with open('seeds.json') as f:\n        seeds = json.load(f)\n    a = seeds['a']\n    b = seeds['b']\n    c = seeds['c']\n    for x in ids:\n        yield (a * x + b) % c\n\n(tweets\n     .select(mask_id('id'))\n     .show())",
    "out": "+-----------+\n|mask_id(id)|\n+-----------+\n|          0|\n|          0|\n|          0|\n|          0|\n|          0|\n|          0|\n|          0|\n|          0|\n+-----------+\n\n",
    "err": null
   },
   "pd.mask_demo": {
    "code": "@pandas_udf('long')\ndef mask_demo(ids: Iterator[pd.Series]) -> Iterator[pd.Series]:\n    \"\"\"The same hash with c = 1000\"\"\"\n    a, b, c = 193602, 15914, 1000\n    for x in ids:\n        yield (a * x + b) % c\n\n(tweets\n     .select('user.id', mask_demo('user.id'))\n     .show())",
    "out": "+---+------------------+\n| id|mask_demo(user.id)|\n+---+------------------+\n|101|               716|\n|102|               318|\n|103|               920|\n|104|               522|\n|105|               124|\n|106|               726|\n|107|               328|\n|108|               930|\n+---+------------------+\n\n",
    "err": null
   },
   "pd.mask_return": {
    "code": "@pandas_udf('long')\ndef mask_bad(ids: Iterator[pd.Series]) -> Iterator[pd.Series]:\n    \"\"\"The hash, with return instead of yield\"\"\"\n    a, b, c = 193602, 15914, 1000\n    for x in ids:\n        return (a * x + b) % c\n\n(tweets\n     .select('user.id', mask_bad('user.id'))\n     .show())",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 22>\", line 10, in <module>\n    .show())\n     ~~~~^^\n  ...\npyspark.errors.exceptions.captured.PythonException: An exception was thrown from the Python worker:\nTraceback (most recent call last):\n  ...\npyspark.errors.exceptions.base.PySparkTypeError: [UDF_RETURN_TYPE] Return type of the user-defined function should be iterator of pandas.Series, but is Series."
   },
   "pd.mask_nohint": {
    "code": "@pandas_udf('long')\ndef mask_plain(ids):\n    \"\"\"The hash, without type hints\"\"\"\n    a, b, c = 193602, 15914, 1000\n    for x in ids:\n        yield (a * x + b) % c",
    "out": "",
    "err": null
   },
   "pd.fare_rate": {
    "code": "from typing import Iterator, Tuple\nfrom pyspark.sql.functions import struct, col\n\n@pandas_udf('float')\ndef fare_rate(iterator: Iterator[Tuple[pd.Series, pd.Series]]) \\\n        -> Iterator[pd.Series]:\n    \"\"\"Compute fare rate\"\"\"\n    for trip_distance, fare_amount in iterator:\n        yield fare_amount / trip_distance\n\n(trips\n    .select(fare_rate('trip_distance', 'fare_amount'))\n    .show())",
    "out": "+-------------------------------------+\n|fare_rate(trip_distance, fare_amount)|\n+-------------------------------------+\n|                             5.927835|\n|                            4.3307085|\n|                            3.5204082|\n|                            10.810811|\n|                             6.071429|\n|                             3.580247|\n|                             6.818182|\n|                             5.298013|\n|                            5.1282053|\n|                                  6.0|\n|                             4.883721|\n|                             4.366197|\n+-------------------------------------+\n\n",
    "err": null
   },
   "pd.fare_rate_one": {
    "code": "(trips\n    .select(fare_rate('trip_distance'))\n    .show())",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 25>\", line 3, in <module>\n    .show())\n     ~~~~^^\n  ...\n  File \"<cell 24>\", line 8, in fare_rate\n    for trip_distance, fare_amount in iterator:\n      ^^^^^^^^^^^^^^^^^\npyspark.errors.exceptions.captured.PythonException: An exception was thrown from the Python worker:\nTraceback (most recent call last):\n  File \"<cell 24>\", line 8, in fare_rate\nValueError: too many values to unpack (expected 2)"
   },
   "pd.mean_udf": {
    "code": "@pandas_udf('double')\ndef mean_udf(v: pd.Series) -> float:\n    \"\"\"Compute mean of v\"\"\"\n    return v.mean()\n\n(tweets\n     .groupby('place.country_code')\n     .agg(mean_udf(tweets.user.statuses_count))\n     .show())",
    "out": "+------------+-----------------------------+\n|country_code|mean_udf(user.statuses_count)|\n+------------+-----------------------------+\n|        NULL|                       2550.0|\n|          JP|                        640.0|\n|          PH|                       1550.0|\n|          US|                       1500.0|\n+------------+-----------------------------+\n\n",
    "err": null
   },
   "pd.mean_udf_all": {
    "code": "(tweets\n     .agg(mean_udf(tweets.user.statuses_count))\n     .show())",
    "out": "+-----------------------------+\n|mean_udf(user.statuses_count)|\n+-----------------------------+\n|                      1673.75|\n+-----------------------------+\n\n",
    "err": null
   },
   "pd.mean_udf_select": {
    "code": "(tweets\n     .select(mean_udf(tweets.user.statuses_count))\n     .show())",
    "out": "+-----------------------------+\n|mean_udf(user.statuses_count)|\n+-----------------------------+\n|                      1673.75|\n+-----------------------------+\n\n",
    "err": null
   },
   "pd.clip_in_agg": {
    "code": "(trips\n     .groupby('VendorID')\n     .agg(clip_0_to_100(trips.trip_distance))\n     .show())",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 29>\", line 3, in <module>\n    .agg(clip_0_to_100(trips.trip_distance))\n     ~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [MISSING_AGGREGATION] The non-aggregating expression \"trip_distance\" is based on columns which are not participating in the GROUP BY clause.\nAdd the columns or the expression to the GROUP BY, aggregate the expression, or use \"any_value(trip_distance)\" if you do not care which of the values within a group is returned. SQLSTATE: 42803;\nAggregate [VendorID#17], [VendorID#17, clip_0_to_100(trip_distance#23)#209 AS clip_0_to_100(trip_distance)#220]\n+- Relation [VendorID#17,lpep_pickup_datetime#18,store_and_fwd_flag#19,PULocationID#20,DOLocationID#21,passenger_count#22,trip_distance#23,fare_amount#24,tip_amount#25,total_amount#26] csv"
   },
   "pd.standardize_def": {
    "code": "def standardize_fares(s):\n    return pd.DataFrame({'normed_fare': s['fare_amount'].astype(float) /\n                         s['fare_amount'].astype(float).max()})",
    "out": "",
    "err": null
   },
   "pd.standardize_show": {
    "code": "(trips\n   .groupby('VendorID')\n   .applyInPandas(standardize_fares, schema=\"normed_fare FLOAT\")\n   .show()\n)",
    "out": "+-----------+\n|normed_fare|\n+-----------+\n|        1.0|\n| 0.17391305|\n| 0.89855075|\n| 0.39655173|\n|  0.7586207|\n| 0.13793103|\n| 0.29310346|\n|        1.0|\n| 0.41379312|\n| 0.27586207|\n| 0.27586207|\n| 0.36206895|\n+-----------+\n\n",
    "err": null
   },
   "pd.standardize_keep": {
    "code": "def standardize_keep(s):\n    return pd.DataFrame({'VendorID': s['VendorID'],\n                         'fare_amount': s['fare_amount'],\n                         'normed_fare': s['fare_amount'] / s['fare_amount'].max()})\n\n(trips\n   .groupby('VendorID')\n   .applyInPandas(standardize_keep,\n                  schema=\"VendorID INT, fare_amount DOUBLE, normed_fare DOUBLE\")\n   .show()\n)",
    "out": "+--------+-----------+-------------------+\n|VendorID|fare_amount|        normed_fare|\n+--------+-----------+-------------------+\n|       1|       34.5|                1.0|\n|       1|        6.0|0.17391304347826086|\n|       1|       31.0| 0.8985507246376812|\n|       2|       11.5|0.39655172413793105|\n|       2|       22.0| 0.7586206896551724|\n|       2|        4.0|0.13793103448275862|\n|       2|        8.5|0.29310344827586204|\n|       2|       29.0|                1.0|\n|       2|       12.0|0.41379310344827586|\n|       2|        8.0|0.27586206896551724|\n|       2|        8.0|0.27586206896551724|\n|       2|       10.5| 0.3620689655172414|\n+--------+-----------+-------------------+\n\n",
    "err": null
   },
   "sql.before_view": {
    "code": "trips = spark.read.csv('taxi12.csv', sep=',', header=True, inferSchema=True)\nspark.sql(\"SELECT PULocationID, fare_amount FROM trips WHERE fare_amount > 20\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 5>\", line 2, in <module>\n    spark.sql(\"SELECT PULocationID, fare_amount FROM trips WHERE fare_amount > 20\").show()\n    ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [TABLE_OR_VIEW_NOT_FOUND] The table or view `trips` cannot be found. Verify the spelling and correctness of the schema and catalog.\nSearch path: [`system`.`builtin`, `system`.`session`, `spark_catalog`.`default`].\nIf you did not qualify the name with a schema, verify the current_schema() output, or qualify the name with the correct schema and catalog.\nTo tolerate the error on drop use DROP VIEW IF EXISTS or DROP TABLE IF EXISTS. SQLSTATE: 42P01; line 1 pos 38;\n'Project ['PULocationID, 'fare_amount]\n+- 'Filter ('fare_amount > 20)\n   +- 'UnresolvedRelation [trips], [], false"
   },
   "sql.view_trips": {
    "code": "trips.createOrReplaceTempView('trips')",
    "out": "",
    "err": null
   },
   "sql.view_tweets": {
    "code": "tweets.createOrReplaceTempView('tweets')",
    "out": "",
    "err": null
   },
   "sql.where": {
    "code": "spark.sql(\"SELECT PULocationID, fare_amount FROM trips WHERE fare_amount > 20\").show()",
    "out": "+------------+-----------+\n|PULocationID|fare_amount|\n+------------+-----------+\n|          97|       22.0|\n|           7|       34.5|\n|          33|       29.0|\n|          33|       31.0|\n+------------+-----------+\n\n",
    "err": null
   },
   "sql.type": {
    "code": "type(spark.sql(\"SELECT * FROM trips\"))",
    "out": "<class 'pyspark.sql.classic.dataframe.DataFrame'>\n",
    "err": null
   },
   "sql.select": {
    "code": "(spark.sql(\n    \"\"\"\n    SELECT\n        VendorID,\n        CAST(PULocationID as INT),\n        DOLocationID as dropoff,\n        HOUR(lpep_pickup_datetime)\n    FROM trips\n    WHERE VendorID == 1\n    LIMIT 10\n    \"\"\")\n    .withColumn('double vendor', trips['VendorID'] * 2)\n    .show())",
    "out": "+--------+------------+-------+--------------------------+-------------+\n|VendorID|PULocationID|dropoff|hour(lpep_pickup_datetime)|double vendor|\n+--------+------------+-------+--------------------------+-------------+\n|       1|           7|    261|                         8|            2|\n|       1|          74|     75|                         8|            2|\n|       1|          33|    143|                        10|            2|\n+--------+------------+-------+--------------------------+-------------+\n\n",
    "err": null
   },
   "sql.explain": {
    "code": "(spark.sql(\n    \"\"\"\n    SELECT PULocationID, fare_amount\n    FROM trips\n    WHERE fare_amount > 20\n    \"\"\")\n    .explain())",
    "out": "== Physical Plan ==\n*(1) Filter (isnotnull(fare_amount#24) AND (fare_amount#24 > 20.0))\n+- FileScan csv [PULocationID#20,fare_amount#24] Batched: false, DataFilters: [isnotnull(fare_amount#24), (fare_amount#24 > 20.0)], Format: CSV, Location: InMemoryFileIndex(1 paths)[file:<work>/..., PartitionFilters: [], PushedFilters: [IsNotNull(fare_amount), GreaterThan(fare_amount,20.0)], ReadSchema: struct<PULocationID:int,fare_amount:double>\n\n\n",
    "err": null
   },
   "sql.tweets_nested": {
    "code": "spark.sql(\"\"\"\nSELECT user.name, user.statuses_count, place.country_code\nFROM tweets\nWHERE user.statuses_count > 1000\n\"\"\").show()",
    "out": "+-----------+--------------+------------+\n|       name|statuses_count|country_code|\n+-----------+--------------+------------+\n| Ana Santos|          1200|          PH|\n|Elena Ramos|          3000|          PH|\n| Frank Hall|          2200|          US|\n|  Hugo Diaz|          5010|        NULL|\n+-----------+--------------+------------+\n\n",
    "err": null
   },
   "sql.udf_before_register": {
    "code": "spark.sql(\"\"\"\nSELECT pair_code(PULocationID, DOLocationID)\nFROM trips\nLIMIT 10\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 41>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT pair_code(PULocationID, DOLocationID)\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    FROM trips\n    ^^^^^^^^^^\n    LIMIT 10\n    ^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [UNRESOLVED_ROUTINE] Cannot resolve routine `pair_code` on search path [`system`.`builtin`, `system`.`session`, `spark_catalog`.`default`]. SQLSTATE: 42883; line 2 pos 7"
   },
   "sql.register_pair": {
    "code": "spark.udf.register(\"pair_code\", pair_code);",
    "out": "",
    "err": null
   },
   "sql.pair_show": {
    "code": "spark.sql(\"\"\"\nSELECT pair_code(PULocationID, DOLocationID)\nFROM trips\nLIMIT 10\n\"\"\").show()",
    "out": "+-------------------------------------+\n|pair_code(PULocationID, DOLocationID)|\n+-------------------------------------+\n|                               41-238|\n|                               97-137|\n|                                7-261|\n|                                7-179|\n|                               74-166|\n|                               33-140|\n|                               41-238|\n|                                7-260|\n|                                75-41|\n|                                74-75|\n+-------------------------------------+\n\n",
    "err": null
   },
   "sql.register_double": {
    "code": "spark.udf.register('double_distance', lambda x: x*2, 'FLOAT');",
    "out": "",
    "err": null
   },
   "sql.double_show": {
    "code": "spark.sql(\"\"\"\nSELECT double_distance(CAST(trip_distance AS FLOAT))\nFROM trips\nLIMIT 10\n\"\"\").show()",
    "out": "+---------------------------------------------+\n|double_distance(cast(trip_distance as float))|\n+---------------------------------------------+\n|                                         3.88|\n|                                        10.16|\n|                                         19.6|\n|                                         0.74|\n|                                          2.8|\n|                                         16.2|\n|                                         3.52|\n|                                         3.02|\n|                                         3.12|\n|                                          2.0|\n+---------------------------------------------+\n\n",
    "err": null
   },
   "sql.case_when": {
    "code": "spark.sql(\"\"\"\nSELECT\n    double_distance(CAST(trip_distance AS FLOAT)) AS dd,\n    (CASE\n        WHEN\n            double_distance(CAST(trip_distance AS FLOAT)) > 10\n        THEN\n            'long'\n        ELSE\n            'short'\n    END) AS trip_type\nFROM trips\nLIMIT 10\n\"\"\").show()",
    "out": "+-----+---------+\n|   dd|trip_type|\n+-----+---------+\n| 3.88|    short|\n|10.16|     long|\n| 19.6|     long|\n| 0.74|    short|\n|  2.8|    short|\n| 16.2|     long|\n| 3.52|    short|\n| 3.02|    short|\n| 3.12|    short|\n|  2.0|    short|\n+-----+---------+\n\n",
    "err": null
   },
   "sql.case_when_all": {
    "code": "spark.sql(\"\"\"\nSELECT\n    trip_distance,\n    (CASE\n        WHEN double_distance(CAST(trip_distance AS FLOAT)) > 10 THEN 'long'\n        ELSE 'short'\n    END) AS trip_type\nFROM trips\n\"\"\").show()",
    "out": "+-------------+---------+\n|trip_distance|trip_type|\n+-------------+---------+\n|         1.94|    short|\n|         5.08|     long|\n|          9.8|     long|\n|         0.37|    short|\n|          1.4|    short|\n|          8.1|     long|\n|         1.76|    short|\n|         1.51|    short|\n|         1.56|    short|\n|          1.0|    short|\n|         2.15|    short|\n|          7.1|     long|\n+-------------+---------+\n\n",
    "err": null
   },
   "sql.register_notype": {
    "code": "spark.udf.register('double_distance_s', lambda x: x*2);",
    "out": "",
    "err": null
   },
   "sql.notype_show": {
    "code": "spark.sql(\"\"\"\nSELECT trip_distance, double_distance_s(trip_distance) AS dd\nFROM trips\nORDER BY dd DESC\n\"\"\").show()",
    "out": "+-------------+-----+\n|trip_distance|   dd|\n+-------------+-----+\n|         2.15|  4.3|\n|         1.94| 3.88|\n|         1.76| 3.52|\n|         1.56| 3.12|\n|         1.51| 3.02|\n|          1.4|  2.8|\n|          1.0|  2.0|\n|          9.8| 19.6|\n|          8.1| 16.2|\n|          7.1| 14.2|\n|         5.08|10.16|\n|         0.37| 0.74|\n+-------------+-----+\n\n",
    "err": null
   },
   "sql.typed_order": {
    "code": "spark.sql(\"\"\"\nSELECT trip_distance, double_distance(CAST(trip_distance AS FLOAT)) AS dd\nFROM trips\nORDER BY dd DESC\n\"\"\").show()",
    "out": "+-------------+-----+\n|trip_distance|   dd|\n+-------------+-----+\n|          9.8| 19.6|\n|          8.1| 16.2|\n|          7.1| 14.2|\n|         5.08|10.16|\n|         2.15|  4.3|\n|         1.94| 3.88|\n|         1.76| 3.52|\n|         1.56| 3.12|\n|         1.51| 3.02|\n|          1.4|  2.8|\n|          1.0|  2.0|\n|         0.37| 0.74|\n+-------------+-----+\n\n",
    "err": null
   },
   "sql.clip_show": {
    "code": "spark.sql(\"\"\"\nSELECT clip_0_to_100(CAST(trip_distance AS FLOAT))\nFROM trips\nLIMIT 10\n\"\"\").show()",
    "out": "+-------------------------------------------+\n|clip_0_to_100(cast(trip_distance as float))|\n+-------------------------------------------+\n|                                       1.94|\n|                                       5.08|\n|                                        9.8|\n|                                       0.37|\n|                                        1.4|\n|                                        8.1|\n|                                       1.76|\n|                                       1.51|\n|                                       1.56|\n|                                        1.0|\n+-------------------------------------------+\n\n",
    "err": null
   },
   "sql.alias_space_bad": {
    "code": "spark.sql(\"\"\"\nSELECT VendorID, AVG(tip_amount) AS mean tip\nFROM trips\nGROUP BY VendorID\nORDER BY VendorID\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 53>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT VendorID, AVG(tip_amount) AS mean tip\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    ...<2 lines>...\n    ORDER BY VendorID\n    ^^^^^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.ParseException: \n[PARSE_SYNTAX_ERROR] Syntax error at or near 'tip'. SQLSTATE: 42601 (line 2, pos 41)\n\n== SQL ==\n\nSELECT VendorID, AVG(tip_amount) AS mean tip\n-----------------------------------------^^^\nFROM trips\nGROUP BY VendorID\nORDER BY VendorID"
   },
   "sql.alias_space_ok": {
    "code": "spark.sql(\"\"\"\nSELECT VendorID, AVG(tip_amount) AS `mean tip`\nFROM trips\nGROUP BY VendorID\nORDER BY VendorID\n\"\"\").show()",
    "out": "+--------+------------------+\n|VendorID|          mean tip|\n+--------+------------------+\n|       1| 4.116666666666666|\n|       2|1.3055555555555556|\n+--------+------------------+\n\n",
    "err": null
   },
   "sql.alias_single_quotes": {
    "code": "spark.sql(\"\"\"\nSELECT VendorID, AVG(tip_amount) AS 'mean tip'\nFROM trips\nGROUP BY VendorID\nORDER BY VendorID\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 55>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT VendorID, AVG(tip_amount) AS 'mean tip'\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    ...<2 lines>...\n    ORDER BY VendorID\n    ^^^^^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.ParseException: \n[PARSE_SYNTAX_ERROR] Syntax error at or near ''mean tip''. SQLSTATE: 42601 (line 2, pos 36)\n\n== SQL ==\n\nSELECT VendorID, AVG(tip_amount) AS 'mean tip'\n------------------------------------^^^\nFROM trips\nGROUP BY VendorID\nORDER BY VendorID"
   },
   "sql.alias_none": {
    "code": "spark.sql(\"\"\"\nSELECT VendorID, AVG(tip_amount)\nFROM trips\nGROUP BY VendorID\nORDER BY VendorID\n\"\"\").show()",
    "out": "+--------+------------------+\n|VendorID|   avg(tip_amount)|\n+--------+------------------+\n|       1| 4.116666666666666|\n|       2|1.3055555555555556|\n+--------+------------------+\n\n",
    "err": null
   },
   "sql.group_count": {
    "code": "spark.sql(\"\"\"\nSELECT PULocationID, COUNT(*) AS trips\nFROM trips\nGROUP BY PULocationID\nORDER BY trips DESC, PULocationID\n\"\"\").show()",
    "out": "+------------+-----+\n|PULocationID|trips|\n+------------+-----+\n|           7|    4|\n|          33|    2|\n|          41|    2|\n|          74|    2|\n|          75|    1|\n|          97|    1|\n+------------+-----+\n\n",
    "err": null
   },
   "sql.group_missing": {
    "code": "spark.sql(\"\"\"\nSELECT PULocationID, VendorID, COUNT(*) AS trips\nFROM trips\nGROUP BY PULocationID\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 58>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT PULocationID, VendorID, COUNT(*) AS trips\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    FROM trips\n    ^^^^^^^^^^\n    GROUP BY PULocationID\n    ^^^^^^^^^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [MISSING_AGGREGATION] The non-aggregating expression \"VendorID\" is based on columns which are not participating in the GROUP BY clause.\nAdd the columns or the expression to the GROUP BY, aggregate the expression, or use \"any_value(VendorID)\" if you do not care which of the values within a group is returned. SQLSTATE: 42803;\nAggregate [PULocationID#20], [PULocationID#20, VendorID#17, count(1) AS trips#431L]\n+- SubqueryAlias trips\n   +- View (`trips`, [VendorID#17, lpep_pickup_datetime#18, store_and_fwd_flag#19, PULocationID#20, DOLocationID#21, passenger_count#22, trip_distance#23, fare_amount#24, tip_amount#25, total_amount#26])\n      +- Relation [VendorID#17,lpep_pickup_datetime#18,store_and_fwd_flag#19,PULocationID#20,DOLocationID#21,passenger_count#22,trip_distance#23,fare_amount#24,tip_amount#25,total_amount#26] csv"
   },
   "sql.typo_column": {
    "code": "spark.sql(\"SELECT PULocationID, fare_amt FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 59>\", line 1, in <module>\n    spark.sql(\"SELECT PULocationID, fare_amt FROM trips\").show()\n    ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [UNRESOLVED_COLUMN.WITH_SUGGESTION] A column, variable, or function parameter with name `fare_amt` cannot be resolved. Did you mean one of the following? [`fare_amount`, `tip_amount`, `VendorID`, `total_amount`, `trip_distance`]. SQLSTATE: 42703; line 1 pos 21;\n'Project [PULocationID#20, 'fare_amt]\n+- SubqueryAlias trips\n   +- View (`trips`, [VendorID#17, lpep_pickup_datetime#18, store_and_fwd_flag#19, PULocationID#20, DOLocationID#21, passenger_count#22, trip_distance#23, fare_amount#24, tip_amount#25, total_amount#26])\n      +- Relation [VendorID#17,lpep_pickup_datetime#18,store_and_fwd_flag#19,PULocationID#20,DOLocationID#21,passenger_count#22,trip_distance#23,fare_amount#24,tip_amount#25,total_amount#26] csv"
   },
   "sql.view_is_live": {
    "code": "cheap = trips.filter(trips.fare_amount < 10)\ncheap.createOrReplaceTempView('cheap')\nspark.sql(\"SELECT COUNT(*) AS n FROM cheap\").show()",
    "out": "+---+\n|  n|\n+---+\n|  5|\n+---+\n\n",
    "err": null
   },
   "ar.default": {
    "code": "spark.conf.get(\"spark.sql.execution.pythonUDF.arrow.enabled\")",
    "out": "'true'\n",
    "err": null
   },
   "ar.int_pickle_def": {
    "code": "from pyspark.sql.functions import udf\n\n@udf('int', useArrow=False)\ndef double_fare_int(fare):\n    \"\"\"Twice the fare, declared as an integer\"\"\"\n    return fare * 2",
    "out": "",
    "err": null
   },
   "ar.int_pickle_show": {
    "code": "trips.select('fare_amount', double_fare_int('fare_amount')).show(4)",
    "out": "+-----------+----------------------------+\n|fare_amount|double_fare_int(fare_amount)|\n+-----------+----------------------------+\n|       11.5|                        NULL|\n|       22.0|                        NULL|\n|       34.5|                        NULL|\n|        4.0|                        NULL|\n+-----------+----------------------------+\nonly showing top 4 rows\n",
    "err": null
   },
   "ar.int_arrow_def": {
    "code": "@udf('int', useArrow=True)\ndef double_fare_int(fare):\n    \"\"\"Twice the fare, declared as an integer\"\"\"\n    return fare * 2",
    "out": "",
    "err": null
   },
   "ar.int_arrow_show": {
    "code": "trips.select('fare_amount', double_fare_int('fare_amount')).show(4)",
    "out": "+-----------+----------------------------+\n|fare_amount|double_fare_int(fare_amount)|\n+-----------+----------------------------+\n|       11.5|                          23|\n|       22.0|                          44|\n|       34.5|                          69|\n|        4.0|                           8|\n+-----------+----------------------------+\nonly showing top 4 rows\n",
    "err": null
   },
   "ar.str_pickle_def": {
    "code": "@udf(useArrow=False)\ndef double_fare(fare):\n    \"\"\"Twice the fare\"\"\"\n    return fare * 2",
    "out": "",
    "err": null
   },
   "ar.str_pickle_show": {
    "code": "trips.select('fare_amount', double_fare('fare_amount')).show(4)",
    "out": "+-----------+------------------------+\n|fare_amount|double_fare(fare_amount)|\n+-----------+------------------------+\n|       11.5|                    23.0|\n|       22.0|                    44.0|\n|       34.5|                    69.0|\n|        4.0|                     8.0|\n+-----------+------------------------+\nonly showing top 4 rows\n",
    "err": null
   },
   "ar.label_pickle_def": {
    "code": "@udf('int', useArrow=False)\ndef zone_label(pu):\n    \"\"\"The pickup zone as text\"\"\"\n    return f'zone {pu}'",
    "out": "",
    "err": null
   },
   "ar.label_pickle_show": {
    "code": "trips.select('PULocationID', zone_label('PULocationID')).show(3)",
    "out": "+------------+------------------------+\n|PULocationID|zone_label(PULocationID)|\n+------------+------------------------+\n|          41|                    NULL|\n|          97|                    NULL|\n|           7|                    NULL|\n+------------+------------------------+\nonly showing top 3 rows\n",
    "err": null
   },
   "ar.label_arrow_def": {
    "code": "@udf('int', useArrow=True)\ndef zone_label(pu):\n    \"\"\"The pickup zone as text\"\"\"\n    return f'zone {pu}'",
    "out": "",
    "err": null
   },
   "ar.label_arrow_show": {
    "code": "trips.select('PULocationID', zone_label('PULocationID')).show(3)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 15>\", line 1, in <module>\n    trips.select('PULocationID', zone_label('PULocationID')).show(3)\n    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^\n  ...\npyspark.errors.exceptions.captured.PythonException: An exception was thrown from the Python worker:\nTraceback (most recent call last):\n  ...\npyarrow.lib.ArrowInvalid: Failed to parse string: 'zone 7' as a scalar of type int32"
   },
   "ar.bool_pickle_def": {
    "code": "@udf('boolean', useArrow=False)\ndef band(distance):\n    \"\"\"'long' for a trip over 5 miles, else 'short'\"\"\"\n    return 'long' if distance > 5 else 'short'",
    "out": "",
    "err": null
   },
   "ar.bool_pickle_show": {
    "code": "trips.select('trip_distance', band('trip_distance')).show(3)",
    "out": "+-------------+-------------------+\n|trip_distance|band(trip_distance)|\n+-------------+-------------------+\n|         1.94|               NULL|\n|         5.08|               NULL|\n|          9.8|               NULL|\n+-------------+-------------------+\nonly showing top 3 rows\n",
    "err": null
   },
   "ar.bool_arrow_def": {
    "code": "@udf('boolean', useArrow=True)\ndef band(distance):\n    \"\"\"'long' for a trip over 5 miles, else 'short'\"\"\"\n    return 'long' if distance > 5 else 'short'",
    "out": "",
    "err": null
   },
   "ar.bool_arrow_show": {
    "code": "trips.select('trip_distance', band('trip_distance')).show(3)",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 19>\", line 1, in <module>\n    trips.select('trip_distance', band('trip_distance')).show(3)\n    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^\n  ...\npyspark.errors.exceptions.captured.PythonException: An exception was thrown from the Python worker:\nTraceback (most recent call last):\n  ...\npyarrow.lib.ArrowInvalid: Failed to parse value: short"
   },
   "pd.batch_show_all": {
    "code": "trips.select('PULocationID', batch_size('PULocationID')).show()",
    "out": "+------------+------------------------+\n|PULocationID|batch_size(PULocationID)|\n+------------+------------------------+\n|          41|                      12|\n|          97|                      12|\n|           7|                      12|\n|           7|                      12|\n|          74|                      12|\n|          33|                      12|\n|          41|                      12|\n|           7|                      12|\n|          75|                      12|\n|          74|                      12|\n|           7|                      12|\n|          33|                      12|\n+------------+------------------------+\n\n",
    "err": null
   },
   "app.c1": {
    "code": "trips = spark.read.csv('taxi12.csv', header=True, inferSchema=True)\nspark.sql(\"SELECT COUNT(*) AS n FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 1>\", line 2, in <module>\n    spark.sql(\"SELECT COUNT(*) AS n FROM trips\").show()\n    ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [TABLE_OR_VIEW_NOT_FOUND] The table or view `trips` cannot be found. Verify the spelling and correctness of the schema and catalog.\nSearch path: [`system`.`builtin`, `system`.`session`, `spark_catalog`.`default`].\nIf you did not qualify the name with a schema, verify the current_schema() output, or qualify the name with the correct schema and catalog.\nTo tolerate the error on drop use DROP VIEW IF EXISTS or DROP TABLE IF EXISTS. SQLSTATE: 42P01; line 1 pos 26;\n'Aggregate [count(1) AS n#77L]\n+- 'UnresolvedRelation [trips], [], false"
   },
   "app.c1.taxi": {
    "code": "trips.createOrReplaceTempView('taxi')\nspark.sql(\"SELECT COUNT(*) AS n FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 1>\", line 2, in <module>\n    spark.sql(\"SELECT COUNT(*) AS n FROM trips\").show()\n    ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [TABLE_OR_VIEW_NOT_FOUND] The table or view `trips` cannot be found. Verify the spelling and correctness of the schema and catalog.\nSearch path: [`system`.`builtin`, `system`.`session`, `spark_catalog`.`default`].\nIf you did not qualify the name with a schema, verify the current_schema() output, or qualify the name with the correct schema and catalog.\nTo tolerate the error on drop use DROP VIEW IF EXISTS or DROP TABLE IF EXISTS. SQLSTATE: 42P01; line 1 pos 26;\n'Aggregate [count(1) AS n#79L]\n+- 'UnresolvedRelation [trips], [], false"
   },
   "app.c1.register": {
    "code": "spark.udf.register('trips', trips)\nspark.sql(\"SELECT COUNT(*) AS n FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 1>\", line 1, in <module>\n    spark.udf.register('trips', trips)\n    ~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.base.PySparkTypeError: [NOT_EXPECTED_TYPE] Argument `func` should be callable, got DataFrame."
   },
   "app.c1.table": {
    "code": "trips = spark.table('trips')\nspark.sql(\"SELECT COUNT(*) AS n FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 1>\", line 1, in <module>\n    trips = spark.table('trips')\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [TABLE_OR_VIEW_NOT_FOUND] The table or view `trips` cannot be found. Verify the spelling and correctness of the schema and catalog.\nSearch path: [`system`.`builtin`, `system`.`session`, `spark_catalog`.`default`].\nIf you did not qualify the name with a schema, verify the current_schema() output, or qualify the name with the correct schema and catalog.\nTo tolerate the error on drop use DROP VIEW IF EXISTS or DROP TABLE IF EXISTS. SQLSTATE: 42P01;\n'UnresolvedRelation [trips], [], false"
   },
   "app.c1.fixed": {
    "code": "trips.createOrReplaceTempView('trips')\nspark.sql(\"SELECT COUNT(*) AS n FROM trips\").show()",
    "out": "+---+\n|  n|\n+---+\n| 12|\n+---+\n\n",
    "err": null
   },
   "app.c2": {
    "code": "def band(distance):\n    \"\"\"'long' for a trip over 5 miles, else 'short'\"\"\"\n    return 'long' if distance > 5 else 'short'\n\nspark.sql(\"SELECT trip_distance, band(trip_distance) AS band FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 2>\", line 5, in <module>\n    spark.sql(\"SELECT trip_distance, band(trip_distance) AS band FROM trips\").show()\n    ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [UNRESOLVED_ROUTINE] Cannot resolve routine `band` on search path [`system`.`builtin`, `system`.`session`, `spark_catalog`.`default`]. SQLSTATE: 42883; line 1 pos 22"
   },
   "app.c2.udf": {
    "code": "band = udf(band)\nspark.sql(\"SELECT trip_distance, band(trip_distance) AS band FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 2>\", line 2, in <module>\n    spark.sql(\"SELECT trip_distance, band(trip_distance) AS band FROM trips\").show()\n    ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [UNRESOLVED_ROUTINE] Cannot resolve routine `band` on search path [`system`.`builtin`, `system`.`session`, `spark_catalog`.`default`]. SQLSTATE: 42883; line 1 pos 22"
   },
   "app.c2.othername": {
    "code": "spark.udf.register('band_label', band)\nspark.sql(\"SELECT trip_distance, band(trip_distance) AS band FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 2>\", line 2, in <module>\n    spark.sql(\"SELECT trip_distance, band(trip_distance) AS band FROM trips\").show()\n    ~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [UNRESOLVED_ROUTINE] Cannot resolve routine `band` on search path [`system`.`builtin`, `system`.`session`, `spark_catalog`.`default`]. SQLSTATE: 42883; line 1 pos 22"
   },
   "app.c2.bool": {
    "code": "spark.udf.register('band', band, 'BOOLEAN')\nspark.sql(\"SELECT trip_distance, band(trip_distance) AS band FROM trips\").show()",
    "out": "+-------------+----+\n|trip_distance|band|\n+-------------+----+\n|         1.94|NULL|\n|         5.08|NULL|\n|          9.8|NULL|\n|         0.37|NULL|\n|          1.4|NULL|\n|          8.1|NULL|\n|         1.76|NULL|\n|         1.51|NULL|\n|         1.56|NULL|\n|          1.0|NULL|\n|         2.15|NULL|\n|          7.1|NULL|\n+-------------+----+\n\n",
    "err": null
   },
   "app.c2.fixed": {
    "code": "spark.udf.register('band', band)\nspark.sql(\"SELECT trip_distance, band(trip_distance) AS band FROM trips\").show()",
    "out": "+-------------+-----+\n|trip_distance| band|\n+-------------+-----+\n|         1.94|short|\n|         5.08| long|\n|          9.8| long|\n|         0.37|short|\n|          1.4|short|\n|          8.1| long|\n|         1.76|short|\n|         1.51|short|\n|         1.56|short|\n|          1.0|short|\n|         2.15|short|\n|          7.1| long|\n+-------------+-----+\n\n",
    "err": null
   },
   "app.c3": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS mean fare\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 3>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT band(trip_distance) AS band, AVG(fare_amount) AS mean fare\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    ...<2 lines>...\n    ORDER BY band\n    ^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.ParseException: \n[PARSE_SYNTAX_ERROR] Syntax error at or near 'fare'. SQLSTATE: 42601 (line 2, pos 61)\n\n== SQL ==\n\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS mean fare\n-------------------------------------------------------------^^^\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band"
   },
   "app.c3.single": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS 'mean fare'\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 3>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT band(trip_distance) AS band, AVG(fare_amount) AS 'mean fare'\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    ...<2 lines>...\n    ORDER BY band\n    ^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.ParseException: \n[PARSE_SYNTAX_ERROR] Syntax error at or near ''mean fare''. SQLSTATE: 42601 (line 2, pos 56)\n\n== SQL ==\n\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS 'mean fare'\n--------------------------------------------------------^^^\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band"
   },
   "app.c3.double": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS \"mean fare\"\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 3>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT band(trip_distance) AS band, AVG(fare_amount) AS \"mean fare\"\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    ...<2 lines>...\n    ORDER BY band\n    ^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.ParseException: \n[PARSE_SYNTAX_ERROR] Syntax error at or near '\"mean fare\"'. SQLSTATE: 42601 (line 2, pos 56)\n\n== SQL ==\n\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS \"mean fare\"\n--------------------------------------------------------^^^\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band"
   },
   "app.c3.dash": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS mean-fare\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 3>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT band(trip_distance) AS band, AVG(fare_amount) AS mean-fare\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    ...<2 lines>...\n    ORDER BY band\n    ^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.ParseException: \n[INVALID_IDENTIFIER] The unquoted identifier mean-fare is invalid and must be back quoted as: `mean-fare`.\nUnquoted identifiers can only contain ASCII letters ('a' - 'z', 'A' - 'Z'), digits ('0' - '9'), and underbar ('_').\nUnquoted identifiers must also not start with a digit.\nDifferent data sources and meta stores may impose additional restrictions on valid identifiers. SQLSTATE: 42602 (line 2, pos 60)\n\n== SQL ==\n\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS mean-fare\n------------------------------------------------------------^^^\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band"
   },
   "app.c3.fixed": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS `mean fare`\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "+-----+---------+\n| band|mean fare|\n+-----+---------+\n| long|   29.125|\n|short|   8.5625|\n+-----+---------+\n\n",
    "err": null
   },
   "app.c4": {
    "code": "@pandas_udf('double')\ndef per_mile(it: Iterator[Tuple[pd.Series, pd.Series]]) -> Iterator[pd.Series]:\n    \"\"\"Fare per mile, one batch at a time\"\"\"\n    for fare, dist in it:\n        return fare / dist\n\nspark.udf.register('per_mile', per_mile)\nspark.sql(\"SELECT PULocationID, per_mile(fare_amount, trip_distance) AS rate FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 4>\", line 8, in <module>\n    spark.sql(\"SELECT PULocationID, per_mile(fare_amount, trip_distance) AS rate FROM trips\").show()\n    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^\n  ...\npyspark.errors.exceptions.captured.PythonException: An exception was thrown from the Python worker:\nTraceback (most recent call last):\n  ...\npyspark.errors.exceptions.base.PySparkTypeError: [UDF_RETURN_TYPE] Return type of the user-defined function should be iterator of pandas.Series, but is Series."
   },
   "app.c4.list": {
    "code": "@pandas_udf('double')\ndef per_mile(it: Iterator[Tuple[pd.Series, pd.Series]]) -> Iterator[pd.Series]:\n    \"\"\"Fare per mile, one batch at a time\"\"\"\n    for fare, dist in it:\n        return [fare / dist]\n\nspark.udf.register('per_mile', per_mile)\nspark.sql(\"SELECT PULocationID, per_mile(fare_amount, trip_distance) AS rate FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 4>\", line 8, in <module>\n    spark.sql(\"SELECT PULocationID, per_mile(fare_amount, trip_distance) AS rate FROM trips\").show()\n    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^\n  ...\npyspark.errors.exceptions.captured.PythonException: An exception was thrown from the Python worker:\nTraceback (most recent call last):\n  ...\npyspark.errors.exceptions.base.PySparkTypeError: [UDF_RETURN_TYPE] Return type of the user-defined function should be iterator of pandas.Series, but is list."
   },
   "app.c4.means": {
    "code": "@pandas_udf('double')\ndef per_mile(it: Iterator[Tuple[pd.Series, pd.Series]]) -> Iterator[pd.Series]:\n    \"\"\"Fare per mile, one batch at a time\"\"\"\n    for fare, dist in it:\n        yield fare.mean() / dist.mean()\n\nspark.udf.register('per_mile', per_mile)\nspark.sql(\"SELECT PULocationID, per_mile(fare_amount, trip_distance) AS rate FROM trips\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 4>\", line 8, in <module>\n    spark.sql(\"SELECT PULocationID, per_mile(fare_amount, trip_distance) AS rate FROM trips\").show()\n    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^\n  ...\npyspark.errors.exceptions.captured.PythonException: An exception was thrown from the Python worker:\nTraceback (most recent call last):\n  ...\npyspark.errors.exceptions.base.PySparkTypeError: [UDF_RETURN_TYPE] Return type of the user-defined function should be iterator of pandas.Series, but is iterator of float64."
   },
   "app.c4.fixed": {
    "code": "@pandas_udf('double')\ndef per_mile(it: Iterator[Tuple[pd.Series, pd.Series]]) -> Iterator[pd.Series]:\n    \"\"\"Fare per mile, one batch at a time\"\"\"\n    for fare, dist in it:\n        yield fare / dist\n\nspark.udf.register('per_mile', per_mile)\nspark.sql(\"SELECT PULocationID, per_mile(fare_amount, trip_distance) AS rate FROM trips\").show()",
    "out": "+------------+------------------+\n|PULocationID|              rate|\n+------------+------------------+\n|          41| 5.927835051546392|\n|          97| 4.330708661417323|\n|           7| 3.520408163265306|\n|           7| 10.81081081081081|\n|          74| 6.071428571428572|\n|          33|3.5802469135802473|\n|          41| 6.818181818181818|\n|           7| 5.298013245033113|\n|          75| 5.128205128205128|\n|          74|               6.0|\n|           7| 4.883720930232558|\n|          33| 4.366197183098592|\n+------------+------------------+\n\n",
    "err": null
   },
   "app.c5": {
    "code": "spark.udf.register('fare_per_mile', lambda fare, dist: fare / dist)\nspark.sql(\"\"\"\nSELECT PULocationID, fare_per_mile(fare_amount, trip_distance) AS rate\nFROM trips\nORDER BY rate DESC\nLIMIT 3\n\"\"\").show()",
    "out": "+------------+-----------------+\n|PULocationID|             rate|\n+------------+-----------------+\n|          41|6.818181818181818|\n|          74|6.071428571428572|\n|          74|              6.0|\n+------------+-----------------+\n\n",
    "err": null
   },
   "app.c5.typed": {
    "code": "spark.udf.register('fare_per_mile', lambda fare, dist: fare / dist, 'DOUBLE')\nspark.sql(\"\"\"\nSELECT PULocationID, fare_per_mile(fare_amount, trip_distance) AS rate\nFROM trips\nORDER BY rate DESC\nLIMIT 3\n\"\"\").show()",
    "out": "+------------+-----------------+\n|PULocationID|             rate|\n+------------+-----------------+\n|           7|10.81081081081081|\n|          41|6.818181818181818|\n|          74|6.071428571428572|\n+------------+-----------------+\n\n",
    "err": null
   },
   "app.c6.def": {
    "code": "@pandas_udf('double')\ndef mean_udf(v: pd.Series) -> float:\n    \"\"\"Compute mean of v\"\"\"\n    return v.mean()\n\n@pandas_udf('double')\ndef half(v: pd.Series) -> pd.Series:\n    \"\"\"Half of every value\"\"\"\n    return v / 2\n\nspark.udf.register('mean_udf', mean_udf)\nspark.udf.register('half', half)\nspark.udf.register('per_mile', per_mile);",
    "out": "",
    "err": null
   },
   "app.c6.half": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, half(fare_amount) AS `mean fare`\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 7>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT band(trip_distance) AS band, half(fare_amount) AS `mean fare`\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    ...<2 lines>...\n    ORDER BY band\n    ^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [MISSING_AGGREGATION] The non-aggregating expression \"fare_amount\" is based on columns which are not participating in the GROUP BY clause.\nAdd the columns or the expression to the GROUP BY, aggregate the expression, or use \"any_value(fare_amount)\" if you do not care which of the values within a group is returned. SQLSTATE: 42803;\nSort [band#216 ASC NULLS FIRST], true\n+- Aggregate [band(trip_distance#73)#218], [band(trip_distance#73)#219 AS band#216, half(fare_amount#74)#220 AS mean fare#217]\n   +- SubqueryAlias trips\n      +- View (`trips`, [VendorID#67, lpep_pickup_datetime#68, store_and_fwd_flag#69, PULocationID#70, DOLocationID#71, passenger_count#72, trip_distance#73, fare_amount#74, tip_amount#75, total_amount#76])\n         +- Relation [VendorID#67,lpep_pickup_datetime#68,store_and_fwd_flag#69,PULocationID#70,DOLocationID#71,passenger_count#72,trip_distance#73,fare_amount#74,tip_amount#75,total_amount#76] csv"
   },
   "app.c6.permile": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, per_mile(fare_amount) AS `mean fare`\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 7>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT band(trip_distance) AS band, per_mile(fare_amount) AS `mean fare`\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    ...<2 lines>...\n    ORDER BY band\n    ^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [MISSING_AGGREGATION] The non-aggregating expression \"fare_amount\" is based on columns which are not participating in the GROUP BY clause.\nAdd the columns or the expression to the GROUP BY, aggregate the expression, or use \"any_value(fare_amount)\" if you do not care which of the values within a group is returned. SQLSTATE: 42803;\nSort [band#221 ASC NULLS FIRST], true\n+- Aggregate [band(trip_distance#73)#223], [band(trip_distance#73)#224 AS band#221, per_mile(fare_amount#74)#225 AS mean fare#222]\n   +- SubqueryAlias trips\n      +- View (`trips`, [VendorID#67, lpep_pickup_datetime#68, store_and_fwd_flag#69, PULocationID#70, DOLocationID#71, passenger_count#72, trip_distance#73, fare_amount#74, tip_amount#75, total_amount#76])\n         +- Relation [VendorID#67,lpep_pickup_datetime#68,store_and_fwd_flag#69,PULocationID#70,DOLocationID#71,passenger_count#72,trip_distance#73,fare_amount#74,tip_amount#75,total_amount#76] csv"
   },
   "app.c6.band": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, band(fare_amount) AS `mean fare`\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "",
    "err": "Traceback (most recent call last):\n  File \"<cell 7>\", line 1, in <module>\n    spark.sql(\"\"\"\n    ~~~~~~~~~^^^^\n    SELECT band(trip_distance) AS band, band(fare_amount) AS `mean fare`\n    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n    ...<2 lines>...\n    ORDER BY band\n    ^^^^^^^^^^^^^\n    \"\"\").show()\n    ^^^^\n  ...\npyspark.errors.exceptions.captured.AnalysisException: [MISSING_AGGREGATION] The non-aggregating expression \"fare_amount\" is based on columns which are not participating in the GROUP BY clause.\nAdd the columns or the expression to the GROUP BY, aggregate the expression, or use \"any_value(fare_amount)\" if you do not care which of the values within a group is returned. SQLSTATE: 42803;\nSort [band#226 ASC NULLS FIRST], true\n+- Aggregate [band(trip_distance#73)#228], [band(trip_distance#73)#229 AS band#226, band(fare_amount#74)#230 AS mean fare#227]\n   +- SubqueryAlias trips\n      +- View (`trips`, [VendorID#67, lpep_pickup_datetime#68, store_and_fwd_flag#69, PULocationID#70, DOLocationID#71, passenger_count#72, trip_distance#73, fare_amount#74, tip_amount#75, total_amount#76])\n         +- Relation [VendorID#67,lpep_pickup_datetime#68,store_and_fwd_flag#69,PULocationID#70,DOLocationID#71,passenger_count#72,trip_distance#73,fare_amount#74,tip_amount#75,total_amount#76] csv"
   },
   "app.c6.fixed": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, mean_udf(fare_amount) AS `mean fare`\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "+-----+---------+\n| band|mean fare|\n+-----+---------+\n| long|   29.125|\n|short|   8.5625|\n+-----+---------+\n\n",
    "err": null
   },
   "app.c6.builtin": {
    "code": "spark.sql(\"\"\"\nSELECT band(trip_distance) AS band, AVG(fare_amount) AS `mean fare`\nFROM trips\nGROUP BY band(trip_distance)\nORDER BY band\n\"\"\").show()",
    "out": "+-----+---------+\n| band|mean fare|\n+-----+---------+\n| long|   29.125|\n|short|   8.5625|\n+-----+---------+\n\n",
    "err": null
   }
  };

  // ==========================================================================================
  // MODULE spark-sql-udf: user-defined functions, the four pandas UDF kinds, and spark.sql.
  // Every output a learner sees is either copied from REAL (real PySpark 4.3.0 runs, local[*],
  // Python 3.14, pandas 2.3, pyarrow 26) or computed by the engine above on taxi12 / tweets8 and
  // checked against a REAL text byte for byte (fn realMatch, examples.yaml).
  // Conventions (SOURCE_NOTES.md): trips are numbered 1-12 and tweets 1-8 in file order; Float
  // columns hold 32-bit values (Math.fround), as Spark's FloatType does.
  // ==========================================================================================
  const TRIPS = dfReadCsv(DF_TAXI12_CSV, { header: true, inferSchema: true, path: 'taxi12.csv' });
  // Byte-identical to tweets8.jsonl (synthetic: eight made-up tweets in the shape of the course's Twitter sample).
  const TWEETS_JSONL = [
    '{"id": 1178762251000001, "text": "Traffic on EDSA again. Leaving at 6 am tomorrow #commute", "user": {"id": 101, "name": "Ana Santos", "screen_name": "ana_s", "description": "Nurse. Coffee first.", "statuses_count": 1200, "friends_count": 310, "created_at": "Mon Mar 02 08:00:00 +0000 2015"}, "place": {"country_code": "PH"}, "entities": {"hashtags": [{"text": "commute"}]}}',
    '{"id": 1178762251000002, "text": "Halo-halo weather #summer #Manila", "user": {"id": 102, "name": "Ben Cruz", "screen_name": "bencruz", "description": "Food and maps", "statuses_count": 450, "friends_count": 95, "created_at": "Tue Jun 14 10:30:00 +0000 2016"}, "place": {"country_code": "PH"}, "entities": {"hashtags": [{"text": "summer"}, {"text": "Manila"}]}}',
    '{"id": 1178762251000003, "text": "Game day! Go team", "user": {"id": 103, "name": "Cara Lee", "screen_name": "cara_lee", "description": "Sports fan", "statuses_count": 800, "friends_count": 1020, "created_at": "Fri Jan 05 12:00:00 +0000 2018"}, "place": {"country_code": "US"}, "entities": {"hashtags": []}}',
    '{"id": 1178762251000004, "text": "Ramen at midnight #food", "user": {"id": 104, "name": "Daichi Mori", "screen_name": "dmori", "description": "Tokyo night owl", "statuses_count": 640, "friends_count": 77, "created_at": "Sat Aug 20 22:15:00 +0000 2016"}, "place": {"country_code": "JP"}, "entities": {"hashtags": [{"text": "food"}]}}',
    '{"id": 1178762251000005, "text": "Jeepney ride with a great view of the bay #commute #Manila", "user": {"id": 105, "name": "Elena Ramos", "screen_name": "elena_r", "description": "Data analyst", "statuses_count": 3000, "friends_count": 540, "created_at": "Wed Nov 11 09:45:00 +0000 2015"}, "place": {"country_code": "PH"}, "entities": {"hashtags": [{"text": "commute"}, {"text": "Manila"}]}}',
    '{"id": 1178762251000006, "text": "New paper out today", "user": {"id": 106, "name": "Frank Hall", "screen_name": "fhall", "description": "Researcher", "statuses_count": 2200, "friends_count": 260, "created_at": "Thu Apr 04 14:20:00 +0000 2019"}, "place": {"country_code": "US"}, "entities": {"hashtags": []}}',
    '{"id": 1178762251000007, "text": "Good morning", "user": {"id": 107, "name": "Gina Tan", "screen_name": "ginatan", "description": "", "statuses_count": 90, "friends_count": 15, "created_at": "Sun Sep 29 07:00:00 +0000 2019"}, "place": null, "entities": {"hashtags": []}}',
    '{"id": 1178762251000008, "text": "A long thread about bananas and data #food", "user": {"id": 108, "name": "Hugo Diaz", "screen_name": "hugod", "description": "Farmer who codes", "statuses_count": 5010, "friends_count": 880, "created_at": "Mon Feb 10 16:40:00 +0000 2014"}, "place": null, "entities": {"hashtags": [{"text": "food"}]}}',
    '',
  ].join('\n');
  const TWEETS = dfReadJson(TWEETS_JSONL, { path: 'tweets8.jsonl' });
  const SEEDS = { a: 193602, b: 15914, c: 1 }; // seeds.json in the notebook's folder (pd.seeds)

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
  // The exception line of a trimmed traceback: the first line after the frames that starts at column 0.
  function finalLine(err) {
    const ls = String(err).split('\n');
    let i = 1;
    while (i < ls.length && /^\s/.test(ls[i])) i++;
    return i < ls.length ? ls[i] : ls[ls.length - 1];
  }
  const shortClass = (line) => line.split(':')[0].split('.').pop();
  const colIdx = (t, name) => dfFindColumn(t.columns, name);
  const val = (t, i, name) => t.rows[i][colIdx(t, name)];
  const tex = (s) => dfTexText(dfEscapeMeta(String(s)));
  const showText = (t, o) => dfShowString(t, o).replace(/\n+$/, '');
  const f32 = (x) => Math.fround(x);
  const tripNums = (n) => Array.from({ length: n }, (_, i) => String(i + 1));
  const ALL = TRIPS.rows.map((r, i) => i);
  const dist = (i) => val(TRIPS, i, 'trip_distance');
  const fare = (i) => val(TRIPS, i, 'fare_amount');
  const pu = (i) => val(TRIPS, i, 'PULocationID');
  const fmt2 = (x) => String(Math.round(x * 100) / 100);
  const fmt4 = (x) => String(Math.round(x * 10000) / 10000);
  const userField = (i, f) => val(TWEETS, i, 'user')[f];
  const country = (i) => { const p = val(TWEETS, i, 'place'); return p ? p.country_code : null; };

  // ---- generic real cell ---------------------------------------------------------------------
  // Any REAL entry as a notebook cell: the code, what it printed (```text block), the error class.
  function realCell({ key }) {
    const e = realEntry(key);
    const fl = e.err ? finalLine(e.err) : null;
    return {
      key, code: e.code, out: txt(realText(key)), ok: !e.err, printed: e.out.replace(/\n+$/, ''),
      final: fl, ename: fl ? shortClass(fl) : null, codeLines: e.code.split('\n').length,
    };
  }
  // Several real cells as one Markdown block: each cell's code in a python fence, then its output.
  function realCells({ keys }) {
    const parts = keys.map((k) => {
      const e = realEntry(k);
      const out = realText(k).replace(/\n+$/, '');
      return '```python\n' + e.code + '\n```' + (out ? '\n' + txt(out) : '');
    });
    return { md: parts.join('\n\n') };
  }

  // ---- the lesson tables as Matrix props -----------------------------------------------------
  function tripsView({ cols = ['PULocationID', 'DOLocationID', 'trip_distance', 'fare_amount'] }) {
    const m = dfToMatrix(TRIPS, { cols, rowLabels: tripNums(TRIPS.rows.length), emptyLabel: 'NULL' });
    return { rows: m.rows, cols: m.cols, values: m.values, md: dfToMarkdownTable(TRIPS, { cols }) };
  }
  function tweetsView({ fields = ['id', 'name', 'statuses_count', 'country_code'] }) {
    const get = (i, f) => (f === 'country_code' ? country(i) : f === 'tweet_id' ? val(TWEETS, i, 'id') : userField(i, f));
    const values = TWEETS.rows.map((r, i) => fields.map((f) => { const v = get(i, f); return v === null ? null : tex(v); }));
    return { rows: tripNums(TWEETS.rows.length), cols: fields.map((f) => (f === 'tweet_id' ? 'id' : f)), values, emptyLabel: 'NULL' };
  }
  // Engine read of the two files, against the real printSchema output.
  function schemaText({ which = 'trips' }) {
    return { text: dfPrintSchemaString(which === 'trips' ? TRIPS : TWEETS).replace(/\n+$/, '') };
  }

  // ==========================================================================================
  // 1. A row-at-a-time UDF: pair_code(pu, do) = f'{pu}-{do}'
  // ==========================================================================================
  const pairOf = (i) => pu(i) + '-' + val(TRIPS, i, 'DOLocationID');
  // Worksheet: trips with their PU, DO and the code filled in for the first `upTo` rows.
  function pairSheet({ upTo = 0 }) {
    const k = Math.max(0, Math.min(12, upTo));
    const values = ALL.map((i) => [tex(pu(i)), tex(val(TRIPS, i, 'DOLocationID')), i < k ? tex(pairOf(i)) : '']);
    const codes = ALL.map(pairOf);
    const distinct = [...new Set(codes)].length;
    return { rows: tripNums(12), cols: ['PULocationID', 'DOLocationID', 'pair_code'], values, codes, distinct, filled: k };
  }
  // roles: sheet (Matrix of pairSheet). One step per row: the function body runs once per trip.
  function pairWalk() {
    const trace = [{ label: 'Spark calls `pair_code` once for every row.', ops: [{ role: 'sheet', cmd: 'clear' }], patch: { pairUpTo: 0 } }];
    ALL.forEach((i) => {
      trace.push({
        label: `Trip ${i + 1}: pu = ${pu(i)}, do = ${val(TRIPS, i, 'DOLocationID')} → \`${pairOf(i)}\``,
        vars: { pu: pu(i), do: val(TRIPS, i, 'DOLocationID'), out: pairOf(i) },
        ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'row:' + (i + 1) } }],
        patch: { pairUpTo: i + 1 },
      });
    });
    return { trace, steps: trace.length - 1, last: pairOf(11) };
  }
  // roles: table (live Matrix of pairSheet with upTo 0), code, formula. One step per row, two lines each.
  function pairCodeTrace() {
    const trace = [{ label: 'The `select` asks for one new value per row.', code: 'rows', math: 'rows', ops: [{ role: 'table', cmd: 'clear' }] }];
    ALL.forEach((i) => {
      const d = val(TRIPS, i, 'DOLocationID');
      trace.push({ label: `Row ${i + 1}: Spark hands the function this row's values, ${pu(i)} and ${d}.`, code: 'args', math: 'args',
        vars: { row: i + 1, pu: pu(i), do: d }, ops: [{ role: 'table', cmd: 'highlight', args: { sel: 'row:' + (i + 1) } }] });
      trace.push({ label: `Return \`${pairOf(i)}\`, a string.`, code: 'out', math: 'out',
        vars: { row: i + 1, pu: pu(i), do: d, out: pairOf(i) },
        ops: [{ role: 'table', cmd: 'fill', args: { cell: (i + 1) + ',pair_code', value: tex(pairOf(i)) } }] });
    });
    return { trace, codes: ALL.map(pairOf) };
  }
  // The show() output of the decorated UDF, rebuilt by the engine (checked against REAL udf.show).
  function pairShow({ n = 20, limit = 12 }) {
    const t = dfFromRows([['pair_code(PULocationID, DOLocationID)', 'string']], ALL.slice(0, limit).map((i) => [pairOf(i)]));
    return { text: showText(t, { n }) };
  }

  // ==========================================================================================
  // 2. Return types: the default string, numbers, and nested structs
  // ==========================================================================================
  const RT = {
    string: { def: 'udf.double_default_def', show: 'udf.double_default_show', schema: 'udf.double_default_schema' },
    intPickle: { def: 'ar.int_pickle_def', show: 'ar.int_pickle_show' },
    intArrow: { def: 'ar.int_arrow_def', show: 'ar.int_arrow_show' },
    double: { def: 'udf.double_double_def', show: 'udf.double_double_show' },
  };
  // Declared type → its real cells (definition, show, schema where recorded).
  function returnTypeView({ decl = 'string' }) {
    const r = RT[decl] || RT.string;
    const keys = [r.def, r.show].concat(r.schema ? [r.schema] : []);
    const nulls = (realEntry(r.show).out.match(/NULL/g) || []).length;
    return { md: realCells({ keys }).md, nulls, decl };
  }
  const infoOf = (i) => ({ id: userField(i, 'id'), user: { name: userField(i, 'name'), description: userField(i, 'description') } });
  const infoText = (i) => { const o = infoOf(i); return `{${o.id}, {${o.user.name}, ${o.user.description}}}`; };
  // Worksheet: the three input columns and the struct each tweet's call returns, filled for the first upTo tweets.
  function structSheet({ upTo = 0 }) {
    const k = Math.max(0, Math.min(8, upTo));
    const values = TWEETS.rows.map((r, i) => [tex(userField(i, 'id')), tex(userField(i, 'name')), tex(userField(i, 'description') || ' '), i < k ? tex(infoText(i)) : '']);
    return { rows: tripNums(8), cols: ['user.id', 'user.name', 'user.description', 'info'], values, filled: k };
  }
  // roles: table (live Matrix of structSheet), code, formula. One step per tweet: pack, then return.
  function structTrace() {
    const trace = [{ label: 'The declared type is a struct: `id`, then `user` holding `name` and `description`.', code: 'type', math: 'type', ops: [{ role: 'table', cmd: 'clear' }] }];
    TWEETS.rows.forEach((r, i) => {
      trace.push({ label: `Tweet ${i + 1}: the function gets ${userField(i, 'id')}, ${userField(i, 'name')} and the description.`, code: 'args', math: 'args',
        vars: { user_id: userField(i, 'id'), user_name: userField(i, 'name') }, ops: [{ role: 'table', cmd: 'highlight', args: { sel: 'row:' + (i + 1) } }] });
      trace.push({ label: `It returns a tuple inside a tuple; Spark files it as \`${infoText(i)}\`.`, code: 'pack', math: 'pack',
        vars: { user_id: userField(i, 'id'), user_name: userField(i, 'name') },
        ops: [{ role: 'table', cmd: 'fill', args: { cell: (i + 1) + ',info', value: tex(infoText(i)) } }] });
    });
    return { trace };
  }
  // show(truncate=False) of the DDL-typed UDF, rebuilt by the engine (checked against REAL udf.ddl_show).
  function structShow({ name = 'collect_user_info2(user.id, user.name, user.description)', truncate = false }) {
    const t = dfFromRows([[name, 'struct<id:bigint,user:struct<name:string,description:string>>']], TWEETS.rows.map((r, i) => [infoOf(i)]));
    return { text: showText(t, { truncate }) };
  }

  // ==========================================================================================
  // 3. Arrow batches: how many calls a pandas UDF gets
  // ==========================================================================================
  function batchPlan({ n = 12, size = 10000 }) {
    const sizes = [];
    for (let left = n; left > 0; left -= size) sizes.push(Math.min(size, left));
    return { sizes, count: sizes.length, last: sizes.length ? sizes[sizes.length - 1] : 0, sizesText: sizes.join(', ') };
  }
  // Worksheet: each trip with the batch it travels in and that batch's size.
  function batchSheet({ size = 5, upTo = 12 }) {
    const p = batchPlan({ n: 12, size });
    const values = ALL.map((i) => {
      const b = Math.floor(i / size);
      return i < upTo ? [tex(pu(i)), tex(b + 1), tex(p.sizes[b])] : [tex(pu(i)), '', ''];
    });
    return { rows: tripNums(12), cols: ['PULocationID', 'batch', 'batch_size'], values, count: p.count, sizes: p.sizes };
  }
  // roles: table (live Matrix of batchSheet with upTo 0), code, formula. One step per batch.
  function batchTrace({ size = 5 }) {
    const p = batchPlan({ n: 12, size });
    const trace = [{ label: `12 rows, at most ${size} per batch.`, code: 'size', math: 'size', vars: { n: 12, size }, ops: [{ role: 'table', cmd: 'clear' }] }];
    let start = 0;
    p.sizes.forEach((s, b) => {
      const rows = Array.from({ length: s }, (_, k) => 'row:' + (start + k + 1));
      trace.push({ label: `Batch ${b + 1}: rows ${start + 1}–${start + s} arrive together, so \`len(s)\` is ${s}.`, code: 'count', math: 'count',
        vars: { batch: b + 1, len_s: s }, ops: [{ role: 'table', cmd: 'highlight', args: { sel: rows } }].concat(
          rows.map((sel, k) => ({ role: 'table', cmd: 'fill', args: { cell: (start + k + 1) + ',batch_size', value: tex(s) } }))) });
      start += s;
    });
    trace.push({ label: `$\\lceil 12 / ${size} \\rceil = ${p.count}$ calls of the function.`, code: 'ceil', math: 'ceil', vars: { calls: p.count } });
    return { trace, count: p.count };
  }

  // ==========================================================================================
  // 4. Series to Series: np.clip on whole batches
  // ==========================================================================================
  const clipOne = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
  function clipView({ lo = 0, hi = 100, name = 'clipped' }) {
    const out = ALL.map((i) => f32(clipOne(dist(i), lo, hi)));
    const changed = ALL.filter((i) => clipOne(dist(i), lo, hi) !== dist(i)).map((i) => i + 1);
    const both = dfFromRows([['trip_distance', 'double'], [name, 'float']], ALL.map((i) => [dist(i), out[i]]));
    const only = dfFromRows([[name, 'float']], ALL.map((i) => [out[i]]));
    const values = ALL.map((i) => [tex(dfJavaDouble(dist(i))), tex(dfJavaFloat(out[i]))]);
    return {
      show: txt(showText(both)), showOnly: showText(only), showBoth: showText(both), changed, nChanged: changed.length,
      matrix: { rows: tripNums(12), cols: ['trip_distance', name], values },
      blank: { rows: tripNums(12), cols: ['trip_distance', name], values: values.map((v) => [v[0], '']) },
    };
  }
  // roles: table (live Matrix: trip_distance and an empty clipped column), code, formula.
  function clipTrace({ lo = 0, hi = 5 }) {
    const trace = [{ label: `The whole batch arrives as one Series \`s\` of 12 distances.`, code: 'series', math: 'series', vars: { lo, hi }, ops: [{ role: 'table', cmd: 'clear' }] }];
    ALL.forEach((i) => {
      const x = dist(i);
      const y = clipOne(x, lo, hi);
      const why = x > hi ? `above ${hi}, so it becomes ${hi}` : x < lo ? `below ${lo}, so it becomes ${lo}` : 'inside the range, so it stays';
      trace.push({ label: `Trip ${i + 1}: ${dfJavaDouble(x)} is ${why}.`, code: 'clip', math: 'clip', vars: { x, clipped: y },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: y !== x ? 'warn' : 'accent' } },
          { role: 'table', cmd: 'fill', args: { cell: (i + 1) + ',clipped', value: tex(dfJavaFloat(f32(y))) } }] });
    });
    const n = ALL.filter((i) => clipOne(dist(i), lo, hi) !== dist(i)).length;
    trace.push({ label: `One call, one Series back: ${n} of 12 values changed.`, code: 'clip', math: 'clip', vars: { changed: n } });
    return { trace, changed: n };
  }

  // ==========================================================================================
  // 5. Iterators: the hash (a*x + b) mod c, and fare per mile from two columns
  // ==========================================================================================
  // numpy int64 arithmetic: a*x and +b wrap around at 64 bits; % takes the divisor's sign (Python).
  function hashInt64({ a, b, c, x }) {
    const A = BigInt(a), B = BigInt(b), C = BigInt(c), X = BigInt(x);
    const v = BigInt.asIntN(64, BigInt.asIntN(64, A * X) + B);
    const r = ((v % C) + C) % C;
    return { value: Number(r), ax: Number(BigInt.asIntN(64, A * X)), axb: Number(v) };
  }
  // Worksheet over the eight user ids: a*x, a*x + b and the result, filled for the first upTo users.
  function hashSheet({ a = 193602, b = 15914, c = 1000, upTo = 8 }) {
    const ids = TWEETS.rows.map((r, i) => userField(i, 'id'));
    const res = ids.map((x) => hashInt64({ a, b, c, x }));
    const values = ids.map((x, i) => i < upTo ? [tex(x), tex(res[i].ax), tex(res[i].axb), tex(res[i].value)] : [tex(x), '', '', '']);
    const t = dfFromRows([['id', 'bigint'], ['mask_demo(user.id)', 'bigint']], ids.map((x, i) => [x, res[i].value]));
    return { rows: tripNums(8), cols: ['x', 'a·x', 'a·x + b', 'mod c'], values, masks: res.map((r) => r.value), first: res[0].value, show: txt(showText(t)), showText: showText(t) };
  }
  // roles: sheet (Matrix of hashSheet). One step per user id: the three arithmetic steps in one label.
  function hashWalk({ a = 193602, b = 15914, c = 1000 }) {
    const trace = [{ label: 'One batch of 8 ids; the loop yields one Series back.', patch: { hashUpTo: 0 }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    TWEETS.rows.forEach((r, i) => {
      const x = userField(i, 'id');
      const h = hashInt64({ a, b, c, x });
      trace.push({ label: `$${a} \\times ${x} + ${b} = ${h.axb}$; remainder after dividing by ${c}: **${h.value}**.`,
        vars: { x, result: h.value }, patch: { hashUpTo: i + 1 }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'row:' + (i + 1) } }] });
    });
    return { trace, steps: trace.length - 1 };
  }
  // roles: table (live Matrix of hashSheet with upTo 0), code, formula. Setup once, then 3 lines per id.
  function hashTrace({ a = 193602, b = 15914, c = 1000 }) {
    const trace = [{ label: `Setup runs once per call: a = ${a}, b = ${b}, c = ${c}.`, code: 'setup', math: 'setup', vars: { a, b, c }, ops: [{ role: 'table', cmd: 'clear' }] }];
    trace.push({ label: 'The `for` loop takes the first (and only) batch: all 8 ids.', code: 'loop', math: 'loop', vars: { a, b, c } });
    TWEETS.rows.forEach((r, i) => {
      const x = userField(i, 'id');
      const h = hashInt64({ a, b, c, x });
      const row = 'row:' + (i + 1);
      trace.push({ label: `Id ${x}: $a \\cdot x = ${h.ax}$`, code: 'ax', math: 'ax', vars: { x, ax: h.ax },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel: row } }, { role: 'table', cmd: 'fill', args: { cell: (i + 1) + ',a·x', value: tex(h.ax) } }] });
      trace.push({ label: `Add b: $${h.ax} + ${b} = ${h.axb}$`, code: 'plusb', math: 'plusb', vars: { x, axb: h.axb },
        ops: [{ role: 'table', cmd: 'fill', args: { cell: (i + 1) + ',a·x + b', value: tex(h.axb) } }] });
      trace.push({ label: `Remainder after dividing by ${c}: **${h.value}**`, code: 'modc', math: 'modc', vars: { x, result: h.value },
        ops: [{ role: 'table', cmd: 'fill', args: { cell: (i + 1) + ',mod c', value: tex(h.value) } }] });
    });
    trace.push({ label: '`yield` hands the whole Series of 8 results back; the loop waits for the next batch.', code: 'loop', math: 'loop', vars: {} });
    return { trace };
  }
  // Fare per mile from two columns (Iterator of tuples of Series). FloatType output.
  function fareRateView({ name = 'fare_rate(trip_distance, fare_amount)' }) {
    const rate = ALL.map((i) => fare(i) / dist(i));
    const t = dfFromRows([[name, 'float']], rate.map((r) => [r]));
    const values = ALL.map((i) => [tex(dfJavaDouble(dist(i))), tex(dfJavaDouble(fare(i))), tex(dfJavaFloat(f32(rate[i])))]);
    let top = 0;
    rate.forEach((r, i) => { if (r > rate[top]) top = i; });
    return { showText: showText(t), show: txt(showText(t)), rates: rate, top: top + 1, topRate: rate[top], topZone: pu(top),
      matrix: { rows: tripNums(12), cols: ['trip_distance', 'fare_amount', 'fare_rate'], values } };
  }
  // The same rates as DOUBLE, sorted as numbers or as text (a registered lambda without a type returns text).
  function rateOrder({ asText = false, limit = 3 }) {
    const items = ALL.map((i) => ({ zone: pu(i), rate: fare(i) / dist(i) }));
    const key = (o) => dfJavaDouble(o.rate);
    items.sort((p, q) => (asText ? (key(p) < key(q) ? 1 : key(p) > key(q) ? -1 : 0) : q.rate - p.rate));
    const top = items.slice(0, limit);
    const t = dfFromRows([['PULocationID', 'int'], ['rate', asText ? 'string' : 'double']], top.map((o) => [o.zone, asText ? key(o) : o.rate]));
    return { showText: showText(t), topZone: top[0].zone, topRate: top[0].rate };
  }

  // ==========================================================================================
  // 6. Series to scalar per group, and applyInPandas
  // ==========================================================================================
  const COUNTRY_ORDER = [null, 'JP', 'PH', 'US']; // the order the real groupby output printed (pd.mean_udf)
  function groupMeans() {
    return COUNTRY_ORDER.map((cc) => {
      const idx = TWEETS.rows.map((r, i) => i).filter((i) => country(i) === cc);
      const vals = idx.map((i) => userField(i, 'statuses_count'));
      const sum = vals.reduce((s, v) => s + v, 0);
      return { cc, label: cc === null ? 'NULL' : cc, tweets: idx.map((i) => i + 1), vals, sum, n: vals.length, mean: sum / vals.length };
    });
  }
  // Worksheet: one row per group with its values, sum, n and mean, filled for the first upTo groups.
  function groupMeanSheet({ upTo = 0 }) {
    const g = groupMeans();
    const values = g.map((x, k) => (k < upTo ? [tex(x.vals.join(' + ')), tex(x.sum), tex(x.n), tex(dfJavaDouble(x.mean))] : [tex(x.vals.join(' + ')), '', '', '']));
    const t = dfFromRows([['country_code', 'string'], ['mean_udf(user.statuses_count)', 'double']], g.map((x) => [x.cc, x.mean]));
    const all = TWEETS.rows.map((r, i) => userField(i, 'statuses_count'));
    const overall = all.reduce((s, v) => s + v, 0) / all.length;
    return { rows: g.map((x) => x.label), cols: ['values', 'sum', 'n', 'mean'], values, groups: g, showText: showText(t), show: txt(showText(t)), overall,
      ph: g[2].mean, jp: g[1].mean, nul: g[0].mean, us: g[3].mean };
  }
  // roles: sheet (Matrix of groupMeanSheet). One step per group.
  function groupMeanWalk() {
    const g = groupMeans();
    const trace = [{ label: 'Spark sends each group to the function as one Series.', patch: { meanUpTo: 0 }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    g.forEach((x, k) => {
      trace.push({ label: `Group ${x.label}: $(${x.vals.join(' + ')}) / ${x.n} = ${dfJavaDouble(x.mean)}$`, vars: { group: x.label, mean: x.mean },
        patch: { meanUpTo: k + 1 }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'row:' + x.label } }] });
    });
    return { trace, steps: trace.length - 1 };
  }
  // roles: table (live Matrix of tweetsView), code, formula. One step per group: the Series in, one number out.
  function groupMeanTrace() {
    const g = groupMeans();
    const trace = [{ label: '`groupby` splits the 8 tweets by `country_code`.', code: 'group', math: 'group', ops: [{ role: 'table', cmd: 'clear' }] }];
    g.forEach((x) => {
      trace.push({ label: `Group ${x.label}: \`v\` holds ${x.vals.join(', ')}.`, code: 'series', math: 'series', vars: { group: x.label, n: x.n },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel: x.tweets.map((t) => 'row:' + t) } }] });
      trace.push({ label: `\`v.mean()\` = $${x.sum} / ${x.n} = ${dfJavaDouble(x.mean)}$, one number for the group.`, code: 'mean', math: 'mean', vars: { group: x.label, mean: x.mean },
        ops: x.tweets.map((t) => ({ role: 'table', cmd: 'annotate', args: { sel: 'row:' + t, text: x.label + ' mean ' + dfJavaDouble(x.mean) } })) });
    });
    return { trace };
  }
  // applyInPandas: each vendor's fares divided by that vendor's highest fare (DOUBLE, as standardize_keep).
  function normFares() {
    const vendors = [1, 2];
    const rows = [];
    vendors.forEach((v) => {
      const idx = ALL.filter((i) => val(TRIPS, i, 'VendorID') === v);
      const max = Math.max(...idx.map(fare));
      idx.forEach((i) => rows.push({ trip: i + 1, vendor: v, fare: fare(i), max, normed: fare(i) / max }));
    });
    const t = dfFromRows([['VendorID', 'int'], ['fare_amount', 'double'], ['normed_fare', 'double']], rows.map((r) => [r.vendor, r.fare, r.normed]));
    const values = rows.map((r) => [tex(r.vendor), tex(dfJavaDouble(r.fare)), tex(dfJavaDouble(r.max)), tex(fmt4(r.normed))]);
    return { rows, showText: showText(t), show: txt(showText(t)), matrix: { rows: rows.map((r) => String(r.trip)), cols: ['VendorID', 'fare_amount', 'group max', 'normed_fare'], values } };
  }

  // ==========================================================================================
  // 7. SQL on a temporary view: WHERE, one row at a time
  // ==========================================================================================
  function whereView({ x = 20, upTo = 12 }) {
    const kept = ALL.filter((i) => fare(i) > x);
    const values = ALL.map((i) => [tex(pu(i)), tex(dfJavaDouble(fare(i))), i < upTo ? (fare(i) > x ? '\\checkmark' : '\\cdot') : '']);
    const t = dfFromRows([['PULocationID', 'int'], ['fare_amount', 'double']], kept.map((i) => [pu(i), fare(i)]));
    return { rows: tripNums(12), cols: ['PULocationID', 'fare_amount', 'kept'], values, kept: kept.map((i) => i + 1), n: kept.length, showText: showText(t), show: txt(showText(t)) };
  }
  // roles: sheet (Matrix of whereView). One step per row: the WHERE test.
  function whereWalk({ x = 20 }) {
    let n = 0;
    const trace = [{ label: `Test every row: is \`fare_amount > ${x}\`?`, patch: { whereUpTo: 0 }, ops: [{ role: 'sheet', cmd: 'clear' }] }];
    ALL.forEach((i) => {
      const ok = fare(i) > x;
      if (ok) n++;
      trace.push({ label: `Trip ${i + 1}: ${dfJavaDouble(fare(i))} > ${x}? ${ok ? 'yes, keep' : 'no, drop'}. Kept so far: ${n}.`, vars: { fare: fare(i), kept: n },
        patch: { whereUpTo: i + 1 }, ops: [{ role: 'sheet', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: ok ? 'good' : 'muted' } }] });
    });
    return { trace, steps: trace.length - 1, kept: n };
  }
  // roles: table (live Matrix of whereView with upTo 0), code, formula.
  function whereTrace({ x = 20 }) {
    let n = 0;
    const trace = [{ label: '`FROM trips`: Spark looks up the view called `trips`.', code: 'from', math: 'from', ops: [{ role: 'table', cmd: 'clear' }] }];
    ALL.forEach((i) => {
      const ok = fare(i) > x;
      if (ok) n++;
      trace.push({ label: `Trip ${i + 1}: ${dfJavaDouble(fare(i))} > ${x}? ${ok ? 'kept' : 'dropped'}`, code: 'where', math: 'where', vars: { fare: fare(i), kept: n },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel: 'row:' + (i + 1), tone: ok ? 'good' : 'muted' } },
          { role: 'table', cmd: 'fill', args: { cell: (i + 1) + ',kept', value: ok ? '\\checkmark' : '\\cdot' } }] });
    });
    trace.push({ label: `\`SELECT\` keeps two columns of the ${n} rows that passed.`, code: 'select', math: 'select', vars: { kept: n } });
    return { trace, kept: n };
  }

  // ==========================================================================================
  // 8. A registered lambda inside CASE WHEN
  // ==========================================================================================
  // double_distance(CAST(trip_distance AS FLOAT)) is FLOAT; CASE labels 'long' when it is > t.
  function caseView({ t = 10, limit = 10, cols = 'dd' }) {
    const n = Math.min(limit, 12);
    const rows = ALL.slice(0, n).map((i) => { const dd = f32(f32(dist(i)) * 2); return { trip: i + 1, d: dist(i), dd, type: dd > t ? 'long' : 'short' }; });
    const table = cols === 'dd'
      ? dfFromRows([['dd', 'float'], ['trip_type', 'string']], rows.map((r) => [r.dd, r.type]))
      : dfFromRows([['trip_distance', 'double'], ['trip_type', 'string']], rows.map((r) => [r.d, r.type]));
    const values = rows.map((r) => [tex(dfJavaDouble(r.d)), tex(dfJavaFloat(r.dd)), tex(r.type)]);
    const nLong = rows.filter((r) => r.type === 'long').length;
    return { showText: showText(table), show: txt(showText(table)), nLong, nShort: n - nLong, matrix: { rows: rows.map((r) => String(r.trip)), cols: ['trip_distance', 'dd', 'trip_type'], values },
      blank: { rows: rows.map((r) => String(r.trip)), cols: ['trip_distance', 'dd', 'trip_type'], values: values.map((v) => [v[0], v[1], '']) } };
  }
  // roles: table (live Matrix of caseView, trip_type blanked by the first op), code, formula.
  function caseTrace({ t = 10, limit = 10 }) {
    const c = caseView({ t, limit });
    const trace = [{ label: `\`LIMIT ${limit}\`: the first ${limit} trips.`, code: 'limit', math: 'limit', ops: [{ role: 'table', cmd: 'clear' }] }];
    ALL.slice(0, limit).forEach((i) => {
      const dd = f32(f32(dist(i)) * 2);
      const type = dd > t ? 'long' : 'short';
      trace.push({ label: `Trip ${i + 1}: $2 \\times ${dfJavaDouble(dist(i))} = ${dfJavaFloat(dd)}$`, code: 'dd', math: 'dd', vars: { trip_distance: dist(i), dd },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel: 'row:' + (i + 1) } }] });
      trace.push({ label: `${dfJavaFloat(dd)} > ${t}? ${dd > t ? 'yes' : 'no'}, so '${type}'`, code: 'case', math: 'case', vars: { dd, trip_type: type },
        ops: [{ role: 'table', cmd: 'fill', args: { cell: (i + 1) + ',trip_type', value: tex(type) } }] });
    });
    return { trace, nLong: c.nLong };
  }
  // The registered lambda's results in ORDER BY dd DESC, typed (FLOAT) or untyped (text, the default).
  function ddOrder({ asText = false }) {
    const items = ALL.map((i) => ({ d: dist(i), dd: asText ? dist(i) * 2 : f32(f32(dist(i)) * 2) }));
    const s = (o) => (asText ? dfJavaDouble(o.dd) : dfJavaFloat(o.dd));
    items.sort((p, q) => (asText ? (s(p) < s(q) ? 1 : s(p) > s(q) ? -1 : 0) : q.dd - p.dd));
    const t = dfFromRows([['trip_distance', 'double'], ['dd', asText ? 'string' : 'float']], items.map((o) => [o.d, asText ? s(o) : o.dd]));
    return { showText: showText(t), first: s(items[0]), last: s(items[items.length - 1]) };
  }

  // ==========================================================================================
  // 9. GROUP BY with an alias in backticks
  // ==========================================================================================
  function groupAvg({ key = 'VendorID', value = 'tip_amount', alias = 'mean tip', upTo = 9 }) {
    const keys = [...new Set(ALL.map((i) => val(TRIPS, i, key)))].sort((p, q) => p - q);
    const groups = keys.map((k) => {
      const idx = ALL.filter((i) => val(TRIPS, i, key) === k);
      const vals = idx.map((i) => val(TRIPS, i, value));
      const sum = vals.reduce((s, v) => s + v, 0);
      return { key: k, trips: idx.map((i) => i + 1), vals, sum, n: vals.length, mean: sum / vals.length };
    });
    const t = dfFromRows([[key, 'int'], [alias, 'double']], groups.map((g) => [g.key, g.mean]));
    const values = groups.map((g, k) => (k < upTo ? [tex(g.vals.map(dfJavaDouble).join(' + ')), tex(fmt4(g.sum)), tex(g.n), tex(fmt4(g.mean))] : [tex(g.vals.map(dfJavaDouble).join(' + ')), '', '', '']));
    return { groups, showText: showText(t), show: txt(showText(t)), rows: groups.map((g) => String(g.key)), cols: ['values', 'sum', 'n', 'mean'], values };
  }
  // roles: table (live Matrix of tripsView), code, formula. Per group: collect the rows, add, divide.
  function groupAvgTrace({ key = 'VendorID', value = 'tip_amount' }) {
    const g = groupAvg({ key, value });
    const trace = [{ label: `\`GROUP BY ${key}\`: one group per value.`, code: 'group', math: 'group', ops: [{ role: 'table', cmd: 'clear' }] }];
    g.groups.forEach((x) => {
      trace.push({ label: `${key} ${x.key}: trips ${x.trips.join(', ')}.`, code: 'group', math: 'group', vars: { group: x.key, n: x.n },
        ops: [{ role: 'table', cmd: 'highlight', args: { sel: x.trips.map((t) => 'row:' + t) } }] });
      trace.push({ label: `\`AVG\`: $${fmt4(x.sum)} / ${x.n} = ${fmt4(x.mean)}$`, code: 'avg', math: 'avg', vars: { group: x.key, mean: x.mean },
        ops: x.trips.map((t) => ({ role: 'table', cmd: 'annotate', args: { sel: 'row:' + t, text: 'group ' + x.key } })) });
    });
    trace.push({ label: 'The backticks make `mean tip`, with its space, one column name.', code: 'alias', math: 'alias', vars: {} });
    return { trace };
  }

  // ==========================================================================================
  // Application: Lia's notebook
  // ==========================================================================================
  // Mean fare of long (> 5 miles) and short trips, as the band UDF splits them (checked against REAL app.c3.fixed).
  function bandMeans({ cut = 5 }) {
    const bands = ['long', 'short'].map((b) => {
      const idx = ALL.filter((i) => (dist(i) > cut ? 'long' : 'short') === b);
      const sum = idx.reduce((s, i) => s + fare(i), 0);
      return { band: b, trips: idx.map((i) => i + 1), n: idx.length, sum, mean: sum / idx.length };
    });
    const t = dfFromRows([['band', 'string'], ['mean fare', 'double']], bands.map((b) => [b.band, b.mean]));
    return { bands, long: bands[0], short: bands[1], showText: showText(t), show: txt(showText(t)), nLong: bands[0].n };
  }

  // ==========================================================================================
  // Checks: engine text vs real text (examples.yaml)
  // ==========================================================================================
  const ENGINE_OF = {
    'udf.show': () => pairShow({}).text,
    'sql.pair_show': () => pairShow({ limit: 10 }).text,
    'udf.ddl_show': () => structShow({}).text,
    'udf.struct_show_full': () => structShow({ name: 'collect_user_info(user.id, user.name, user.description)' }).text,
    'pd.clip_show': () => clipView({ lo: 0, hi: 100, name: 'clipped_distance' }).showOnly,
    'pd.clip5_show': () => clipView({ lo: 0, hi: 5 }).showBoth,
    'pd.mask_demo': () => hashSheet({}).showText,
    'pd.fare_rate': () => fareRateView({}).showText,
    'pd.mean_udf': () => groupMeanSheet({}).showText,
    'pd.standardize_keep': () => normFares().showText,
    'sql.where': () => whereView({ x: 20 }).showText,
    'sql.case_when': () => caseView({ t: 10, limit: 10, cols: 'dd' }).showText,
    'sql.case_when_all': () => caseView({ t: 10, limit: 12, cols: 'distance' }).showText,
    'sql.typed_order': () => ddOrder({ asText: false }).showText,
    'sql.notype_show': () => ddOrder({ asText: true }).showText,
    'sql.alias_space_ok': () => groupAvg({}).showText,
    'app.c3.fixed': () => bandMeans({}).showText,
    'app.c5': () => rateOrder({ asText: true }).showText,
    'app.c5.typed': () => rateOrder({ asText: false }).showText,
    'setup.trips_schema': () => schemaText({ which: 'trips' }).text,
    'setup.tweets_schema': () => schemaText({ which: 'tweets' }).text,
  };
  function realMatch({ key }) {
    const f = ENGINE_OF[key];
    if (!f) throw new Error('no engine twin for ' + key);
    const real = realEntry(key).out.replace(/\n+$/, '');
    const engine = f().replace(/\n+$/, '');
    return { same: real === engine, real, engine };
  }

  // ==========================================================================================
  // GENERATORS (quiz). Every answer comes from the fns above or the same small formulas.
  // ==========================================================================================
  const ZONES = [7, 33, 41, 74, 75, 97, 132, 166];
  const mdTable = (cols, rows) => ['| ' + cols.join(' | ') + ' |', '|' + cols.map(() => ' ---: ').join('|') + '|'].concat(rows.map((r) => '| ' + r.join(' | ') + ' |')).join('\n');
  const pick1 = (rng, arr) => arr[rng.int(0, arr.length - 1)];
  const r2 = (x) => Math.round(x * 100) / 100;

  // How many different codes does pair_code produce for a small table?
  function pairDistinctQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 5 : 7;
      const pus = [7, 41, 74], dos = [41, 75, 238];
      const rows = Array.from({ length: n }, () => [pick1(rng, pus), pick1(rng, dos)]);
      const codes = rows.map((r) => r[0] + '-' + r[1]);
      const distinct = new Set(codes).size;
      const distinctPU = new Set(rows.map((r) => r[0])).size;
      if (distinct === n || distinct === distinctPU || distinct < 3) continue;
      return { vars: { n, distinct, distinctPU, table: mdTable(['row', 'PULocationID', 'DOLocationID'], rows.map((r, i) => [i + 1, r[0], r[1]])), codes: codes.join(', ') },
        misconceptions: [
          { var: 'n', feedback: 'That counts every row. Rows with the same pickup and drop-off give the same code.', for: 'distinct' },
          { var: 'distinctPU', feedback: 'That counts pickup zones only. The code joins **both** zones, so 7-41 and 7-75 differ.', for: 'distinct' },
        ] };
    }
  }
  // Batches: ceil(n / size) calls, and the size of the last batch.
  function batchQ({ rng, difficulty }) {
    for (;;) {
      const size = difficulty === 1 ? pick1(rng, [4, 5, 10]) : pick1(rng, [3, 4, 6, 7, 8]);
      const n = difficulty === 1 ? rng.int(11, 30) : rng.int(20, 60);
      const p = batchPlan({ n, size });
      if (n % size === 0 || p.count < 3 || p.count === p.last) continue;
      return { vars: { n, size, calls: p.count, last: p.last, floorCalls: Math.floor(n / size), sizesText: p.sizesText },
        misconceptions: [
          { var: 'floorCalls', feedback: 'You rounded down. The leftover rows still need a call of their own, so round **up**.', for: 'calls' },
          { var: 'n', feedback: 'That is one call per row, which is how a plain row-at-a-time UDF works. A pandas UDF gets whole batches.', for: 'calls' },
          { var: 'size', feedback: 'That is the size of a full batch. The last batch only holds the rows that are left.', for: 'last' },
          { var: 'calls', feedback: 'That is how many batches there are. The question asks how many rows the last one holds.', for: 'last' },
        ] };
    }
  }
  // np.clip: how many values change, and the sum after clipping.
  function clipQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 6 : 8;
      const lo = 0;
      const hi = pick1(rng, [5, 10, 20]);
      const xs = Array.from({ length: n }, () => (rng.int(-4, hi * 3) * 5) / 10);
      const out = xs.map((x) => clipOne(x, lo, hi));
      const changed = xs.filter((x, i) => out[i] !== x).length;
      const above = xs.filter((x) => x > hi).length;
      const below = xs.filter((x) => x < lo).length;
      const atOrAbove = xs.filter((x) => x >= hi).length;
      const sumOut = r2(out.reduce((s, v) => s + v, 0));
      const sumIn = r2(xs.reduce((s, v) => s + v, 0));
      const sumHighOnly = r2(xs.map((x) => Math.min(x, hi)).reduce((s, v) => s + v, 0));
      if (above < 1 || below < 1 || changed === atOrAbove + below || Math.abs(sumOut - sumHighOnly) < 0.3 || Math.abs(sumOut - sumIn) < 0.3) continue;
      return { vars: { n, lo, hi, values: xs.map(String).join(', '), changed, above, below, sumOut, sumIn, sumHighOnly, atOrAboveBelow: atOrAbove + below, clipped: out.map(String).join(', ') },
        misconceptions: [
          { var: 'above', feedback: 'You only counted values above the top. Values **below** the bottom are raised to it, and change too.', for: 'changed' },
          { var: 'atOrAboveBelow', feedback: 'A value exactly equal to a bound is already inside the range; `np.clip` leaves it as it is.', for: 'changed' },
          { var: 'sumIn', feedback: 'That is the sum before clipping. Replace each value outside the range by the bound first.', for: 'sumOut' },
          { var: 'sumHighOnly', feedback: 'You only lowered the big values. Negative values must be raised to the bottom bound, 0.', for: 'sumOut' },
        ] };
    }
  }
  // The iterator hash on small numbers.
  function hashQ({ rng, difficulty }) {
    for (;;) {
      const a = difficulty === 1 ? rng.int(2, 9) : rng.int(11, 47);
      const b = rng.int(3, 40);
      const c = difficulty === 1 ? pick1(rng, [7, 10, 11]) : pick1(rng, [13, 17, 100]);
      const x = rng.int(12, 99);
      const ax = a * x, axb = ax + b, h = axb % c;
      const noB = ax % c, plusAfter = (ax % c) + b, quotient = Math.floor(axb / c);
      if (new Set([h, noB, plusAfter, quotient]).size < 4 || h === 0) continue;
      return { vars: { a, b, c, x, ax, axb, h, noB, plusAfter, quotient },
        misconceptions: [
          { var: 'noB', feedback: 'You left out `+ b`. The formula adds b **before** taking the remainder.', for: 'h' },
          { var: 'plusAfter', feedback: 'You added b after the remainder. The brackets say $(a \\cdot x + b)$ first, then `% c`.', for: 'h' },
          { var: 'quotient', feedback: 'That is how many times c fits. `%` keeps the **remainder**, what is left over.', for: 'h' },
        ] };
    }
  }
  // Fare per mile for one trip.
  function fareRateQ({ rng, difficulty }) {
    for (;;) {
      const d = difficulty === 1 ? pick1(rng, [0.5, 1.25, 2, 2.5, 4]) : rng.int(3, 95) / 10;
      const f = rng.int(5, 70) / 2;
      const rate = f / d;
      if (Math.abs(rate - d / f) < 0.1 || rate > 40) continue;
      return { vars: { d, f, rate, inverse: d / f, product: f * d },
        misconceptions: [
          { var: 'inverse', feedback: 'You divided distance by fare: miles per dollar. The UDF yields `fare_amount / trip_distance`.', for: 'rate' },
          { var: 'product', feedback: 'You multiplied. Dollars **per** mile means divide by the miles.', for: 'rate' },
        ] };
    }
  }
  // Series to scalar: one group's mean.
  function groupMeanQ({ rng, difficulty }) {
    for (;;) {
      const codes = ['PH', 'JP', 'US'];
      const n = difficulty === 1 ? 5 : 7;
      const rows = Array.from({ length: n }, () => [pick1(rng, codes), rng.int(1, 40) * 50]);
      const target = pick1(rng, codes);
      const vals = rows.filter((r) => r[0] === target).map((r) => r[1]);
      if (vals.length < 2) continue;
      const sum = vals.reduce((s, v) => s + v, 0);
      const mean = sum / vals.length;
      const overall = rows.reduce((s, r) => s + r[1], 0) / n;
      if (Math.abs(mean - overall) < 5 || Math.abs(mean - sum) < 1) continue;
      return { vars: { n, target, mean, sum, overall, k: vals.length, values: vals.join(' + '), table: mdTable(['tweet', 'country_code', 'statuses_count'], rows.map((r, i) => [i + 1, r[0], r[1]])) },
        misconceptions: [
          { var: 'overall', feedback: 'That is the mean of **all** tweets. `groupby` sends each country its own Series.', for: 'mean' },
          { var: 'sum', feedback: 'You added the group up but did not divide by how many tweets it has.', for: 'mean' },
        ] };
    }
  }
  // applyInPandas: a fare divided by its own group's highest fare.
  function normFareQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 5 : 7;
      const rows = Array.from({ length: n }, () => [rng.int(1, 2), rng.int(8, 80) / 2]);
      const t = rng.int(0, n - 1);
      const v = rows[t][0];
      const grp = rows.filter((r) => r[0] === v).map((r) => r[1]);
      if (grp.length < 2) continue;
      const max = Math.max(...grp);
      const maxAll = Math.max(...rows.map((r) => r[1]));
      const sumGrp = grp.reduce((s, x) => s + x, 0);
      const normed = rows[t][1] / max;
      const wrongAll = rows[t][1] / maxAll;
      const wrongSum = rows[t][1] / sumGrp;
      if (normed === 1 || Math.abs(normed - wrongAll) < 0.03 || Math.abs(normed - wrongSum) < 0.03) continue;
      return { vars: { n, trip: t + 1, vendor: v, fareT: rows[t][1], max, normed, wrongAll, wrongSum, table: mdTable(['trip', 'VendorID', 'fare_amount'], rows.map((r, i) => [i + 1, r[0], r[1]])) },
        misconceptions: [
          { var: 'wrongAll', feedback: 'You divided by the highest fare of **all** trips. `applyInPandas` gives the function one vendor at a time, so `max()` is that vendor\'s.', for: 'normed' },
          { var: 'wrongSum', feedback: 'You divided by the group\'s total. The function divides by `.max()`, the highest fare.', for: 'normed' },
        ] };
    }
  }
  // WHERE: how many rows pass a strict test.
  function whereQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 6 : 9;
      const x = pick1(rng, [10, 15, 20]);
      const fares = Array.from({ length: n }, () => rng.int(8, 60) / 2);
      if (!fares.includes(x)) fares[rng.int(0, n - 1)] = x;
      const kept = fares.filter((f) => f > x).length;
      const atLeast = fares.filter((f) => f >= x).length;
      const notKept = n - kept;
      if (kept < 2 || kept === notKept || atLeast === kept) continue;
      return { vars: { n, x, kept, atLeast, notKept, fares: fares.join(', ') },
        misconceptions: [
          { var: 'atLeast', feedback: '`>` is strict: a fare exactly equal to the cut-off fails the test.', for: 'kept' },
          { var: 'notKept', feedback: 'That counts the rows WHERE **drops**. The result keeps the rows where the test is true.', for: 'kept' },
        ] };
    }
  }
  // CASE WHEN on a registered lambda that doubles the distance.
  function caseQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 1 ? 6 : 8;
      const t = pick1(rng, [6, 8, 10]);
      const ds = Array.from({ length: n }, () => rng.int(2, 2 * t) / 2);
      if (!ds.includes(t / 2)) ds[rng.int(0, n - 1)] = t / 2;
      const nLong = ds.filter((d) => d * 2 > t).length;
      const noDouble = ds.filter((d) => d > t).length;
      const atLeast = ds.filter((d) => d * 2 >= t).length;
      if (nLong < 2 || nLong === noDouble || nLong === atLeast || nLong === n) continue;
      return { vars: { n, t, nLong, noDouble, atLeast, nShort: n - nLong, dists: ds.join(', ') },
        misconceptions: [
          { var: 'noDouble', feedback: 'You compared the distance itself with the cut-off. The CASE tests `double_distance(...)`, twice the distance.', for: 'nLong' },
          { var: 'atLeast', feedback: '`>` is strict: a doubled distance exactly equal to the cut-off is still \'short\'.', for: 'nLong' },
        ] };
    }
  }
  // GROUP BY + AVG by hand.
  function groupAvgQ({ rng, difficulty }) {
    for (;;) {
      const n = difficulty === 2 ? 6 : 8;
      const rows = Array.from({ length: n }, () => [rng.int(1, 2), rng.int(0, 16) / 2]);
      const v = rng.int(1, 2);
      const vals = rows.filter((r) => r[0] === v).map((r) => r[1]);
      if (vals.length < 2 || vals.length === n) continue;
      const sum = vals.reduce((s, x) => s + x, 0);
      const k = vals.length;
      const mean = sum / k;
      const overall = rows.reduce((s, r) => s + r[1], 0) / n;
      const divN = sum / n;
      if (Math.abs(mean - overall) < 0.2 || Math.abs(mean - divN) < 0.2 || sum === 0) continue;
      return { vars: { n, v, sum, k, mean, overall, divN, table: mdTable(['trip', 'VendorID', 'tip_amount'], rows.map((r, i) => [i + 1, r[0], r[1]])) },
        misconceptions: [
          { var: 'divN', feedback: 'You divided by every trip in the table. `AVG` divides by the trips **in this group**.', for: 'mean' },
          { var: 'overall', feedback: 'That is the average over both vendors. `GROUP BY VendorID` makes one average per vendor.', for: 'mean' },
        ] };
    }
  }
  // Level-3 case: a registered band UDF, CASE-style labels and a per-band average.
  function bandCaseQ({ rng }) {
    for (;;) {
      const n = 7;
      const cut = pick1(rng, [3, 4, 5]);
      const rows = Array.from({ length: n }, () => [rng.int(2, 4 * cut) / 2, rng.int(8, 70) / 2]);
      if (rows.some((r) => r[0] === cut)) continue;
      const longIdx = rows.map((r, i) => i).filter((i) => rows[i][0] > cut);
      const nLong = longIdx.length;
      if (nLong < 2 || nLong > n - 2) continue;
      const sumLong = longIdx.reduce((s, i) => s + rows[i][1], 0);
      const meanLong = sumLong / nLong;
      const meanAll = rows.reduce((s, r) => s + r[1], 0) / n;
      const divN = sumLong / n;
      if (Math.abs(meanLong - meanAll) < 1 || Math.abs(meanLong - divN) < 1) continue;
      return { vars: { n, cut, nLong, nShort: n - nLong, sumLong, meanLong, meanAll, divN, table: mdTable(['trip', 'trip_distance', 'fare_amount'], rows.map((r, i) => [i + 1, r[0], r[1]])) },
        misconceptions: [
          { var: 'meanAll', feedback: 'That averages every trip. `GROUP BY band(trip_distance)` averages the long trips on their own.', for: 'meanLong' },
          { var: 'divN', feedback: 'You divided the long trips\' total by all trips. Divide by the number of long trips.', for: 'meanLong' },
        ] };
    }
  }

  return {
    fns: {
      realCell, realCells, tripsView, tweetsView, schemaText,
      pairSheet, pairWalk, pairCodeTrace, pairShow,
      returnTypeView, structSheet, structTrace, structShow,
      batchPlan, batchSheet, batchTrace,
      clipView, clipTrace,
      hashInt64, hashSheet, hashWalk, hashTrace, fareRateView, rateOrder,
      groupMeanSheet, groupMeanWalk, groupMeanTrace, normFares,
      whereView, whereWalk, whereTrace,
      caseView, caseTrace, ddOrder,
      groupAvg, groupAvgTrace,
      bandMeans, realMatch,
    },
    generators: { pairDistinctQ, batchQ, clipQ, hashQ, fareRateQ, groupMeanQ, normFareQ, whereQ, caseQ, groupAvgQ, bandCaseQ },
  };
}
