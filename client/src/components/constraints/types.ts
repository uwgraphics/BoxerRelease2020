export interface Constraint {
  negation: boolean;
  rule: Rule;
  classifier: string;
  classifier2: string;
  target: string;
  feature: string;
  value: string;
  numericValue: number;
}

export enum PlaceHolder {
  classifier = '[ Classifier ]',
  feature = '[ Feature ]',
  rule = '[ Rule ]',
  target = '[ Target Class ]',
}

export enum Rule {
  ACTUAL = 'True target class',
  AGREE = 'Classifiers agree',
  FEATURE_EQ = 'Feature equals',
  FEATURE_GT = 'Feature greater than',
  FEATURE_LT = 'Feature less than',
  NONE = '',
  PREDICTED = 'Classifier predicted target class',
  RIGHT = 'Classifier was right',
}

export type Predicate
  = PredicateSimple
  | PredicateComposed
  | PredicateNegated;

export interface PredicateSimple {
  type: 'simple';
  constraints: Constraint[];
  metric:[]
}

export interface PredicateComposed {
  type: 'and' | 'or';
  predicates: Predicate[];
}

export interface PredicateNegated {
  type: 'negated';
  predicate: Predicate;
}
