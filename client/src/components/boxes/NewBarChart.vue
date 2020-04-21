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
            <span>New Bar Chart</span>
          </div>
        <v-expansion-panel-header>
        <v-expansion-panel-content>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <div class="chart" ref="chart" />
    <hr />
    <div class="legend">
      <svg ref="legend" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';

import {
  BoxProps,
  Instance,
  SelectionRecord,
} from '../../types';
import { colors } from '../../theme';
import {
  instanceById,
  overlapCount,
  truncateLabel,
} from '../../utils';

export default Vue.extend({
  name: 'NewBarChart',
  data() {
    const margin = {top: 100, right: 50, bottom: 90, left: 120};
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    const hoverModel = '';
    const selectedColors: {
      [classifier: string]: string,
    } = {};
    const availableColors = [...colors.categorical.slice(0, 3)];
    return {
      availableColors,
      dimensions: {
        height,
        width,
      },
      hoverModel,
      margin,
      panel: [],
      selectedColors,
    };
  },
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
  computed: {
    bucketedInstances(): {
      [className: string]: {
        actual: Set<string>,
        [classifier: string]: Set<string>,
      },
    } {
      const instances: Set<string> = this.boxProps.instances;
      const classes: Set<string> = this.boxProps.classes;
      const classifiers: Set<string> = this.boxProps.classifiers;

      const bucketedInstances: {
        [className: string]: {
          actual: Set<string>,
          [classifier: string]: Set<string>,
        },
      } = {};

      classes.forEach((className) => {
        const bucket: {
          actual: Set<string>,
          [classifier: string]: Set<string>,
        } = {
          actual: new Set(),
        };
        classifiers.forEach((classifier) => {
          bucket[classifier] = new Set();
        });
        bucketedInstances[className] = bucket;
      });

      instances.forEach((id) => {
        const i = instanceById(id);
        const actualClass = i.actual;
        bucketedInstances[actualClass].actual.add(id);
        classifiers.forEach((classifier) => {
          const predictedClass = i.predictions[classifier];
          if (!classes.has(predictedClass)) {
            return;
          }
          bucketedInstances[predictedClass][classifier].add(id);
        });
      });

      return bucketedInstances;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    classifiers(): string[] {
      return [...this.boxProps.classifiers];
    },
    maxBucketedInstances(): number {
      let currentMax = 0;

      const instances: Set<string> = this.boxProps.instances;
      const classes: Set<string> = this.boxProps.classes;
      const classifiers: Set<string> = this.boxProps.classifiers;

      classes.forEach((className) => {
        const bucket = this.bucketedInstances[className];
        currentMax = Math.max(bucket.actual.size, currentMax);
        classifiers.forEach((classifier) => {
          currentMax = Math.max(bucket[classifier].size, currentMax);
        });
      });

      return currentMax;
    },
    overlapSelections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
  },
  watch: {
    bucketedInstances() {
      this.draw();
    },
    hoverModel() {
      this.draw();
    },
    overlapSelections() {
      this.draw();
    },
    selectedColors() {
      this.draw();
    },
  },
  mounted() {
    this.draw();
  },
  methods: {
    barDescription(className: string, model: string): string {
      return (
        (model === 'actual')
          ? `Instances of class ${className}`
          : `Instances predicted by classifier ${model} to be of class ${className}`
      );
    },
    draw() {
      this.drawLegend();
      this.drawChart();
    },
    drawChart() {
      const xOuter = d3.scaleBand()
        .rangeRound([0, this.dimensions.width])
        .paddingInner(0.3);
      const xInner = d3.scaleBand()
        .padding(0.05);
      const y = d3.scaleLinear()
        .rangeRound([this.dimensions.height, 0]);

      const instances: Set<string> = this.boxProps.instances;
      const classes: string[] = this.classes;
      const classifiers: string[] = this.classifiers;

      const models = ['actual', ...classifiers];
      xOuter.domain(classes);
      xInner
        .rangeRound([0, xOuter.bandwidth()])
        .domain(models);
      y.domain([0, this.maxBucketedInstances]).nice();

      // @ts-ignore
      const chart = d3.select(this.$refs.chart);
      chart.selectAll('*').remove();
      const svg = chart
        .append('svg')
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('viewBox', `
            0 0
            ${this.dimensions.width + this.margin.left + this.margin.right}
            ${this.dimensions.height + this.margin.top + this.margin.bottom}`)
          .on('mouseenter', () => this.hoverModel = '')
        .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

      const translateBar = (classModelPair: [string, string]) => {
        const [className, model] = classModelPair;
        const xOuterOffset = xOuter(className) as number;
        const xInnerOffset = xInner(model) as number;
        const xOffset = xOuterOffset + xInnerOffset;
        return `translate(${xOffset}, 0)`;
      };

      const toggleColor = (classifier: string) => {
        if (Object.keys(this.selectedColors).includes(classifier)) {
          this.availableColors.push(this.selectedColors[classifier]);
          delete this.selectedColors[classifier];
          this.selectedColors = Object.assign({}, this.selectedColors);
          return;
        }
        const chosenColor = this.availableColors.pop();
        if (chosenColor === undefined) {
          console.log('no more colors. Remove color from one of the other bars');
          return;
        }
        this.selectedColors[classifier] = chosenColor;
        this.selectedColors = Object.assign({}, this.selectedColors);
      };

      const modelColor = (classifier: string) => {
        if (Object.keys(this.selectedColors).includes(classifier)) {
          return this.selectedColors[classifier];
        }
        if (this.hoverModel === classifier) {
          return 'red';
        }
        return 'lightgray';
      };

      const classModelCross = d3.cross(classes, models);
      const cells = svg.selectAll('bar')
        .data(classModelCross)
        .join('g')
          .attr('class', 'bar')
          .attr('transform', (d: [string, string]) => translateBar(d))
          .on('mouseenter', (d: [string, string]) => this.hoverModel = d[1])
          .on('click', (d: [string, string]) => {
            // toggleColor(d[1]);
            this.updateUserSelection(d);
          });

      const barWidth = xInner.bandwidth() + 1;

      const drawBars = () => {
        cells.append('rect')
          .attr('y', (d: [string, string]) => y(this.instancesByPair(d).size))
          .attr('width', barWidth)
          .attr('height', (d: [string, string]) => this.dimensions.height - y(this.instancesByPair(d).size))
          .attr('stroke', 'black')
          .attr('stroke-width', '0.5px')
          // .attr('fill', (d: [string, string]) => modelColor(d[1]));
          .attr('fill', (d: [string, string]) => d[1] === this.hoverModel ? 'orange' : 'lightgray');
      };
      drawBars();

      const drawCaps = () => {
        const points = `0,0 ${barWidth / 2},${-barWidth} ${barWidth},${0}`;
        cells.append('polygon')
          .attr('transform', (d: [string, string]) =>
            `translate(0, ${y(this.instancesByPair(d).size)})`)
          .attr('points', points)
          .attr('fill', (d: [string, string]) => modelColor(d[1]))
          .attr('fill-opacity', (d: [string, string]) => Object.keys(this.selectedColors).includes(d[1]) ? 1 : 0);
      };
      drawCaps();

      const drawSelection1 = () => {
        if (this.overlapSelections.first === null) {
          return;
        }
        const first = this.overlapSelections.first.instances;
        cells.append('rect')
          .attr('y', (d: [string, string]) =>
            y(overlapCount(this.instancesByPair(d), first)),
          )
          .attr('width', (barWidth / 2))
          .attr('height', (d: [string, string]) =>
            this.dimensions.height - y(overlapCount(this.instancesByPair(d), first)),
          )
          .attr('stroke', 'black')
          .attr('stroke-width', '0.5px')
          .attr('fill', colors.overlapSelections.first)
          .attr('pointer-events', 'none');
      };
      drawSelection1();

      const drawSelection2 = () => {
        if (this.overlapSelections.second === null) {
          return;
        }
        const second = this.overlapSelections.second.instances;
        cells.append('rect')
          .attr('x', barWidth / 2)
          .attr('y', (d: [string, string]) =>
            y(overlapCount(this.instancesByPair(d), second)),
          )
          .attr('width', (barWidth / 2))
          .attr('height', (d: [string, string]) =>
            this.dimensions.height - y(overlapCount(this.instancesByPair(d), second)),
          )
          .attr('stroke', 'black')
          .attr('stroke-width', '0.5px')
          .attr('fill', colors.overlapSelections.second)
          .attr('pointer-events', 'none');
      };
      drawSelection2();

      const drawAxes = () => {
        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.dimensions.height})`)
          .call(
            d3.axisBottom(xOuter)
              .tickSizeOuter(0)
              .tickFormat((d) => truncateLabel(d, 15)),
          );

        svg.append('g')
          .call(xAxis);

        const yAxis = (g: any) => g
          .call(
            d3.axisLeft(y),
          );

        svg.append('g')
          .call(yAxis);

        svg.selectAll('g.tick')
          .style('font-size', '16px');
      };
      drawAxes();

      const drawTitles = () => {
        svg.append('text')
          .attr('transform', () => {
            const xOffset = this.dimensions.width / 2;
            const yOffset = this.dimensions.height + this.margin.bottom * 0.8;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '20px')
          .text('Class');

        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.dimensions.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '20px')
          .text('Number of instances');

        svg.append('text')
          .attr(
            'transform',
            `translate(
              ${-this.margin.left / 2 + this.dimensions.width / 2},
              ${-this.margin.top / 2}
            )`,
          )
          .attr('dy', '0.5em')
          .attr('text-anchor', 'middle')
          .style('font-size', '30px')
          .text('Instances vs Class');
      };
      drawTitles();
    },
    drawLegend() {
      const margin = {top: 50, right: 80, bottom: 100, left: 20};
      const width = 800 - margin.left - margin.right;
      const height = 200 - margin.top - margin.bottom;

      const classifiers = this.classifiers;
      const models = ['actual', ...classifiers];

      const x = d3.scaleBand()
        .domain(models)
        .range([0, width])
        .paddingInner(0.2);

      // @ts-ignore
      const svg = d3.select(this.$refs.legend)
        .attr('viewBox', `
          0 0
          ${width + margin.left + margin.right}
          ${height + margin.top + margin.bottom}`)
        .append('g')
          .attr('transform', `translate(${margin.left}, ${margin.top})`);

      svg.selectAll('*').remove();

      const entries = svg.selectAll('legend-entry')
        .data(models)
        .join('g')
          .attr('class', 'legend-entry')
          .attr('transform', (d: string, i: number) => `translate(${x(d)}, 0)`);

      entries.append('rect')
        .attr('width', x.bandwidth())
        .attr('height', height)
        .attr('fill', (d: string) => (this.hoverModel === d) ? 'orange' : 'lightgray');

      svg.append('g')
        .attr('class', 'legend-axis')
          .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(x))
          .selectAll('text')
          .attr('transform', 'rotate(30)')
          .style('text-anchor', 'start')
          .style('font-size', '20px');

      svg.selectAll('.legend-axis').select('.domain').attr('stroke-opacity', '0');
      svg.selectAll('.legend-axis').selectAll('.tick').attr('stroke-opacity', '0');

      const drawTitle = () => {
        svg.append('text')
          .attr('transform', `translate(${width / 2 - margin.left / 2 + margin.right / 2}, ${-margin.top / 2})`)
          .attr('text-anchor', 'start')
          .style('font-size', '16px')
          .text('Models');
      };
      drawTitle();
    },
    instancesByPair(classModelPair: [string, string]) {
      const [className, model] = classModelPair;
      return this.bucketedInstances[className][model];
    },
    updateUserSelection(classModelPair: [string, string]) {
      const [className, model] = classModelPair;
      console.log('user selection updated:', className, model);
      const payload = {
        instances: this.instancesByPair(classModelPair),
        description: this.barDescription(className, model),
      };
      this.$store.dispatch('prependToSelectionHistory', payload);
    },
  },
});
</script>

<style scoped>
.card {
  background-color: white;
}
.chart {
  flex: 3;
}
.legend {
  flex: 1;
}
</style>
