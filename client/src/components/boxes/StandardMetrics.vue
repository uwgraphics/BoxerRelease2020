<template>
  <div class="card">
    <v-expansion-panels
      v-model="panel"
    >
      <v-expansion-panel>
        <v-expansion-panel-header>
          <div class="handle" style="font-size: 20px;">
            <v-icon
              style="margin-right: 10px;"
              @click="onClose"
            >close</v-icon>
            <span>Metrics Table</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <v-data-table
      :headers="headers"
      :items="metrics"
      class="elevation-1"
      multi-sort
      :sort-by="sortby"
    >
    <template v-slot:body="{ items }">
      <tbody>
        <tr
          v-for="item in items"
          :key="item.classifier"
        >
          <td>{{ item.classifier }}</td>
          <td> {{ `${item.metrics.accuracy.toFixed(3)}` }}</td>
          <td>{{ `${item.metrics.mcc.average.toFixed(3)}` }}</td>
          <td v-if="classNumber > 2" class="column3">{{ `${item.metrics.microf1.average.toFixed(3)}` }}</td>
          <td v-if="classNumber > 2" class="column4">{{ `${item.metrics.macrof1.average.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2" class="column5">{{ `${item.metrics.precision.average.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2" class="column6">{{ `${item.metrics.recall.average.toFixed(3)}` }}</td>
          <td v-if="classNumber <= 2" class="column7">{{ `${item.metrics.f1.average.toFixed(3)}` }}</td>
        </tr>
      </tbody>
    </template>  
    </v-data-table>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import {
  BoxProps,
  Metrics,
} from '../../types';
interface Header {
  text: string;
  value: string;
}
interface MetricsWithClassifier {
  classifier: string;
  metrics: Metrics;
}
export default Vue.extend({
  name: 'MetricsTable',
  props: {
    boxProps: {
      type: Object as () => BoxProps,
      required: true,
    },
    onClose: {
      type: Function,
      required: true,
    },
  },
  data() {
    return {
      pagination: {
        rowsPerPage: 10,
      },
      panel: [],
      sortby: [],
      classNumber:[...this.boxProps.classes].length,
    };
  },
  computed: {
    metrics(): MetricsWithClassifier[] {
      const storeMetrics: {
        [classifier: string]: Metrics,
      } = this.$store.getters.metrics;
      const metrics: MetricsWithClassifier[] = Object.entries(storeMetrics).map(([classifier, m]) => {
        return {
          classifier,
          metrics: m,
        };
      });
      console.log('metrics with classifier', metrics);
      console.log(d3.select(".column3"))
      return metrics;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    classifiers(): string[] {
      return [...this.boxProps.classifiers];
    },
    headers(): Header[] {
      const headers = [
        { text: 'Classifier', value: 'classifier' },
        { text: 'Accuracy', value: 'accuracy' },
        { text: 'MCC', value: 'mcc' },
      ];
      if (this.classes.length<= 2) {
        headers.push({ text: 'Precision', value: 'precision' })
        headers.push({ text: 'Recall', value: 'recall' })
        headers.push({ text: 'F1', value: 'f1' })
      } else {
        headers.push({ text: 'Micro-F1', value: 'microf1' })
        headers.push({ text: 'Macro-F1', value: 'macrof1' })
      }
     
      return headers;
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    truncatedInstances(): string[] {
      return this.instances.slice(0, 10);
    },
  },
  mounted() {
    console.log(this.metrics);
    console.log(this.classes)
  },
});
</script>

<style scoped>
.card {
  background-color: white;
}
</style>