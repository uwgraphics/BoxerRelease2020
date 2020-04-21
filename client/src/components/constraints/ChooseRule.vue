<template>
  <span>
    Choose:
    <v-menu
      bottom offset-y max-height="70vh"
    >
      <v-btn
        slot="activator"
      >
        <span v-if="constraint.rule">{{ constraint.rule }}</span>
        <span v-else>{{ placeholders.rule }}</span>
      </v-btn>
      <v-list>
        <v-list-tile
          v-for="item in Object.values(rules).filter((p) => p)"
          :key="item"
          @click="constraint.rule = item"
        >
          <v-list-tile-title>{{ item }}</v-list-tile-title>
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

export default Vue.extend({
  name: 'ChooseRule',
  props: {
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
});
</script>
