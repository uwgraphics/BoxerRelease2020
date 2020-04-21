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
            <span>Histogram</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <v-radio-group v-model="chosenFeature" label="Choose categorical feature" row>
            <v-radio
              v-for="feature in categoricalFeatures"
              :key="feature"
              :label="feature"
              :value="feature"
            >
            </v-radio>
          </v-radio-group>
          <div style="margin: 0px 30px;">
            <v-radio-group v-model="sorting" label="Sort by number of instances">
              <v-radio label="ascending" value="ascending"></v-radio>
              <v-radio label="descending" value="descending"></v-radio>
              <v-radio label="none" value=""></v-radio>
            </v-radio-group>
          </div>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <div ref="svg" />
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
import {
  instanceById,
  intersection,
} from '../../utils';
import { PredicateSimple, Rule } from '../constraints/types';
import { blankConstraint } from '../constraints/utils';

export default Vue.extend({
  name: 'Histogram_',
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
    const margin = {top: 150, right: 20, bottom: 90, left: 120};
    const width = 1000 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    const sorting = 'descending' as 'ascending' | 'descending' | '';
    const hoverCategory = '';
    return {
      chosenFeature: '',
      sorting,
      height,
      hoverCategory,
      margin,
      panel: [],
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      width,
    };
  },
  computed: {
    bucketedInstances(): {
      [category: string]: Set<string>,
    } {
      if (!this.chosenFeature) {
        return {};
      }

      const bucketedInstances: {
        [category: string]: Set<string>,
      } = {};

      this.categories.forEach((category) => {
        bucketedInstances[category] = new Set();
      });

      this.instances.forEach((id) => {
        const category = instanceById(id).features[this.chosenFeature];
        if (bucketedInstances[category] === undefined) {
          console.log('undefined category', category);
        }
        bucketedInstances[category].add(id);
      });

      return bucketedInstances;
    },
    categoricalFeatures(): string[] {
      return [...this.boxProps.features].filter((f) => this.$store.getters.feature(f).type === 'categorical');
    },
    categories(): string[] {
      if (!this.chosenFeature) {
        return [];
      } else {
        return this.$store.getters.feature(this.chosenFeature).categories;
      }
    },
    externalHoverInstance(): string {
      return this.$store.state.hoverInstance;
    },
    features(): string[] {
      return [...this.boxProps.features];
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    maxByCategory(): number {
      let max = 0;
      this.categories.forEach((category) => {
        max = Math.max(max, this.bucketedInstances[category].size);
      });
      return max;
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    x(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
        .domain(this.categories)
        .range([0, this.width])
        .paddingOuter(0.2)
        .paddingInner(0.3);
      return x;
    },
    y(): d3.ScaleLinear<number, number> {
      const yMax = this.maxByCategory;
      const y = d3.scaleLinear()
        .domain([0, 1.1 * yMax])
        .range([this.height, 0]);
      return y;
    },
  },
  watch: {
    bucketedInstances() {
      this.drawInitial();
    },
    chosenFeature() {
      this.drawInitial();
    },
    externalHoverInstance() {
      this.drawHoverExternal();
    },
    hoverCategory() {
      this.drawHover();
    },
    instances() {
      this.drawInitial();
    },
    selections() {
      this.drawSelections();
    },
    sorting() {
      this.drawInitial();
    },
  },
  mounted() {
    this.drawInitial();
  },
  methods: {
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const bars = chart.selectAll('.bar');
      const yAxisMarkerLine = chart.select('.y-axis-marker-line');
      const yAxisMarkerText = chart.select('.y-axis-marker-text');
      const moveDuration = 500;
      const disappearDuration = 1000;

      const hoverCategory = this.hoverCategory;
      if (!hoverCategory) {
        bars
          .transition()
          .duration(disappearDuration)
          .attr('fill', 'lightgray');
        yAxisMarkerLine
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);
        yAxisMarkerText
          .transition()
          .duration(disappearDuration)
          .text('');
      } else {
        bars.data(this.categories)
          .transition()
          .duration(moveDuration)
          .attr('fill', (d: string) => d === hoverCategory ? 'black' : 'lightgray');
        yAxisMarkerLine
          .transition()
          .duration(moveDuration)
          .attr('stroke-opacity', 1)
          .attr('y1', this.y(this.bucketedInstances[hoverCategory].size))
          .attr('x2', this.width)
          .attr('y2', this.y(this.bucketedInstances[hoverCategory].size));
        yAxisMarkerText
          .transition()
          .duration(moveDuration)
          .attr('transform', `translate(
            ${this.x.paddingOuter() + (this.x(hoverCategory) as number) + this.x.bandwidth() / 2},
            ${this.y(this.bucketedInstances[hoverCategory].size) - 10})`)
          .text(this.bucketedInstances[hoverCategory].size);
      }
    },
    drawHoverExternal() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const bars = chart.selectAll('.bar');
      if (!this.externalHoverInstance) {
        bars
          .transition()
          .duration(250)
          .attr('fill', 'lightgray');
      } else {
        bars.data(this.categories)
          .transition()
          .duration(250)
          .attr('fill', (d: string) =>
            this.bucketedInstances[d].has(this.externalHoverInstance)
            ? 'black'
            : 'lightgray');
      }
    },
    drawInitial() {
      // @ts-ignore
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${this.width + this.margin.left + this.margin.right}
          ${this.height + this.margin.top + this.margin.bottom}`)
        .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

      const drawBackgroundRect = () => {
        svg.append('rect')
          .attr('width', this.width)
          .attr('height', this.height)
          .attr('fill', 'teal');
      };

      const drawAxes = () => {
        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(this.x)
              .tickSizeOuter(0),
          );

        svg.append('g')
          .call(xAxis);

        const yAxis = (g: any) => g
          .call(
            d3.axisLeft(this.y),
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
            const xOffset = this.width / 2;
            const yOffset = this.height + this.margin.bottom * 0.8;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '20px')
          .text(this.chosenFeature);

        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '20px')
          .text('Number of instances');

        svg.append('text')
          .attr(
            'transform',
            `translate(
              ${-this.margin.left / 2 + this.width / 2},
              ${-this.margin.top * 2 / 3}
            )`,
          )
          .attr('dy', '1em')
          .attr('text-anchor', 'middle')
          .style('font-size', '30px')
          .text(`Instances grouped by ${this.chosenFeature}`);
      };
      drawTitles();

      const translateCell = (category: string) => {
        const xOffset = this.x(category);
        return `translate(${xOffset}, 0)`;
      };

      const barDescription = (category: string): string => {
        return `Instances with feature '${this.chosenFeature}' equal to '${category}')`;
      };

      // const updateUserSelection = (category: string) => {
      //   const payload = {
      //     instances: new Set(this.bucketedInstances[category]),
      //     description: barDescription(category),
      //   };
      //   this.$store.dispatch('prependToSelectionHistory', payload);
      // };

      const cells = svg.selectAll('.cell')
        .data(this.categories)
        .join('g')
          .attr('class', 'cell')
          .attr('transform', (d: string) => translateCell(d))
          .on('mouseenter', (d: string) => this.hoverCategory = d)
          .on('mouseleave', (d: string) => this.hoverCategory = '')
          .on('click', (d: string) => this.select(d, 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'second'));

      const x = this.x;
      const y = this.y;
      const barWidth = x.bandwidth();
      const barYOffset = (category: string) => this.y(this.bucketedInstances[category].size);
      const barHeight = (category: string) => this.height - barYOffset(category);

      const drawBars = () => {
        cells.append('rect')
          .attr('class', 'bar')
          .attr('y', (d: string) => barYOffset(d))
          .attr('width', (d: string) => barWidth)
          .attr('height', (d: string) => barHeight(d))
          .attr('stroke', 'black')
          .attr('stroke-width', '0.5px')
          .attr('fill', 'lightgray');
        cells.append("circle")   
            .attr('class', 'bar-circle')
            .attr('cx', (d: string) => barWidth / 2)
            .attr('cy', y(1)-10)
            .attr('r','10px')
            .attr("visibility",(d: string) => barHeight(d)/ this.height == 0? "hidden"
                  : barHeight(d)/ this.height>0.1? "hidden":"visible")
            .style('fill', 'lightgray')  

        const selections = () => {
          const selectionBarWidth = barWidth / 8;
          cells.append('rect')
            .attr('class', 'bar-selection-1')
            .attr('x', (d: string) => barWidth / 2 - selectionBarWidth)
            .attr('width', (d: string) => selectionBarWidth)
            .attr('fill', this.selection1Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px');
          cells.append('rect')
            .attr('class', 'bar-selection-2')
            .attr('x', (d: string) => barWidth / 2)
            .attr('width', (d: string) => selectionBarWidth)
            .attr('fill', this.selection2Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px');

          cells.append("circle")   
            .attr('class', 'circle-selection-1')
            .attr('cx',(d: string) => barWidth / 2 - 0.5*selectionBarWidth)
            .attr('cy', y(1)-10)
            .attr('r','10px')
            .style('fill', this.selection1Color) 
          cells.append("circle")   
            .attr('class', 'circle-selection-2')
            .attr('cx', (d: string) => barWidth / 2 + 0.5*selectionBarWidth)
            .attr('cy', y(1)-10)
            .attr('r','10px')
            .style('fill', this.selection2Color)   
        };
        selections();
      };

      const yAxisMarkerLine = () => {
        svg.append('line')
          .attr('class', 'y-axis-marker-line')
          .attr('y1', y(1))
          .attr('x2', this.width)
          .attr('y2', y(1))
          .attr('stroke', 'red')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');
      };

      const yAxisMarkerText = () => {
        svg.append('text')
          .attr('class', 'y-axis-marker-text')
          .attr('text-anchor', 'middle')
          .attr('font-size', 20)
          .attr('pointer-events', 'none');
      };

      drawBars();
      yAxisMarkerLine();
      yAxisMarkerText();

      this.drawHover();
      this.drawSelections();
      this.drawHoverExternal();
    },
    drawSelections() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const barSelection1 = chart.selectAll('.bar-selection-1');
      const barSelection2 = chart.selectAll('.bar-selection-2');

      const circleSelection1 = chart.selectAll('.circle-selection-1');
      const circleSelection2 = chart.selectAll('.circle-selection-2');

      const { first, second } = this.selections;

      const yOffset = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        return this.y(overlappingInstances.size);
      };
      const height = (instances: Set<string>, selection: Set<string>) => {
        return this.height - yOffset(instances, selection);
      };

      if (!first) {
        barSelection1.attr('height', 0);
        circleSelection1.attr("visibility","hidden")
      } else {
        barSelection1
          .data(this.categories)
          .attr('y', (d: string) => yOffset(this.bucketedInstances[d], first.instances))
          .attr('height', (d: string) => height(this.bucketedInstances[d], first.instances));

        circleSelection1
          .data(this.categories)
          .attr("visibility", (d:number) => {
                    console.log(height(this.bucketedInstances[d], first.instances))
                    return height(this.bucketedInstances[d], first.instances) == 0?"hidden"
                      :height(this.bucketedInstances[d], first.instances) / this.height>0.2?"hidden":"visible"
                    })  
      }

      if (!second) {
        barSelection2.attr('height', 0);
        circleSelection2.attr("visibility","hidden")
      } else {
        barSelection2
          .data(this.categories)
          .attr('y', (d: string) => yOffset(this.bucketedInstances[d], second.instances))
          .attr('height', (d: string) => height(this.bucketedInstances[d], second.instances));

        circleSelection2
          .data(this.categories)
          .attr("visibility", (d:number) => {
                    return height(this.bucketedInstances[d], second.instances) == 0?"hidden"
                      :height(this.bucketedInstances[d], second.instances) / this.height>0.2?"hidden":"visible"
                    })    
      }
    },
    select(
      d: string,
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.FEATURE_EQ;
      constraint.feature = this.chosenFeature;
      constraint.value = d;

      const instances = this.bucketedInstances[d];
      const description = `Instances with feature '${this.chosenFeature}' equal to '${d}')`;
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric:[],
      };
      const payload = {
        description,
        instances,
        predicate,
      };

      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('setToMostRecentSelection', whichOverlap);
    },
  },
});
</script>

<style scoped>
.card {
  background-color: white;
}
</style>
