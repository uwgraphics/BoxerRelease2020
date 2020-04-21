<template>
  <span>
    <v-menu
      bottom offset-y max-height="70vh"
    >
      <v-btn
        slot="activator"
      >
        <span v-if="constraint.classifier">{{ constraint.classifier }}</span>
        <span v-else>{{ placeholders.classifier }}</span>
      </v-btn>
      <v-list>
        <v-list-tile
          v-for="(classifier, index) in classifiers"
          :key="index"
          @click="constraint.classifier = classifier"
        >
          <v-list-tile-title>{{ classifier }}</v-list-tile-title>
        </v-list-tile>
      </v-list>
    </v-menu>
    was right
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
} from '../../types';

export default Vue.extend({
  name: 'ClassifierRight',
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
    classifiers(): string[] {
      return [...this.boxProps.classifiers];
    },
  },
});
</script>
