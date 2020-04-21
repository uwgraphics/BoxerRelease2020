<template>
  <span >
    True target class was
    <v-menu
      bottom offset-y max-height="70vh"
    >
      <v-btn
        slot="activator"
      >
        <span v-if="constraint.target">{{ constraint.target }}</span>
        <span v-else>{{ placeholders.target }}</span>
      </v-btn>
      <v-list>
        <v-list-tile
          v-for="target in classes"
          :key="target"
          @click="constraint.target = target"
        >
          <v-list-tile-title>{{ target }}</v-list-tile-title>
        </v-list-tile>
      </v-list>
    </v-menu>
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
  name: 'ActualTargetClass',
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
    classes(): string[] {
      return [...this.boxProps.classes];
    },
  },
});
</script>
