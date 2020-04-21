import store from '../../store';

import * as d3 from 'd3';

import {
  Constraint,
  Predicate,
  PredicateComposed,
  PredicateNegated,
  Rule,
  PredicateSimple,
} from './types';

import { Instance } from '../../types';
import { instanceById, featureByName } from '../../utils';

interface Buckets {
  [key: string]: string[];
}

interface BucketCounts {
  [key: string]: number;
}

type Filter = (id: string) => boolean;

interface ConstraintParameters {
  negation?: boolean;
  rule: Rule;
  classifier?: string;
  classifier2?: string;
  target?: string;
  feature?: string;
  value?: string;
  numericValue?: number;
}

export function average(array: number[]) {
  return sum(array) / array.length;
}

export function blankConstraint(): Constraint {
  const constraint: Constraint = {
    negation: false,
    rule: Rule.NONE,
    classifier: '',
    classifier2: '',
    target: '',
    feature: '',
    value: '',
    numericValue: 0,
  };
  return constraint;
}

export function bucketCategorical(featureName: string, instances: string[]): Buckets {
  const buckets: Buckets = {};

  const feature = featureByName(featureName);
  if (feature.type !== 'categorical') {
    console.error(`${featureName} is not a categorical feature`);
    return buckets;
  }

  feature.categories.forEach((category) => {
    const constraint = createConstraint({
      rule: Rule.FEATURE_EQ,
      feature: featureName,
      value: category,
    });
    const predicate = createSimplePredicate(constraint);
    buckets[category] = instancesFromPredicate(predicate, instances);
  });

  return buckets;
}

export function bucketCount(featureName: string, instances: string[]): BucketCounts {
  const feature = featureByName(featureName);
  let buckets: Buckets = {};
  if (feature.type === 'categorical') {
    buckets = bucketCategorical(featureName, instances);
  } else if (['interval', 'ratio'].includes(feature.type)) {
    buckets = bucketNumeric(featureName, instances);
  } else {
    console.error(featureName, 'could not be bucketed because of invalid type.');
  }
  const bucketCounts: BucketCounts = {};
  Object.keys(buckets).forEach((key) => {
    bucketCounts[key] = buckets[key].length;
  });
  return bucketCounts;
}

export function bucketCountNormalized(featureName: string, instances: string[]): BucketCounts {
  const bucketCounts = bucketCount(featureName, instances);
  const countTotal = sum(Object.values(bucketCounts));
  const bucketCountsNormalized: BucketCounts = {};
  Object.keys(bucketCounts).forEach((key) => {
    bucketCountsNormalized[key] = bucketCounts[key] / countTotal;
  });
  return bucketCountsNormalized;
}

export function bucketNumeric(featureName: string, instances: string[]): Buckets {
  const buckets: Buckets = {};

  const feature = featureByName(featureName);
  if (!['interval', 'ratio'].includes(feature.type)) {
    console.error(`${featureName} is not a numeric feature`);
    return buckets;
  }

  const getBins = (): Array<d3.Bin<string, number>> => {
    const numberOfBins = 10;
    const featureValues = instances.map((id) => instanceById(id).features[featureName] as number);
    const xMin = Math.min(...featureValues);
    const xMax = Math.max(...featureValues);

    const bins = d3.histogram<string, number>()
      .domain([xMin, xMax])
      .thresholds(numberOfBins)
      .value((id: string) => {
        const i = instanceById(id);
        const value = i.features[featureName];
        return value as number;
      })
      (instances);

    bins.forEach((bin) => {
      delete bin.x0;
      delete bin.x1;
    });
    // console.log('bins', bins);

    return bins;
  };

  getBins().forEach((binnedInstances, index) => {
    buckets[index] = binnedInstances;
  });

  return buckets;
}

