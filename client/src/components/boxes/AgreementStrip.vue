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
            <span>Classifier Agreement By Class</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <div ref="chart"></div>
    <hr />
    <div>
      <svg
        ref="legend"
        width="100%"
      >
        <defs>
          <linearGradient :id="gradientId" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" :style="`stop-color: ${colors.bad}; stop-opacity: 1;`" />
            <stop offset="100%" :style="`stop-color: ${colors.good}; stop-opacity: 1;`" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import {
  BoxProps,
  EntityType,
  Instance,
  SelectionAction,
  SelectionRecord,
} from '../../types';
import { colors } from '../../theme';
import {
  // addToSelection,
  generateRandomId,
  // isSelected,
  // isSelectionEmpty,
  overlapCount,
  overlapFraction,
  // selectionColor,
  truncateLabel,
instanceById,
} from '../../utils';

type Agreement = Array<Set<string>>;

interface AgreementList {
  [className: string]: Agreement;
}

export default Vue.extend({
  name: 'AgreementStrip',
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
    const margin = {top: 20, right: 50, bottom: 90, left: 150};
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    return {
      dimensions: {
        height,
        width,
      },
      margin,
      overlapRectHeight: 20,
      panel: [] as string[],
      colors,
    };
  },
  computed: {
    bucketedInstances(): {
      [className: string]: Array<Set<string>>,
    } {
      const bucketedInstances: {
        [className: string]: Array<Set<string>>,
      } = {};
      const classes = this.classes;
      const classifiers = this.classifiers;
      const instances = this.instances;

      classes.forEach((className) => {
        bucketedInstances[className] = [];
        for (let i = 0; i <= classifiers.length; i++) {
          bucketedInstances[className].push(new Set());
        }
      });

      instances.forEach((id) => {
        const i = instanceById(id);
        const agreement = classifiers.filter((c) => i.predictions[c] === i.actual).length;
        bucketedInstances[i.actual][agreement].add(id);
      });

      return bucketedInstances;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    classifiers(): string[] {
      const allClassifiers = [...this.boxProps.classifiers];
      const dummyClassifiers = [
        'Oracle',
        'Majority Classifier',
        'Random Classifier',
      ];
      return allClassifiers.filter((c) => !dummyClassifiers.includes(c));
    },
    colorScale(): d3.ScaleLinear<string, string> {
      const colorScale = d3.scaleLinear<string>()
        .domain([0, this.classifiers.length])
        // .range([colors.bad, colors.good]);
        .range(['white', colors.good]);
      return colorScale;
    },
    gradientId(): string {
      return generateRandomId();
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    maxBucketedInstancesByClass(): number {
      let currentMax = 0;
      const classes = this.classes;
      classes.forEach((className) => {
        const bucket = this.bucketedInstances[className].map((set) => set.size);
        const total = d3.sum(bucket);
        currentMax = Math.max(total, currentMax);
      });

      return currentMax;
    },
    overlapSelections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    // selectedInstances(): Set<Instance> {
    //   return this.$store.getters.selectedInstances;
    // },
  },
  watch: {
    bucketedInstances() {
      this.draw();
    },
    overlapSelections() {
      this.draw();
    },
    // selectedInstances() {
    //   this.draw();
    // },
  },
  mounted() {
    this.draw();
  },
  methods: {
    draw() {
      this.drawChart();
      this.drawColorLegend();
    },
    drawColorLegend() {
      const chartWidth = this.dimensions.width + this.margin.left + this.margin.right;
      const chartHeight = this.dimensions.height + this.margin.top + this.margin.bottom;
      const margin = {top: 20, right: 80, bottom: 100, left: 80};
      const width = chartWidth - margin.left - margin.right;
      const height = 150 - margin.top - margin.bottom;

      // @ts-ignore
      const svg = d3.select(this.$refs.legend)
        .attr('viewBox', `
          0 0
          ${width + margin.left + margin.right}
          ${height + margin.top + margin.bottom}`)
        .append('g')
          .attr('transform', `translate(${margin.left}, ${margin.top})`);

      console.log('svg', svg);

      svg.selectAll('rect').remove();

      const classifiers = this.classifiers;
      const agreementCounts: string[] = [];
      for (let i = 0; i <= classifiers.length; i++) {
        agreementCounts.push(i.toString());
      }

      const agreementScale = d3.scaleBand<string>()
        .domain(agreementCounts)
        .range([0, width]);

      const colorScale = this.colorScale;

      const drawGradient = () => {
        svg.selectAll('rect')
          .data(agreementCounts)
          .join('rect')
          .attr('x', (d: string, i: number) => agreementScale(d))
          .attr('width', agreementScale.bandwidth())
          .attr('height', height)
          .attr('fill', (d: string, i: number) => colorScale(parseInt(d, 10)))
          .attr('stroke', 'black');
      };
      drawGradient();

      const drawAxis = () => {
        svg.append('g')
          .attr('transform', `translate(0 ${height})`)
          .call(d3.axisBottom(agreementScale).ticks(5))
          .attr('font-size', 30);
      };
      drawAxis();

      const drawTitle = () => {
        svg.append('text')
          .attr(
            'transform',
            `translate(
              ${width / 2},
              ${height + margin.bottom / 2}
            )`,
          )
          .attr('dy', '1em')
          .attr('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Number of classifiers that correctly predicted an instance');
      };
      drawTitle();
    },
    drawChart() {
      const x = d3.scaleLinear()
        .range([0, this.dimensions.width]);
      const y = d3.scaleBand<string>()
        .range([this.dimensions.height, 0])
        .paddingOuter(0.2)
        .paddingInner(0.1);
      const colorScale = this.colorScale;

      const classes = this.classes;
      const classifiers = this.classifiers;
      x.domain([0, this.maxBucketedInstancesByClass]);
      y.domain(classes);

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
        .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

      const agreements: number[] = [0];
      for (let i = 1; i <= classifiers.length; i++) {
        agreements.push(i);
      }
      const classAgreementCross = d3.cross(classes, agreements);
      type Cross = [string, number];

      const instancesByPair = (d: Cross) => {
        const [className, agreement] = d;
        return this.bucketedInstances[className][agreement];
      };

      const translateBar = (d: Cross) => {
        const [className, agreement] = d;
        let previousInstanceTotal = 0;
        for (let i = 0; i < agreement; i++) {
          previousInstanceTotal += instancesByPair([className, i]).size;
        }
        const xOffset = x(previousInstanceTotal);
        const yOffset = y(className);
        return `translate (${xOffset}, ${yOffset})`;
      };

      const barDescription = (d: Cross): string => {
        const [className, agreement] = d;
        return `Instances of class '${className}' on which ${agreement} classifiers agree on the actual class.`;
      };

      const updateUserSelection = (d: Cross) => {
        console.log('user selection updated:', d);
        const payload = {
          instances: instancesByPair(d),
          description: barDescription(d),
        };
        this.$store.dispatch('prependToSelectionHistory', payload);
      };

      const cells = svg.selectAll('bar')
        .data(classAgreementCross)
        .join('g')
          .attr('class', 'bar')
          .attr('transform', (d: Cross) => translateBar(d))
          .on('click', (d: Cross) => updateUserSelection(d));

      const barHeight = y.bandwidth();

      const drawBars = () => {
        cells.append('rect')
          .attr('width', (d: Cross) => x(instancesByPair(d).size))
          .attr('height', barHeight)
          .attr('fill', (d: Cross) => colorScale(d[1]))
          .attr('stroke', 'black');
      };
      drawBars();

      const drawSelection1 = () => {
        if (this.overlapSelections.first === null) {
          return;
        }
        const first = this.overlapSelections.first.instances;
        cells.append('rect')
          .attr('width', (d: Cross) => x(overlapCount(instancesByPair(d), first)))
          .attr('height', barHeight / 2)
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
          .attr('y', barHeight / 2)
          .attr('width', (d: Cross) => x(overlapCount(instancesByPair(d), second)))
          .attr('height', barHeight / 2)
          .attr('fill', colors.overlapSelections.second)
          .attr('pointer-events', 'none');
      };
      drawSelection2();

      const drawAxes = () => {
        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.dimensions.height})`)
          .call(
            d3.axisBottom(x)
              .tickSizeOuter(0),
          );

        svg.append('g')
          .call(xAxis);

        const yAxis = (g: any) => g
          .call(
            d3.axisLeft(y)
              .tickFormat((d) => truncateLabel(d, 12)),
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
          .text('Number of instances');

        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.dimensions.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '20px')
          .text('Class');

        // svg.append('text')
        //   .attr(
        //     'transform',
        //     `translate(
        //       ${-this.margin.left / 2 + this.dimensions.width / 2},
        //       ${-this.margin.top / 3}
        //     )`,
        //   )
        //   .attr('text-anchor', 'middle')
        //   .style('font-size', '30px')
        //   .text('Classifier Agreement by Class');
      };
      drawTitles();

      return;
    },
    // tooltip(instances: Set<string>) {
    //   const i = instances.size;
    //   let tooltipMessage = `Cell contains ${i ? i : 'no'} instance(s).`;
    //   if (i > 0 && !isSelectionEmpty()) {
    //     const o = this.overlapCount(instances);
    //     tooltipMessage += ` ${o ? (o === i ? 'All' : o) : 'None'} of them belong(s) to the selection set.`;
    //   }
    //   return `
    //     <title>
    //       ${tooltipMessage}
    //     </title>
    //   `;
    // },
  },
});
</script>

<style scoped>
.card {
  background-color: white;
}
</style>