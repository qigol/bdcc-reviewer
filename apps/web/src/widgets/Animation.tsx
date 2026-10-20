import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { animationFrames, animationKind } from '@kodigo/schema';
import type { WidgetRenderProps } from '../engine/types';
import { ownCmds } from '../engine/marks';
import { Markdown } from '../lib/md';
import { cn } from '../lib/util';

/**
 * Animation (guide §9a): a short, silent clip from the module's assets/, rendered with HyperFrames and converted by
 * `pnpm kodigo animation`. Plays a video (best source first), an animated image or a frame folder.
 *
 * - muted; loops unless `loop: false` (then holds the last frame, and stays there when scrolled away and back);
 *   plays while ≥ 1/3 is on screen (not counting the part under the narration card), pauses when not
 * - `start` / `end` play one segment of the clip, so several widgets can show the parts of one clip on different beats
 * - commands `play`, `pause`, `restart`, `seek {t}`; event `ended` on every pass
 * - reduced motion: never starts by itself; shows the segment's last frame, and Play shows 3–4 still frames that crossfade
 */
interface P {
  src: string | string[]; alt: string; poster?: string; srcDark?: string | string[]; posterDark?: string;
  caption?: string; width?: number; aspect?: string; loop?: boolean; autoplay?: boolean; controls?: boolean;
  rate?: number; start?: number; end?: number; fps?: number; bare?: boolean; stills?: number[];
}

const VIDEO_TYPE: Record<string, string> = { webm: 'video/webm', mp4: 'video/mp4', m4v: 'video/mp4' };
const STILL_HOLD_MS = 1400;
const FADE_MS = 450;
const EPS = 1 / 60;

