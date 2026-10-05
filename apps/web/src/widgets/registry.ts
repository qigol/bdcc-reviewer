import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { WidgetRenderProps } from '../engine/types';

type W = LazyExoticComponent<ComponentType<WidgetRenderProps<any>>>;

/** Widget name → lazily loaded React component. Contracts live in packages/schema/src/widgets.ts. */
export const WIDGET_COMPONENTS: Record<string, W> = {
  TransactionTable: lazy(() => import('./TransactionTable')),
  ItemsetLattice: lazy(() => import('./ItemsetLattice')),
  Venn: lazy(() => import('./Venn')),
  Matrix: lazy(() => import('./Matrix')),
  MatrixProduct: lazy(() => import('./MatrixProduct')),
  VectorPlot: lazy(() => import('./VectorPlot')),
  FunctionPlot: lazy(() => import('./FunctionPlot')),
  Chart: lazy(() => import('./Chart')),
  RankList: lazy(() => import('./RankList')),
  DropBins: lazy(() => import('./DropBins')),
  Tree: lazy(() => import('./Tree')),
  Formula: lazy(() => import('./Formula')),
  Code: lazy(() => import('./Code')),
  StepPlayer: lazy(() => import('./StepPlayer')),
  Slider: lazy(() => import('./Slider')),
  Choice: lazy(() => import('./Choice')),
  Readout: lazy(() => import('./Readout')),
  Callout: lazy(() => import('./Callout')),
  Journal: lazy(() => import('./Journal')),
  TAccounts: lazy(() => import('./TAccounts')),
  Schedule: lazy(() => import('./Schedule')),
  Text: lazy(() => import('./Text')),
  Image: lazy(() => import('./Image')),
};

export function getWidget(name: string): W | undefined {
  return WIDGET_COMPONENTS[name];
}
