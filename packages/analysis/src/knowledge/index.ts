import { EDGES, NODES } from './data';
import { KnowledgeGraph } from './graph';

export * from './graph';
/** Uygulamanın tek bilgi grafiği (genel anatomi-fizyoloji bilgisi). */
export const GRAPH = new KnowledgeGraph(NODES, EDGES);
