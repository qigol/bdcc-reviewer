import type { WidgetRenderProps } from '../engine/types';
import { Markdown } from '../lib/md';
export default function Image({ props, ctx }: WidgetRenderProps<{ src: string; alt: string; caption?: string; width?: number }>) {
  const src = /^https?:|^data:|^blob:/.test(props.src) ? props.src : ctx.mod.fileUrl(props.src);
  return (
    <figure className="card p-3">
      <img src={src} alt={props.alt} style={{ width: props.width }} className="mx-auto max-w-full rounded" />
      {props.caption && <figcaption className="mt-2 text-center text-xs text-muted"><Markdown text={props.caption} inline /></figcaption>}
    </figure>
  );
}
