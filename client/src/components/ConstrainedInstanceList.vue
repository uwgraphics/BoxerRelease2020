<template>
  <div>
    <div class="instance-list-title">
      Query selects
      <b>{{ instances.length }} </b>
      instances ( or
      <b>{{ instancePercentage }}</b>
      % )
    </div>
    <v-data-table
      :headers="headers"
      :items="instances"
      class="elevation-1"
      :pagination.sync="pagination"
      disable-initial-sort
    >
      <template slot="items" slot-scope="props">
        <tr
            :class="{'hover-instance': props.item === $store.state.hoverInstance}"
            :style="styleTableRow(props.item)"
        >
          <td>{{ props.item.id }}</td>
          <td>{{ props.item.actual }}</td>
          <td
            v-for="classifier in classifiers"
            :key="classifier"
          >
            {{ props.item.predictions[classifier] }}
          </td>
          <td
            v-for="feature in features"
            :key="feature"
          >
            {{ props.item.features[feature] }}
          </td>
        </tr>
      </template>
    </v-data-table>
  </div>
</template>

<script lang="ts">
import { colors } from '../theme';
import {
  BoxProps,
  Instance,
  InstanceWithId,
  SelectionRecord,
} from '../types';
import { instanceById } from '../utils';
import Vue from 'vue';
import { mapActions } from 'vuex';

interface Header {
  text: string;
  value: string;
}

export default Vue.extend({
  name: 'ConstrainedInstanceList',
  props: {
    boxProps: {
      type: Object as () => BoxProps,
      required: true,
    },
  },
  data() {
    return {
      sortBy: '' as '' | 'first' | 'second' | 'common',
      pagination: {
        rowsPerPage: 10,
      },
    };
  },
  computed: {
    classifiers(): string[] {
      return [...this.boxProps.classifiers];
    },
    features(): string[] {
      return [...this.boxProps.features];
    },
    headers(): Header[] {
      const headers = [
        { text: 'Id', value: 'id' },
        { text: 'Actual class', value: 'actualClass' },
      ];
      this.classifiers.forEach((classifier: string) => {
        headers.push({
          text: classifier.replace(/_/g, ' '),
          value: classifier,
        });
      });
      this.$store.getters.features.forEach((feature: string) => {
        headers.push({
          text: feature,
          value: feature,
        });
      });
      return headers;
    },
    instancePercentage(): string {
      const part = this.instances.length;
      const whole = this.$store.getters.instances.size;
      const percentage = (part / whole * 100).toFixed(2);
      return percentage;
    },
    instances(): InstanceWithId[] {
      const instances: InstanceWithId[] = [];
      [...this.boxProps.instances].forEach((id: string) => {
        const i = instanceById(id);
        const instance: InstanceWithId = {
          id,
          ...i,
        };
        instances.push(instance);
      });

      const { first, second } = this.selections;
      const comparators = {
        first: (a: InstanceWithId, b: InstanceWithId) => {
          let aBelongs = 0;
          let bBelongs = 0;

          if (first && first.instances.has(a.id)) {
            aBelongs++;
          }
          if (first && first.instances.has(b.id)) {
            bBelongs++;
          }

          return bBelongs - aBelongs;
        },
        second: (a: InstanceWithId, b: InstanceWithId) => {
          let aBelongs = 0;
          let bBelongs = 0;

          if (second && second.instances.has(a.id)) {
            aBelongs++;
          }
          if (second && second.instances.has(b.id)) {
            bBelongs++;
          }

          return bBelongs - aBelongs;
        },
        common: (a: InstanceWithId, b: InstanceWithId) => {
          let aBelongs = 0;
          let bBelongs = 0;

          if (first && first.instances.has(a.id)) {
            aBelongs++;
          }
          if (first && first.instances.has(b.id)) {
            bBelongs++;
          }

          if (second && second.instances.has(a.id)) {
            aBelongs++;
          }
          if (second && second.instances.has(b.id)) {
            bBelongs++;
          }

          return bBelongs - aBelongs;
        },
      };
      if (this.sortBy) {
        instances.sort(comparators[this.sortBy]);
      }

      return instances;
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
  },
  watch: {
    selections() {
      const { first, second } = this.selections;
      if (first && second) {
        this.sortBy = 'common';
      } else if (first) {
        this.sortBy = 'first';
      } else if (second) {
        this.sortBy = 'second';
      } else {
        this.sortBy = '';
      }
    },
  },
  methods: {
    ...mapActions([
      'updateHoverInstance',
      'clearHoverInstance',
    ]),
    select(
      id: string,
      whichOverlap: 'first' | 'second',
    ) {
      const instances = new Set([id]);
      const description = `Instance #${id}`;

      this.$store.dispatch('prependToSelectionHistory', { instances, description });
      this.$store.dispatch('setToMostRecentSelection', whichOverlap);
    },
    styleTableRow(instance: InstanceWithId) {
      const { first: firstColor, second: secondColor } = colors.overlapSelections;
      const { first: firstSelection, second: secondSelection } = this.selections;
      const isFirst = (firstSelection && firstSelection.instances.has(instance.id));
      const isSecond = (secondSelection && secondSelection.instances.has(instance.id));

      if (isFirst && isSecond) {
        return `
          background: -webkit-linear-gradient(top, ${firstColor}, ${secondColor});
          color: white;
        `;
      }
      if (isFirst) {
        return `
          background-color: ${firstColor};
        `;
      }
      if (isSecond) {
        return `
          background-color: ${secondColor};
          color: white;
        `;
      }
      return '';
    },
  },
});
</script>

<style scoped>
tr.hover-instance td {
  background-color: yellow;
}

.instance-list-title {
  font-size: 2em;
}
</style>
