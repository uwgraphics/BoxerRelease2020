import { Predicate } from './components/constraints/types';

export interface BoxProps {
  classes: Set<string>;
  classifiers: Set<string>;
  features: Set<string>;
  instances: Set<string>;
}

export enum EntityType {
  Class =  'class',
  Classifier = 'classifier',
  Instance = 'instance',
}

export type Feature
  = FeatureCategorical
  | FeatureInterval
  | FeatureNominal
  | FeatureOrdinal
  | FeatureRatio;

export interface FeatureCategorical {
  type: 'categorical';
  description: string;
  categories: string[];
}

export interface FeatureInterval {
  type: 'interval';
  description: string;
  bounds?: [number, number];
}

export interface FeatureNominal {
  type: 'nominal';
  description: string;
}

export interface FeatureOrdinal {
  type: 'ordinal';
  description: string;
  categories: string[];
}

export interface FeatureRatio {
  type: 'ratio';
  description: string;
  bounds?: [number, number];
}

export enum FilterAction {
  Set,
  Clear,
  Add,
  Remove,
}

export interface Instance {
  actual: string;
  predictions: {[classifierName: string]: string};
  features: {[featureName: string]: number | string};
}

export interface InstanceWithId extends Instance {
  id: string;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Metrics {
  // actual and predicted of a class
  actual: {
    [className: string]:  Set<String>,/*{
      predicted: {},
      actual: Set<String>,
      false: Set<String>,
      true: Set<String>,
      tp:  Set<String>,
      fp: Set<String>,
      fn: Set<String>,
      tn: Set<String>,
    },*/
  };
  predicted: {
    [className: string]:  Set<String>,
  };
  // true and false of a class
  true: {
    [className: string]:  Set<String>,
  };
  false: {
    [className: string]:  Set<String>,
  };
  // tp, fp, fn of a class
  tp: {
    [className: string]:  Set<String>,
  }
  fp:  {
    [className: string]:  Set<String>,
  }
  fn:  {
    [className: string]:  Set<String>,
  }
  tn:  {
    [className: string]:  Set<String>,
  }
  // scrores
  accuracy: number;
  microf1: {
    average: number,
  };
  macrof1: {
    average: number,
  };
  f1: {
    average: number,
    [className: string]: number,
  };
  precision: {
    average: number,
    [className: string]: number,
  };
  recall: {
    average: number,
    [className: string]: number,
  };
  mcc: {
    average: number,
  }
  acc: {
    average: number,
  }
}

export enum SelectionAction {
  Include = 'include',
  Exclude = 'exclude',
}

export interface SelectionRecord {
  description: string;
  id: number;
  instances: Set<string>;
  name: string;
  predicate?: Predicate;
}

export enum SelectionStrategy {
  Any,
  All,
}

export enum SetCompose {
  AND = 'and',
  MINUS = 'minus',
  OR = 'or',
  XOR = 'xor',
}

export interface Visualization {
  boxProps: BoxProps;
  name: VisualizationType;
}

export enum VisualizationType {
  //ACD = 'ActualClassDistribution',
  //AS = 'AgreementStrip',
  CA = 'Performance_Overall',
  SCP = 'Performance_Selection',
  COV = 'Performance_Per_Class',
  //CD = 'Histogram_',
  CMG = 'ConfusionMatrixGrid',
  //H = 'Histogram',
  FH = 'Histogram',
  //F = 'Faceted',
  OCA = 'CumulativeAccuracy',
  PCC = 'PairwiseClassifierConsensus',
  SM = 'MetricsTable',
  SMP = 'MetricsParallel',
  ITL = 'InstanceList',
}
