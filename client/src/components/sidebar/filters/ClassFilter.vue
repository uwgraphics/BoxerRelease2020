<template>
  <v-expansion-panels
    v-model="panel"
    multiple
  >
    <v-expansion-panel>
      <v-expansion-panel-header>Classes</v-expansion-panel-header>
      <v-expansion-panel-content>
        <v-list dense>
          <v-list-item
            v-for="className in classList"
            :key="className"
            @click="applyFilter"
          >
            <v-list-item-title>
              <v-checkbox v-model="checkedBoxes" :value="className" :label="className" />
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import Vue from 'vue';
import {
  EntityType,
  SelectionAction,
} from '../../../types';

export default Vue.extend({
  name: 'ClassFilter',
  data() {
    return {
      panel: [] as string[],
      checkedBoxes: [] as string[],
    };
  },
  computed: {
    classList(): string[] {
      return [...this.$store.getters.classes];
    },
  },
  methods: {
    applyFilter() {
      const payload: {
        entityType: EntityType,
        newFilter: {
          type: SelectionAction,
          set: Set<string>,
        },
      } = {
        entityType: EntityType.Class,
        newFilter: {
          type: SelectionAction.Exclude,
          set: new Set(this.checkedBoxes),
        },
      };
      console.log('class checkboxes', payload);
      this.$store.dispatch('updateFilter', payload);
    },
  },
});
</script>
