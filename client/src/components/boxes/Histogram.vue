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
          <span>Histogram ({{ chosenFeature }})</span>
        </div> 
      </v-expansion-panel-header>
      <v-expansion-panel-content>
        <v-radio-group v-model="chosenFeature" label="Choose numeric feature" row>
          <v-radio
            v-for="feature in numericFeatures"
            :key="feature"
            :label="feature"
            :value="feature"
          >
          </v-radio>
        </v-radio-group>

        <div style="margin: 0px 30px;">
          <v-slider
            v-model="numberOfBins"
            :max="binLimits.max"
            :min="binLimits.min"
            :label="`Preferred number of bins: ${numberOfBins}`"
          ></v-slider>
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
import { colors } from '../../theme';
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
type Bin = d3.Bin<string, number>;
export default Vue.extend({
  name: 'Histogram',
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
    const margin = {top: 100, right: 70, bottom: 70, left: 150};
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    const hover = null as null | Bin;
    return {
      numberOfBins: 10,
      binLimits: {
        max: 30,
        min: 1,
      },
      chosenFeature: '',
      height,
      hover,
      width,
      margin,
      panel: [],
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
    };
  },
  computed: {
    bins(): Array<d3.Bin<string, number>> {
      const bins = d3.histogram<string, number>()
        .domain(this.x.domain() as [number, number])
        // .thresholds(this.x.ticks(this.numberOfBins))
        .thresholds(this.numberOfBins)
        .value((id: string) => {
          const i = instanceById(id);
          const value = i.features[this.chosenFeature];
          return value as number;
        })
        (this.instances);
      return bins;
    },
    binMax(): number {
      const binCounts = this.bins.map((bin) => bin.length);
      const binMax = Math.max(...binCounts);
      return binMax;
    },
    externalHoverInstance(): string {
      return this.$store.state.hoverInstance;
    },
    features(): string[] {
      return [...this.boxProps.features];
    },
    featureValues() {
      const instances: any = this.$store.getters.filteredInstances;
      console.log("this.$store.getters.filteredInstances",this.$store.getters.filteredInstances)
      const getInstance = (id: string) => this.$store.getters.instance(id);
      const featureValues: number[] = [...instances].map((id) => getInstance(id).features[this.chosenFeature]);
      return featureValues;
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    numericFeatures(): string[] {
      const allFeatures = [...this.boxProps.features];
      const numericTypes = ['interval', 'ratio'];
      const isNumeric = (featureName: string) => {
        const feature = this.$store.getters.feature(featureName);
        return numericTypes.includes(feature.type);
      };
      return allFeatures.filter(isNumeric);
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    x(): d3.ScaleLinear<number, number> {
      const xMin = Math.min(...this.featureValues);
      const xMax = Math.max(...this.featureValues);
      const x = d3.scaleLinear()
        .domain([xMin, xMax])
        .range([0, this.width]);
      return x;
    },
    y(): d3.ScaleLinear<number, number> {
      const yMax = this.binMax;
      const y = d3.scaleLinear()
        .domain([0, 1.1 * yMax])
        .range([this.height, 0]);
      return y;
    },
  },
  watch: {
    chosenFeature() {
      this.drawInitial();
    },
    externalHoverInstance() {
      this.drawHoverExternal();
    },
    featureValues() {
      this.drawInitial();
    },
    hover() {
      this.drawHover();
    },
    instances() {
      this.drawInitial();
    },
    numberOfBins() {
      console.log('watching number of bins');
      this.drawInitial();
    },
    selections() {
      this.drawSelections();
    },
    // instanceSelection() {
    //   this.draw();
    // },
    // selectedInstances() {
    //   this.draw();
    // },
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
      const hover = this.hover;
      if (!hover) {
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
        bars.data(this.bins)
          .transition()
          .duration(moveDuration)
          .attr('fill', (d: Bin) => d.x0 === hover.x0 ? 'black' : 'lightgray');
        yAxisMarkerLine
          .transition()
          .duration(moveDuration)
          .attr('stroke-opacity', 1)
          .attr('y1', this.y(hover.length))
          .attr('x2', this.width)
          .attr('y2', this.y(hover.length));
        yAxisMarkerText
          .transition()
          .duration(moveDuration)
          .attr('transform', `translate(
            ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2},
            ${this.y(hover.length) - 10})`)
          .text(hover.length);
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
        bars.data(this.bins)
          .transition()
          .duration(250)
          .attr('fill', (d: Bin) =>
            d.includes(this.externalHoverInstance)
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
      // drawBackgroundRect();
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
          .text(`Instances vs ${this.chosenFeature}`);
      };
      drawTitles();
      const translateCell = (bin: Bin) => {
        const xOffset = this.x(bin.x0 as number) + 1;
        return `translate(${xOffset}, 0)`;
      };
      const barDescription = (bin: Bin): string => {
        return `Instances with feature '${this.chosenFeature}' in range [${bin.x0},${bin.x1})`;
      };
      // const updateUserSelection = (bin: Bin) => {
      //   const payload = {
      //     instances: new Set(bin),
      //     description: barDescription(bin),
      //   };
      //   this.$store.dispatch('prependToSelectionHistory', payload);
      // };
      const cells = svg.selectAll('.cell')
        .data(this.bins)
        .join('g')
          .attr('class', 'cell')
          .attr('transform', (d: Bin) => translateCell(d))
          .on('mouseenter', (d: Bin) => this.hover = d)
          .on('mouseleave', (d: Bin) => this.hover = null)
          .on('click', (d: Bin) => this.select(d, 'first'))
          .on('contextmenu', (d: Bin) => this.select(d, 'second'));
      const x = this.x;
      const y = this.y;
      const barWidth = (bin: Bin) => x((bin.x1 as number)) - x((bin.x0 as number));
      const barYOffset = (bin: Bin) => this.y(bin.length);
      const barHeight = (bin: Bin) => this.height - barYOffset(bin);
      const drawBars = () => {
        cells.append('rect')
          .attr('class', 'bar')
          .attr('y', (d: Bin) => barYOffset(d))
          .attr('width', (d: Bin) => barWidth(d))
          .attr('height', (d: Bin) => barHeight(d))
          .attr('stroke', 'black')
          .attr('stroke-width', '0.5px')
          .attr('fill', 'lightgray');
        cells.append("circle")   
            .attr('class', 'bar-circle')
            .attr('cx',(d: Bin) => barWidth(d) / 2 )
            .attr('cy', this.height-15)
            .attr('r','15px')
            .attr("visibility",(d: Bin) => barHeight(d)/ this.height == 0? "hidden"
                  : barHeight(d)/ this.height>0.1? "hidden":"visible")
            .style('fill', 'lightgray')    
            .attr('stroke', 'grey')
        const selections = () => {
          const selectionBarWidth = (d: Bin) => barWidth(d) / 8;
          cells.append('rect')
            .attr('class', 'bar-selection-1')
            .attr('x', (d: Bin) => barWidth(d) / 2 - selectionBarWidth(d))
            .attr('width', (d: Bin) => selectionBarWidth(d))
            .attr('fill', this.selection1Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px');
          cells.append('rect')
            .attr('class', 'bar-selection-2')
            .attr('x', (d: Bin) => barWidth(d) / 2)
            .attr('width', (d: Bin) => selectionBarWidth(d))
            .attr('fill', this.selection2Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px');
          cells.append("circle")   
            .attr('class', 'circle-selection-1')
            .attr('cx',(d: Bin) => barWidth(d) / 2 - selectionBarWidth(d) / 2)
            .attr('cy', (d: Bin) => this.height - selectionBarWidth(d) / 2)
            .attr('r',(d: Bin) => selectionBarWidth(d) / 2)
            .style('fill', this.selection1Color) 
            .attr('stroke', 'grey')
          cells.append("circle")   
            .attr('class', 'circle-selection-2')
            .attr('cx', (d: Bin) => barWidth(d) / 2  + selectionBarWidth(d) / 2)
            .attr('cy', (d: Bin) => this.height - selectionBarWidth(d) / 2)
            .attr('r',(d: Bin) => selectionBarWidth(d) / 2)
            .style('fill', this.selection2Color)     
            .attr('stroke', 'grey')
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
          .data(this.bins)
          .attr('y', (d: Bin) => yOffset(new Set(d), first.instances))
          .attr('height', (d: Bin) => height(new Set(d), first.instances));
       circleSelection1
          .data(this.bins)
          .attr("visibility", (d:Bin) => {
                    return height(new Set(d), first.instances)== 0?"hidden"
                      :height(new Set(d), first.instances) / this.height>0.05?"hidden":"visible"
                    })    
      }
      if (!second) {
        barSelection2.attr('height', 0);
        circleSelection2.attr("visibility","hidden")
      } else {
        barSelection2
          .data(this.bins)
          .attr('y', (d: Bin) => yOffset(new Set(d), second.instances))
          .attr('height', (d: Bin) => height(new Set(d), second.instances));
        circleSelection2
          .data(this.bins)
          .attr("visibility", (d:Bin) => {
                    return height(new Set(d), second.instances)== 0?"hidden"
                      :height(new Set(d), second.instances) / this.height>0.05?"hidden":"visible"
                    })    
      }
    },
    select(
      d: Bin,
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();
      const instances = new Set(d);
      const description = `Instances which have "${this.chosenFeature}" between ${d.x0} and ${d.x1}`;
      // lower bound is inclusive
      const constraintLowerBound = blankConstraint();
      // negation of LT means feature is greater then or equal to
      constraintLowerBound.rule = Rule.FEATURE_LT;
      constraintLowerBound.negation = true;
      constraintLowerBound.value = String(d.x0);
      // upper bound is exclusive, TODO: except for the last bin
      const constraintUpperBound = blankConstraint();
      constraintUpperBound.rule = Rule.FEATURE_LT;
      constraintUpperBound.value = String(d.x1);
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraintLowerBound, constraintUpperBound],
        metric : []
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