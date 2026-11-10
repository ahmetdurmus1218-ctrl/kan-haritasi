import type { SimModel } from './types';
import { cardiac } from './models/cardiac';
import { gas } from './models/gas';
import { glucose } from './models/glucose';
import { kidney } from './models/kidney';
import { acidbase } from './models/acidbase';
import { neuron } from './models/neuron';
import { muscle } from './models/muscle';
import { thyroid } from './models/thyroid';
import { iron } from './models/iron';
import { fluid } from './models/fluid';
import { clot } from './models/clot';
import { immune } from './models/immune';
import { bilirubin } from './models/bilirubin';
import { digestion } from './models/digestion';

/** Fizyoloji modelleri (gösterim sırasıyla). */
export const SIM_MODELS: SimModel[] = [cardiac, gas, glucose, kidney, acidbase, fluid, iron, thyroid, neuron, muscle, digestion, bilirubin, clot, immune];

export const simModelById = new Map(SIM_MODELS.map((m) => [m.id, m]));