export function compareFeatureInterestingness() {
  const interestingness = (candidate: BucketCounts, baseline: BucketCounts) => {
    const interests: number[] = [];
    Object.keys(candidate).forEach((key) => {
      const expected = baseline[key];
      if (expected === 0) {
        return;
      }
      const observed = candidate[key];
      let interest = 0;
      if (observed < expected) {
        const lowerBound = 0;
        const upperBound = expected;
        interest = (observed - lowerBound) / (upperBound - lowerBound);
        interest = 1 - interest;
      } else if (observed > expected) {
        const lowerBound = expected;
        const upperBound = 1;
        interest = (observed - lowerBound) / (upperBound - lowerBound);
      }
      interests.push(interest);
    });
    const averageInterest = average(interests);
    return averageInterest;
  };

  const firstOverlapSelection = store.state.overlapSelections.first;
  if (!firstOverlapSelection) {
    console.error('First overlap selection is not defined.');
    return;
  }
  const predicate = firstOverlapSelection.predicate;
  if (!predicate) {
    console.error('First overlap selection\'s predicate is not defined.');
    return;
  }
  const instances = instancesFromPredicate(predicate);

  const allFeatures: string[] = [...store.getters.features];
  const allInstances = [...store.getters.instances];

  const allowedTypes = ['categorical', 'interval', 'ratio'];
  const isAllowedType = (name: string) => allowedTypes.includes(featureByName(name).type);
  const features = allFeatures.filter(isAllowedType);

  const featuresWithInterest = features.map((name) => {
    const allCounts = bucketCountNormalized(name, allInstances);
    const selectedCounts = bucketCountNormalized(name, instances);
    return {
      name,
      interestingness: interestingness(selectedCounts, allCounts),
    };
  });
  featuresWithInterest.sort((f1, f2) => f2.interestingness - f1.interestingness);
  console.log('Interestingness');
  featuresWithInterest.forEach((f) => {
    console.log(f.interestingness, f.name);
  });
}

export function composePredicates(
  p1: Predicate,
  p2: Predicate,
  operation: 'complement' | 'difference' | 'intersection' | 'union',
): Predicate {
  switch (operation) {
    case 'intersection':
      const PredicateIntersection: PredicateComposed = {
        type: 'and',
        predicates: [p1, p2],
      };
      return PredicateIntersection;
    case 'union':
      const PredicateUnion: PredicateComposed = {
        type: 'or',
        predicates: [p1, p2],
      };
      return PredicateUnion;
    case 'difference':
      const a = p1;
      const b = p2;
      const notB: PredicateNegated = {
        type: 'negated',
        predicate: b,
      };
      const aAndNotB: PredicateComposed = {
        type: 'and',
        predicates: [a, notB],
      };
      return aAndNotB;
    case 'complement':
      const aUnionB: PredicateComposed = {
        type: 'or',
        predicates: [p1, p2],
      };
      const complement: PredicateNegated = {
        type: 'negated',
        predicate: aUnionB,
      };
      return complement;
  }
}

export function constraintToString(constraint: Constraint): string {
  const {
    classifier,
    classifier2,
    feature,
    negation,
    rule,
    target,
    value,
  } = constraint;

  switch (rule) {
    case Rule.ACTUAL:
      if (negation) {
        return `True target class was not ${target}`;
      } else {
        return `True target class was ${target}`;
      }
    case Rule.AGREE:
      if (negation) {
        return `Classifiers ${classifier} and ${classifier2} disagree`;
      } else {
        return `Classifiers ${classifier} and ${classifier2} agree`;
      }
    case Rule.FEATURE_EQ:
      if (negation) {
        return `${feature} != ${value}`;
      } else {
        return `${feature} = ${value}`;
      }
    case Rule.FEATURE_GT:
      if (negation) {
        return `${feature} <= ${value}`;
      } else {
        return `${feature} > ${value}`;
      }
    case Rule.FEATURE_LT:
      if (negation) {
        return `${feature} >= ${value}`;
      } else {
        return `${feature} < ${value}`;
      }
    case Rule.PREDICTED:
      if (negation) {
        return `${classifier} did not predict ${target}`;
      } else {
        return `${classifier} predicted ${target}`;
      }
    case Rule.RIGHT:
      if (negation) {
        return `${classifier} was wrong`;
      } else {
        return `${classifier} was right`;
      }
    default:
      return `constraintToString does not recognize this constraint`;
  }
}

export function createConstraint(params: ConstraintParameters): Constraint {
  const c = blankConstraint();
  return Object.assign(c, params);
}

