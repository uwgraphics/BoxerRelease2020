import store from './store';
import {
  Feature,
  Instance,
} from './types';

export function difference(a: Set<any>, b: Set<any>): Set<any> {
  return new Set([...a].filter((elem) => !b.has(elem)));
}

export function featureByName(name: string): Feature {
  return store.getters.feature(name);
}

export function generateRandomId(prefix = 'randomlyGeneratedId-') {
  const suffix = Math.random().toString().substr(2);
  const id = prefix + suffix;
  return id;
}

export function instanceById(id: string): Instance {
  return store.getters.instance(id);
}

export function intersection(a: Set<any>, b: Set<any>): Set<any> {
  return new Set([...a].filter((elem) => b.has(elem)));
}

export function intersectionAll(sets: Set<Set<any>>): Set<any> {
  if (sets.size === 0) {
    return new Set();
  }
  let result = [...sets][0];
  sets.forEach((s) => {
    result = intersection(result, s);
  });
  return result;
}

export function logTime(message: string) {
  const today = new Date();
  const time = today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds() + '.' + today.getMilliseconds();
  console.log(`${time}: ${message}`);
}

export function overlapCount(a: Set<any>, b: Set<any>): number {
  const overlap = intersection(a, b);
  return overlap.size;
}

// returns overlapFraction with respect to b
export function overlapFraction(a: Set<any>, b: Set<any>): number {
  if (b.size === 0) {
    return 0;
  }
  return overlapCount(a, b) / b.size;
}

export function truncateLabel(label: string, length: number): string {
  if (label.length <= length) {
    return label;
  }
  return label.slice(0, Math.max(1, length - 3)) + '...';
}

export function union(a: Set<any>, b: Set<any>): Set<any> {
  return new Set([...a, ...b]);
}

export function unionAll(sets: Set<Set<any>>): Set<any> {
  let result = new Set();
  sets.forEach((s) => {
    result = union(result, s);
  });
  return result;
}

export function xor(a: Set<any>, b: Set<any>): Set<any> {
  const result = union(difference(a, b), difference(b, a));
  return result;
}
