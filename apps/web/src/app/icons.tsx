import { BarChart3, BookOpen, Brain, Boxes, Database, Film, Grid3x3, Layers, Network, ShoppingBasket, Sigma, Sparkles, Users, Workflow, Cloud, Cpu, GitBranch, Table } from 'lucide-react';

const ICONS: Record<string, any> = {
  'shopping-basket': ShoppingBasket, users: Users, 'grid-3x3': Grid3x3, layers: Layers, 'book-open': BookOpen, brain: Brain,
  boxes: Boxes, database: Database, film: Film, network: Network, sigma: Sigma, sparkles: Sparkles, workflow: Workflow,
  'bar-chart-3': BarChart3, cloud: Cloud, cpu: Cpu, 'git-branch': GitBranch, table: Table,
};
export function ModuleIcon({ name, size = 18 }: { name?: string; size?: number }) {
  const I = (name && ICONS[name]) || BookOpen;
  return <I size={size} />;
}