export function createFilter(constraint: Constraint): Filter {
  const trueFilter: Filter = (id: string) => true;
  let filter = trueFilter;

  if (!isConstraintComplete(constraint)) {
    return filter;
  }

  const {
    negation,
    rule,
    classifier,
    classifier2,
    target,
    feature,
    value,
  } = constraint;

  switch (constraint.rule) {
    case Rule.ACTUAL:
      filter = (id: string) => {
        const i = instanceById(id);
        return i.actual === target;
      };
      break;
    case Rule.AGREE:
      filter = (id: string) => {
        const i = instanceById(id);
        return i.predictions[classifier] === i.predictions[classifier2];
      };
      break;
    case Rule.FEATURE_EQ:
      filter = (id: string) => {
        const i = instanceById(id);
        return i.features[feature] === value;
      };
      break;
    case Rule.FEATURE_GT:
      filter = (id: string) => {
        const i = instanceById(id);
        return i.features[feature] > value;
      };
      break;
    case Rule.FEATURE_LT:
      filter = (id: string) => {
        const i = instanceById(id);
        return i.features[feature] < value;
      };
      break;
    case Rule.PREDICTED:
      filter = (id: string) => {
        const i = instanceById(id);
        return i.predictions[classifier] === target;
      };
      break;
    case Rule.RIGHT:
      filter = (id: string) => {
        const i = instanceById(id);
        return i.predictions[classifier] === i.actual;
      };
      break;
    default:
      console.error('Case for some constraint is missing.');
      break;
  }

  const negatedFilter: Filter = (id: string) => !filter(id);
  return (negation ? negatedFilter : filter);
}

export function createSimplePredicate(c: Constraint): PredicateSimple {
  return {
    type: 'simple',
    constraints: [c],
    metric: []
  };
}

export function filterFromConstraint(c: Constraint): Filter {
  return createFilter(c);
}

export function filterFromPredicate(p: Predicate): Filter {
  switch (p.type) {
    case 'simple':
      const filters = p.constraints.map(filterFromConstraint);
      return (id: string) => filters.every((f) => f(id));
    case 'negated':
      const filter = filterFromPredicate(p.predicate);
      return (id: string) => !filter(id);
    case 'and':
      const filtersAnd = p.predicates.map(filterFromPredicate);
      return (id: string) => filtersAnd.every((f) => f(id));
    case 'or':
      const filtersOr = p.predicates.map(filterFromPredicate);
      return (id: string) => filtersOr.some((f) => f(id));
  }
}

export function instancesFromPredicate(p: Predicate, instances?: string[]): string[] {
  const allInstances: string[] = [...store.getters.filteredInstances];
  if (!instances) {
    instances = allInstances;
  }
  const filter = filterFromPredicate(p);
  const selectedInstances = instances.filter(filter);
  return selectedInstances;
}

export function isConstraintComplete(constraint: Constraint): boolean {
  const {
    rule,
    classifier,
    classifier2,
    target,
    feature,
    value,
  } = constraint;

  switch (rule) {
    case Rule.ACTUAL:
      return target ? true : false;
    case Rule.AGREE:
      return classifier && classifier2 ? true : false;
    case Rule.FEATURE_EQ:
    case Rule.FEATURE_GT:
    case Rule.FEATURE_LT:
      return feature && value ? true : false;
    case Rule.PREDICTED:
      return classifier && target ? true : false;
    case Rule.RIGHT:
      return classifier ? true : false;
    default:
      return false;
  }
}

