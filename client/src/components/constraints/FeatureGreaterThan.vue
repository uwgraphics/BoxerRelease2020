<template>
  <span >
    <v-menu
      bottom offset-y max-height="70vh"
    >
      <v-btn
        slot="activator"
      >
        <span v-if="constraint.feature">{{ constraint.feature }}</span>
        <span v-else>{{ placeholders.feature }}</span>
      </v-btn>
      <v-list>
        <v-list-tile
          v-for="feature in features"
          :key="feature"
          @click="constraint.feature = feature; constraint.value = ''"
        >
          <v-list-tile-title>{{ feature }}</v-list-tile-title>
        </v-list-tile>
      </v-list>
    </v-menu>
    greater than
    <span class="mx-3">
      <span v-if="!constraint.feature">
        ...
      </span>
      <span v-else-if="isFeatureCategoricalOrNominal">
        <v-flex d-inline-flex>
          <v-autocomplete
            hide-no-data
            :items="featureValues"
            v-model="constraint.value"
          ></v-autocomplete>
        </v-flex>
      </span>
      <span v-else-if="isFeatureOrdinal">
        [ ordinal detected ]
      </span>
      <span v-else-if="isFeatureIntervalOrRatio">
        <v-flex d-inline-flex>
          <v-slider
            always-dirty
            :max="featureValuesMax"
            :min="featureValuesMin"
            :step="featureValuesStep"
            thumb-label
            thumb-size="70"
            v-model="constraint.value"
          ></v-slider>
        </v-flex>
        {{ constraint.value }}
      </span>
      <span v-else>
        {{ featureType }}
      </span>
    </span>
  </span>
</template>

<script lang="ts">
import Vue from 'vue';

import {
  Constraint,
  PlaceHolder,
  Rule,
} from './types';
import {
  BoxProps,
  FeatureInterval,
  FeatureRatio,
} from '../../types';
import {
  featureByName,
  instanceById,
} from '../../utils';

export default Vue.extend({
  name: 'FeatureGreaterThan',
  props: {
    boxProps: {
      type: Object as () => BoxProps,
      required: true,
    },
    constraint: {
      type: Object as () => Constraint,
      required: true,
    },
  },
  data() {
    return {
      rules: Rule,
      placeholders: PlaceHolder,
    };
  },
  computed: {
    features(): string[] {
      const allFeatures: string[] = [...this.boxProps.features];
      const allowedTypes = ['ordinal', 'interval', 'ratio'];
      const allowedFeatures = allFeatures.filter((featureName) => {
        const f = featureByName(featureName);
        return allowedTypes.includes(f.type);
      });
      return allowedFeatures;
    },
    featureType(): string {
      if (!this.constraint.feature) {
        return '';
      }
      return featureByName(this.constraint.feature).type;
    },
    featureValues(): Array<unknown | number> {
      if (!this.constraint.feature) {
        return [];
      }
      const f = this.constraint.feature;
      const values = this.instances.map((id) => {
        const i = instanceById(id);
        return i.features[f];
      });
      const valuesWithoutDuplicates = [...new Set(values)];
      return valuesWithoutDuplicates;
    },
    featureValueBounds(): [number, number] {
      const defaultBounds: [number, number] = [0, 0];
      if (!this.constraint.feature) {
        return defaultBounds;
      }
      const f = featureByName(this.constraint.feature);
      const minMaxBounds = () => {
        const values = this.featureValues as number[];
        const bounds: [number, number] = [Math.min(...values), Math.max(...values)];
        return bounds;
      };
      switch (this.featureType) {
        case 'interval':
          const boundsInterval = (f as FeatureInterval).bounds;
          return boundsInterval
            ? boundsInterval
            : minMaxBounds();
        case 'ratio':
          const boundsRatio = (f as FeatureRatio).bounds;
          return boundsRatio
            ? boundsRatio
            : minMaxBounds();
        default:
          return defaultBounds;
      }
    },
    featureValuesMax(): number {
      return this.featureValueBounds[1];
    },
    featureValuesMin(): number {
      return this.featureValueBounds[0];
    },
    featureValuesStep(): number {
      const range = this.featureValuesMax - this.featureValuesMin;
      const step = range / 20;
      return step;
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    isFeatureCategoricalOrNominal(): boolean {
      return ['categorical', 'nominal'].includes(this.featureType);
    },
    isFeatureOrdinal(): boolean {
      return this.featureType === 'ordinal';
    },
    isFeatureIntervalOrRatio(): boolean {
      return ['interval', 'ratio'].includes(this.featureType);
    },
  },
});
</script>