function useDarkTheme(): boolean {
  const get = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(get);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(get()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

/** Plays frames of a frame folder on a timeline, with the same API as a <video>. */
class FramePlayer {
  time = 0;
  paused = true;
  private raf = 0;
  private last = 0;
  constructor(public frames: HTMLImageElement[], public fps: number, private draw: (i: number) => void, private onTick: () => void) {}
  get duration() { return this.frames.length / this.fps; }
  seek(t: number) { this.time = Math.max(0, Math.min(t, this.duration - EPS)); this.draw(Math.floor(this.time * this.fps)); this.onTick(); }
  play() {
    if (!this.paused) return;
    this.paused = false;
    this.last = performance.now();
    const step = (now: number) => {
      if (this.paused) return;
      this.time += (now - this.last) / 1000 * this.rate;
      this.last = now;
      this.draw(Math.min(this.frames.length - 1, Math.floor(this.time * this.fps)));
      this.onTick();
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  pause() { this.paused = true; cancelAnimationFrame(this.raf); }
  rate = 1;
}

export default function Animation({ props, cmds, marks, emit, ctx }: WidgetRenderProps<P>) {
  const reduced = ctx.reducedMotion;
  const dark = useDarkTheme();
  const list = (v: string | string[] | undefined) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]).filter((s) => typeof s === 'string' && s);
  const srcs = dark && props.srcDark ? list(props.srcDark) : list(props.src);
  const srcKey = srcs.join('|');
  const posterPath = dark && props.posterDark ? props.posterDark : props.poster;
  const kind = srcs.length ? animationKind(srcs[0]) : 'unsupported';
  const url = useCallback((p: string) => (/^(https?:|data:|blob:)/.test(p) ? p : ctx.mod.fileUrl(p)), [ctx.mod]);
  const poster = posterPath ? url(posterPath) : undefined;
  const loop = props.loop !== false;
  const autoplay = props.autoplay !== false;
  const controls = props.controls !== false;
  const rate = typeof props.rate === 'number' && props.rate > 0 ? props.rate : 1;
  // start/end may come from scene state (`start: '@animFrom'`), so a beat can move the clip to its next segment
  const start = typeof props.start === 'number' ? Math.max(0, props.start) : 0;
  const endProp = typeof props.end === 'number' ? props.end : undefined;
  const segmented = typeof props.start === 'number' || endProp !== undefined;

  const boxRef = useRef<HTMLDivElement>(null);
  const videoA = useRef<HTMLVideoElement>(null);
  const videoB = useRef<HTMLVideoElement>(null); // reduced motion: the second still for crossfades
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frames = useRef<FramePlayer | null>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [front, setFront] = useState<0 | 1>(0);
  const [showImage, setShowImage] = useState(!reduced); // animated images under reduced motion wait for Play
  const userPaused = useRef(false);
  const finished = useRef(false); // a `loop: false` pass reached its end: scrolling back must not restart it
  const stillsWhenReady = useRef(false); // reduced motion: Play was pressed before the video's details loaded
  const runStillsRef = useRef<() => void>(() => {});
  const timers = useRef<number[]>([]);
  const clearTimers = () => { timers.current.forEach((t) => clearTimeout(t)); timers.current = []; };
  const emitRef = useRef(emit);
  emitRef.current = emit;

  const end = Math.min(endProp ?? (duration || Infinity), duration || Infinity);
  /** the live segment and settings, read by the media event handlers */
  const seg = useRef({ start, end, loop, reduced });
  seg.current = { start, end, loop, reduced };

  // ---------------------------------------------------------------- a uniform handle over <video> and frame folders
  const ctl = useMemo(() => {
    const media = () => (kind === 'frames' ? frames.current : videoA.current);
    const segEnd = (d: number) => Math.min(seg.current.end, d || Infinity);
    const now = () => { const m = media(); return !m ? 0 : m instanceof FramePlayer ? m.time : m.currentTime; };
    const seekTo = (t: number) => {
      const m = media();
      if (!m) return;
      const d = m instanceof FramePlayer ? m.duration : m.duration;
      const tt = Math.max(seg.current.start, Math.min(t, segEnd(d) - EPS));
      if (m instanceof FramePlayer) m.seek(tt); else m.currentTime = tt;
      setTime(tt);
    };
    const play = () => {
      const m = media();
      if (!m) return;
      const d = m.duration;
      const cur = now();
      if (cur >= segEnd(d) - EPS * 2 || cur < seg.current.start - EPS) seekTo(seg.current.start);
      if (m instanceof FramePlayer) m.play();
      else m.play().catch(() => setPlaying(false));
    };
    const pause = () => { media()?.pause(); };
    /** the segment reached its end: emit, then loop or hold the last frame */
    const atEnd = () => {
      const m = media();
      if (!m) return;
      emitRef.current('ended');
      if (!seg.current.loop) finished.current = true;
      if (seg.current.loop) { seekTo(seg.current.start); play(); } else { m.pause(); seekTo(segEnd(m.duration) - EPS); }
    };
    return { media, seekTo, play, pause, atEnd, segEnd, now };
  }, [kind]);

  // ---------------------------------------------------------------- video wiring
  useEffect(() => {
    const v = videoA.current;
    if (kind !== 'video' || !v) return;
    setReady(false); setFailed(false);
    const onMeta = () => { setDuration(v.duration); setReady(true); v.playbackRate = rate; };
    let raf = 0;
    const watch = () => {
      setTime(v.currentTime);
      if (!v.paused && v.currentTime >= ctl.segEnd(v.duration) - EPS && ctl.segEnd(v.duration) < v.duration - EPS) ctl.atEnd();
      if (!v.paused) raf = requestAnimationFrame(watch);
    };
    const onPlay = () => { setPlaying(true); cancelAnimationFrame(raf); raf = requestAnimationFrame(watch); };
    const onPause = () => { setPlaying(false); setTime(v.currentTime); };
    const onEnded = () => { setPlaying(false); ctl.atEnd(); };
    const onError = () => setFailed(true);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    const sources = Array.from(v.querySelectorAll('source'));
    sources[sources.length - 1]?.addEventListener('error', onError); // fires when the last candidate fails
    if (v.readyState >= 1) onMeta();
    return () => {
      cancelAnimationFrame(raf);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
      sources[sources.length - 1]?.removeEventListener('error', onError);
    };
  }, [kind, srcKey, ctl]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const v = videoA.current;
    if (v) v.playbackRate = rate;
    if (frames.current) frames.current.rate = rate;
  }, [rate, ready]);

  // ---------------------------------------------------------------- frame folder wiring
  const framePaths = useMemo(() => {
    if (kind !== 'frames') return [];
    const all = [...Object.keys(ctx.mod.files), ...ctx.mod.binary];
    return animationFrames(srcs[0], [...new Set(all)]);
  }, [kind, srcKey, ctx.mod]); // eslint-disable-line react-hooks/exhaustive-deps
  const fps = typeof props.fps === 'number' && props.fps > 0 ? props.fps : 30;
  useEffect(() => {
    if (kind !== 'frames' || !framePaths.length) return;
    let alive = true;
    setReady(false); setFailed(false);
    const imgs = framePaths.map((p) => { const im = new Image(); im.src = url(p); return im; });
    Promise.all(imgs.map((im) => im.decode())).then(() => {
      if (!alive) return;
      const cv = canvasRef.current!;
      cv.width = imgs[0].naturalWidth; cv.height = imgs[0].naturalHeight;
      const g = cv.getContext('2d')!;
      let lastEnded = false;
      const fp = new FramePlayer(imgs, fps, (i) => { g.clearRect(0, 0, cv.width, cv.height); g.drawImage(imgs[Math.max(0, i)], 0, 0); }, () => {
        setTime(fp.time);
        const done = !fp.paused && fp.time >= ctl.segEnd(fp.duration) - EPS;
        if (done && !lastEnded) { lastEnded = true; setPlaying(false); ctl.atEnd(); } else if (!done) lastEnded = false;
      });
      frames.current = fp;
      setDuration(fp.duration);
      setReady(true);
    }).catch(() => alive && setFailed(true));
    return () => { alive = false; frames.current?.pause(); frames.current = null; };
  }, [kind, framePaths, fps, ctl]); // eslint-disable-line react-hooks/exhaustive-deps
  // keep the play state of the frame player in React state
  useEffect(() => {
    if (kind !== 'frames') return;
    const id = window.setInterval(() => setPlaying(!!frames.current && !frames.current.paused), 150);
    return () => clearInterval(id);
  }, [kind]);

  // ---------------------------------------------------------------- the segment: first frame, and replay when a beat moves it
  const segKey = `${start}:${endProp ?? ''}`;
  const placed = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    const first = placed.current === null;
    if (placed.current === segKey + (reduced ? ':r' : '')) return;
    placed.current = segKey + (reduced ? ':r' : '');
    clearTimers();
    setFront(0);
    finished.current = false;
    if (reduced) {
      // reduced motion: show the segment's last frame (the poster of this part of the clip)
      ctl.pause();
      ctl.seekTo(ctl.segEnd(duration) - EPS);
      if (videoB.current) videoB.current.currentTime = Math.max(start, ctl.segEnd(duration) - EPS);
      if (stillsWhenReady.current) { stillsWhenReady.current = false; runStillsRef.current(); }
      return;
    }
    userPaused.current = false;
    ctl.seekTo(start);
    if (!first && visible && autoplay) ctl.play();
  }, [ready, segKey, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- visibility: play while ≥ 1/3 on screen
  // the narration card sticks over the bottom of the screen, so the strip under it doesn't count as on screen
  const cover = ctx.coverBottom;
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((es) => { for (const e of es) setVisible(e.intersectionRatio >= 1 / 3); },
      { threshold: [0, 1 / 3, 0.6, 1], rootMargin: `0px 0px -${Math.max(0, Math.round(cover))}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [cover]);
  useEffect(() => {
    if (reduced || kind === 'image') return;
    if (!ready) {
      // some browsers (iOS Low Power Mode…) skip preloading; asking to play is what makes them load the clip
      if (kind === 'video' && visible && autoplay && !userPaused.current && !finished.current) videoA.current?.play().catch(() => {});
      return;
    }
    if (visible && autoplay && !userPaused.current && !finished.current) ctl.play();
    if (!visible) ctl.pause();
  }, [visible, ready, reduced, autoplay, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // a beat that shows the clip, or moves it to its next part, brings it into view above the narration card
  const coverRef = useRef(cover);
  coverRef.current = cover;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // only where a narration card covers the screen (cover > 0); by 350 ms the card's height has settled
    const id = window.setTimeout(() => { if (coverRef.current > 0) el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }); }, 350);
    return () => clearTimeout(id);
  }, [segKey, reduced]);

  // ---------------------------------------------------------------- reduced motion: crossfading stills
  const stillTimes = useMemo(() => {
    const e = Number.isFinite(end) ? end : 0;
    const given = (props.stills ?? []).filter((t) => t >= start && t <= e);
    const ts = given.length ? given : [1, 2, 3, 4].map((k) => start + ((e - start) * k) / 4);
    return [...new Set(ts.map((t) => Math.min(Math.max(start, t), e - EPS)))].sort((a, b) => a - b);
  }, [props.stills, start, end]);
  const runStills = useCallback(() => {
    clearTimers();
    if (kind === 'frames') {
      // a canvas can't crossfade with itself: step through the stills
      stillTimes.forEach((t, k) => timers.current.push(window.setTimeout(() => ctl.seekTo(t), k * STILL_HOLD_MS)));
      timers.current.push(window.setTimeout(() => emitRef.current('ended'), stillTimes.length * STILL_HOLD_MS));
      return;
    }
    const players = [videoA.current, videoB.current];
    if (!players[0] || !players[1]) return;
    let cur: 0 | 1 = front;
    setPlaying(true);
    const show = (k: number) => {
      const next: 0 | 1 = cur === 0 ? 1 : 0;
      const v = players[next]!;
      const reveal = () => {
        v.removeEventListener('seeked', reveal);
        cur = next;
        setFront(next);
        setTime(stillTimes[k]);
        if (k + 1 < stillTimes.length) timers.current.push(window.setTimeout(() => show(k + 1), STILL_HOLD_MS));
        else timers.current.push(window.setTimeout(() => { setPlaying(false); emitRef.current('ended'); }, FADE_MS));
      };
      v.addEventListener('seeked', reveal);
      v.currentTime = stillTimes[k];
    };
    show(0);
  }, [kind, stillTimes, ctl, front]);
  runStillsRef.current = runStills;
  useEffect(() => () => clearTimers(), []);

  // ---------------------------------------------------------------- beat commands (each new command runs once)
  const done = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!ready) return;
    for (const c of ownCmds(cmds)) {
      if (done.current.has(c.seq)) continue;
      done.current.add(c.seq);
      const t = Number((c.args as any)?.t);
      if (c.cmd === 'pause') { userPaused.current = true; ctl.pause(); }
      if (c.cmd === 'seek' && Number.isFinite(t)) { ctl.pause(); ctl.seekTo(t); }
      if (c.cmd === 'play' || c.cmd === 'restart') {
        userPaused.current = false;
        finished.current = false;
        if (reduced) { clearTimers(); setFront(0); ctl.seekTo(start); continue; } // reduced motion: a beat's play/restart only rewinds
        if (c.cmd === 'restart') ctl.seekTo(start);
        ctl.play();
      }
    }
  }, [cmds, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- controls
  /** Play / Restart pressed before a video's details loaded: start it anyway (that makes the browser load it) */
  const earlyPlay = () => {
    if (kind !== 'video' || ready) return false;
    userPaused.current = false;
    finished.current = false;
    if (reduced) {
      // prime both players (browsers that skip preloading), then show the key frames once the clip is ready
      stillsWhenReady.current = true;
      for (const v of [videoA.current, videoB.current]) v?.play().then(() => v.pause()).catch(() => {});
    } else videoA.current?.play().catch(() => {});
    return true;
  };
  const toggle = () => {
    if (earlyPlay()) return;
    if (!ready) return;
    finished.current = false;
    if (reduced) { if (kind === 'image') setShowImage(true); else runStills(); return; }
    if (playing) { userPaused.current = true; ctl.pause(); } else { userPaused.current = false; ctl.play(); }
  };
  const restart = () => {
    if (earlyPlay()) return;
    if (!ready) return;
    userPaused.current = false;
    finished.current = false;
    if (reduced) { if (kind !== 'image') { setFront(0); ctl.seekTo(start); runStills(); } return; }
    ctl.seekTo(start);
    ctl.play();
  };

  const tone = marks.tone('frame');
  const note = marks.note('frame');
  const width = props.width ?? 760;
  const [aw, ah] = (props.aspect ?? '16:9').split(/[:/]/).map(Number);
  const segLen = Number.isFinite(end) ? end - start : 0;
  const pct = segLen > 0 ? Math.max(0, Math.min(100, ((time - start) / segLen) * 100)) : 0;
  const videoPoster = segmented ? undefined : poster; // a segment's own frame shows instead of the clip's poster
  const sources = srcs.map((s) => <source key={s} src={url(s)} type={VIDEO_TYPE[s.split('.').pop()!.toLowerCase()]} />);
  const missing = failed || !srcs.length || (kind === 'frames' && !framePaths.length) || kind === 'unsupported';

  return (
    <figure className={cn('mx-auto w-full overflow-hidden', !props.bare && 'card p-0', tone && `tone-${tone} mark-bg`, marks.pulse('frame') && 'pulse')} style={{ maxWidth: width }}>
      <div ref={boxRef} role="img" aria-label={props.alt} className="relative w-full overflow-hidden bg-[#0B1D3A]" style={{ aspectRatio: aw && ah ? `${aw} / ${ah}` : '16 / 9', scrollMarginBottom: cover + 8 }}>
        {missing ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/85">{props.alt}</div>
        ) : kind === 'video' ? (
          <>
            <video key={`a:${srcs.join('|')}`} ref={videoA} muted playsInline preload={reduced ? 'auto' : 'metadata'} poster={videoPoster} aria-hidden
              className="absolute inset-0 h-full w-full object-contain transition-opacity ease-in-out" style={{ opacity: !reduced || front === 0 ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}>
              {sources}
            </video>
            {reduced && (
              <video key={`b:${srcs.join('|')}`} ref={videoB} muted playsInline preload="auto" aria-hidden
                className="absolute inset-0 h-full w-full object-contain transition-opacity ease-in-out" style={{ opacity: front === 1 ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}>
                {sources}
              </video>
            )}
          </>
        ) : kind === 'frames' ? (
          <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full object-contain" />
        ) : showImage || !poster ? (
          <img src={url(srcs[0])} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain" onLoad={() => setReady(true)} onError={() => setFailed(true)} />
        ) : (
          <img src={poster} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain" onLoad={() => setReady(true)} />
        )}
        {note && <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">{note}</div>}
      </div>
      {controls && !missing && (kind !== 'image' || (reduced && !showImage)) && (
        <div className="flex items-center gap-2 px-3 py-2">
          <button className="btn-ghost btn-sm" onClick={toggle} disabled={!ready && kind === 'frames'} aria-label={playing ? 'Pause animation' : 'Play animation'} title={playing ? 'Pause' : reduced ? 'Show the key frames' : 'Play'}>
            {playing && !reduced ? <Pause size={15} /> : <Play size={15} />}
          </button>
          {kind !== 'image' && (
            <>
              <button className="btn-ghost btn-sm" onClick={restart} disabled={!ready && kind === 'frames'} aria-label="Restart animation" title="Restart"><RotateCcw size={15} /></button>
              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%`, transition: reduced ? `width ${FADE_MS}ms ease` : undefined }} />
              </div>
            </>
          )}
          {reduced && <span className="text-xs text-muted">Reduced motion: key frames</span>}
        </div>
      )}
      {props.caption && <figcaption className="px-3 pb-3 text-center text-xs text-muted"><Markdown text={props.caption} inline /></figcaption>}
    </figure>
  );
}