export function predicateAbstraction(p: Predicate): Constraint[] {
  const validConstraints: Constraint[] = [];

  const classes: string[] = [...store.getters.filteredClasses];
  const classifiers: string[] = [...store.getters.filteredClassifiers];
  // console.log('classifiers', classifiers);
  const features: string[] = [...store.getters.features];
  const instancesIds: string[] = instancesFromPredicate(p);
  const instances = instancesIds.map(instanceById);
  // console.log(instances[0]);

  const abstractActualClass = () => {
    const actualClass = [...new Set(instances.map((i) => i.actual))];
    if (actualClass.length === 1) {
      const constraint = createConstraint({
        rule: Rule.ACTUAL,
        target: actualClass[0],
      });
      validConstraints.push(constraint);
    }
  };

  const abstractPredictedClass = () => {
    classifiers.forEach((classifier) => {
      const predictedClass = [...new Set(instances.map((i) => i.predictions[classifier]))];
      // console.log('classifier', classifier);
      // console.log('predicted class', predictedClass);
      if (predictedClass.length === 1) {
        const constraint = createConstraint({
          rule: Rule.PREDICTED,
          classifier,
          target: predictedClass[0],
        });
        validConstraints.push(constraint);
      }
    });
  };

  const abstractPairwiseAgreement = () => {
    classifiers.forEach((classifier, index) => {
      classifiers.slice(index + 1).forEach((classifier2) => {
        const constraint = createConstraint({
          rule: Rule.AGREE,
          classifier,
          classifier2,
        });
        validConstraints.push(constraint);
      });
    });
  };

  const abstractCorrectClassiferCount = () => {
    const countCorrectClassifiers = (i: Instance) => {
      const isCorrectlyPredicted = (classifier: string) =>
        i.actual === i.predictions[classifier];
      const correctClassifiers = classifiers.filter(isCorrectlyPredicted);
      const count = correctClassifiers.length;
      return count;
    };

    const correctClassifiersCounts = instances.map(countCorrectClassifiers);
    const max = Math.max(...correctClassifiersCounts);
    const min = Math.min(...correctClassifiersCounts);
    if (min === max) {
      const constraint = createConstraint({
        rule: Rule.FEATURE_EQ,
        feature: 'numberOfCorrectClassifiers',
        numericValue: min,
      });
      validConstraints.push(constraint);
    } else {
      const lowerBound = createConstraint({
        rule: Rule.FEATURE_LT,
        negation: true,
        feature: 'numberOfCorrectClassifiers',
        numericValue: min,
      });
      const upperBound = createConstraint({
        rule: Rule.FEATURE_GT,
        negation: true,
        feature: 'numberOfCorrectClassifiers',
        numericValue: max,
      });
      validConstraints.push(lowerBound);
      validConstraints.push(upperBound);
    }
  };

  const abstractDataFeatures = () => {
    features.forEach((name) => {
      const allEqual = <T>(array: T[]) => array.every((v) => v === array[0]);
      const f = featureByName(name);
      const values = instances.map((i) => i.features[name]);
      switch (f.type) {
        case 'nominal':
        case 'categorical':
          if (allEqual(values)) {
            const constraint = createConstraint({
              rule: Rule.FEATURE_EQ,
              feature: name,
              value: values[0] as string,
            });
            validConstraints.push(constraint);
          }
          break;
        case 'ordinal':
          console.error('Ordinal variables not handled in predicate abstraction.');
          break;
        case 'interval':
        case 'ratio':
          const min = Math.min(...values as number[]);
          const max = Math.max(...values as number[]);
          if (min === max) {
            const constraint = createConstraint({
              rule: Rule.FEATURE_EQ,
              feature: name,
              numericValue: values[0] as number,
            });
            validConstraints.push(constraint);
          } else {
            const lowerBound = createConstraint({
              rule: Rule.FEATURE_LT,
              negation: true,
              feature: name,
              numericValue: min,
            });
            const upperBound = createConstraint({
              rule: Rule.FEATURE_GT,
              negation: true,
              feature: name,
              numericValue: max,
            });
            validConstraints.push(lowerBound);
            validConstraints.push(upperBound);
          }
          break;
      }
    });
  };

  abstractDataFeatures();

  console.log('valid constraints', validConstraints);

  // create list of simple predicates from valid constraints
  const validPredicates = validConstraints.map(createSimplePredicate);

  // find precision of each valid predicate
  const predicatePrecision = (candidate: Predicate, baseline: Predicate): number => {
    const intersection = composePredicates(candidate, baseline, 'intersection');
    const part = instancesFromPredicate(intersection);
    const whole = instancesFromPredicate(candidate);
    const precision = part.length / whole.length;
    return precision;
  };
  const predicatesWithPrecisions = validPredicates.map((pred) => ({
    predicate: pred,
    precision: predicatePrecision(pred, p),
  }));

  // sort by precision
  predicatesWithPrecisions.sort((p1, p2) => p2.precision - p1.precision);

  console.log('precisions and predicates');
  predicatesWithPrecisions.forEach((pred) => {
    console.log(pred.precision, constraintToString(pred.predicate.constraints[0]));
  });

  return validConstraints;
}

export function sum(array: number[]): number {
  return array.reduce((total, a) => total + a, 0);
}
