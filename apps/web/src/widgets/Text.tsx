import type { WidgetRenderProps } from '../engine/types';
import { Markdown } from '../lib/md';
export default function Text({ props }: WidgetRenderProps<{ body: string }>) {
  return <div className="card px-4 py-3"><Markdown text={props.body} /></div>;
}
