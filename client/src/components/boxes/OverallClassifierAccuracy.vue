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
            <span>Cumulative Accuracy</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <div style="margin: 0px 30px;">
            <v-radio-group v-model="sorting" label="Sort by how many classifiers correctly classified an instance">
              <v-radio label="ascending" value="ascending"></v-radio>
              <v-radio label="descending" value="descending"></v-radio>
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
  union,
} from '../../utils';

export default Vue.extend({
  name: 'CumulativeAccuracy',
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
    const margin = {top: 50, right: 20, bottom: 90, left: 120};
    const width = 1000 - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    const sorting = 'descending' as 'ascending' | 'descending';
    const hover = {
      type: '' as 'individual' | 'cumulative' | '',
      count: -1,
    };
    return {
      height,
      hover,
      width,
      margin,
      panel: [],
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      sorting,
    };
  },
  computed: {
    agreementKeys(): number[] {
      const agreementKeys = Object.keys(this.agreements).map(Number).sort();
      if (this.sorting === 'descending') {
        agreementKeys.reverse();
      }
      return agreementKeys;
    },
    agreements(): {
      [numberOfCorrectClassifiers: number]: Set<string>,
    } {
      const agreements: {
        [numberOfCorrectClassifiers: number]: Set<string>,
      } = {};

      for (let i = 0; i <= this.classifiers.length; i++) {
        agreements[i] = new Set();
      }

      this.instances.forEach((id) => {
        const i = instanceById(id);
        const correctClassifiers = this.classifiers.filter((c) => i.predictions[c] === i.actual);
        const numberOfCorrectClassifiers = correctClassifiers.length;
        agreements[numberOfCorrectClassifiers].add(id);
      });

      return agreements;
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
    cumulativeAgreements(): {
      [numberOfCorrectClassifiers: number]: Set<string>,
    } {
      const cumulativeAgreements: {
        [numberOfCorrectClassifiers: number]: Set<string>,
      } = {};

      this.agreementKeys.forEach((key, index) => {
        cumulativeAgreements[key] = new Set();
        this.agreementKeys.slice(0, index + 1).forEach((key2) => {
          cumulativeAgreements[key] = union(
            cumulativeAgreements[key],
            this.agreements[key2],
          );
        });
      });

      return cumulativeAgreements;
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
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    x(): d3.ScaleBand<number> {
      const x = d3.scaleBand<number>()
        .domain(this.agreementKeys)
        .range([0, this.width])
        .paddingOuter(1)
        .paddingInner(0.1);
      return x;
    },
    y(): d3.ScaleLinear<number, number> {
      const y = d3.scaleLinear()
        .domain([0, 1])
        .range([this.height, 0]);
      return y;
    },
  },
  watch: {
    externalHoverInstance() {
      this.drawHoverExternal();
    },
    hover() {
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
    barYOffset(d: number) {
      const numberOfInstances = this.agreements[d].size;
      const fractionOfTotalInstances = numberOfInstances / this.instances.length;
      return this.y(fractionOfTotalInstances);
    },
    clearHover() {
      this.hover = ({type: '', count: -1});
    },
    circleYOffset(d: number) {
      const numberOfInstances = this.cumulativeAgreements[d].size;
      const fractionOfTotalInstances = numberOfInstances / this.instances.length;
      return this.y(fractionOfTotalInstances);
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

      const x = this.x;
      const y = this.y;

      const drawAxes = () => {
        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(x)
              .tickSizeOuter(0),
          );

        svg.append('g')
          .call(xAxis)
          .attr('font-size', 20);

        const yAxis = (g: any) => g
          .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        svg.append('g')
          .call(yAxis)
          .attr('font-size', 20);
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
          .style('font-size', '24px')
          .text('How many classifiers correctly classified an instance');

        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Fraction of instances');

        // svg.append('text')
        //   .attr(
        //     'transform',
        //     `translate(
        //       ${-this.margin.left / 2 + this.width / 2},
        //       ${-this.margin.top / 3}
        //     )`,
        //   )
        //   .attr('text-anchor', 'middle')
        //   .style('font-size', '30px')
        //   .text('Overall Classifier Accuracy');
      };
      drawTitles();

      const drawBars = () => {
        const barCells = svg.selectAll('.cell')
          .data(this.agreementKeys)
          .join('g')
            .attr('class', 'cell')
            .attr('transform', (d: number) => `translate(${x(d)}, ${0})`)
            .on('mouseenter', (d: number) => this.hover = ({type: 'individual', count: d}))
            .on('mouseleave', this.clearHover)
            .on('click', (d: number) => this.select(d, 'individual', 'first'))
            .on('contextmenu', (d: number) => this.select(d, 'individual', 'second'));

        const barWidth = x.bandwidth();
        const barYOffset = this.barYOffset;
        const barHeight = (d: number) => this.height - barYOffset(d);

        barCells.append('rect')
          .attr('class', 'bar')
          .attr('y', (d: number) => barYOffset(d))
          .attr('width', barWidth)
          .attr('height', (d: number) => barHeight(d))
          .attr('fill', 'lightgray')
          .attr('stroke', 'black')
          .style('paint-order', 'stroke');
        barCells.append("circle")   
            .attr('class', 'bar-circle')
            .attr('cx', barWidth / 2)
            .attr('cy',  this.height-15)
            .attr('r','15px')
            .attr("visibility",(d: number) => barHeight(d)/ this.height == 0? "hidden"
                  : barHeight(d)/ this.height>0.05? "hidden":"visible")
            .style('fill', 'lightgray')    
            .attr('stroke', 'grey')

        const selections = () => {
          const selectionBarWidth = barWidth / 8;
          barCells.append('rect')
            .attr('class', 'bar-selection-1')
            .attr('x', barWidth / 2 - selectionBarWidth)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection1Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px');
          barCells.append('rect')
            .attr('class', 'bar-selection-2')
            .attr('x', barWidth / 2)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection2Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px');
           barCells.append("circle")   
            .attr('class', 'circle-selection-1')
            .attr('cx',(d: string) => barWidth / 2 - 0.5*selectionBarWidth)
            .attr('cy', this.height-selectionBarWidth / 2)
            .attr('r',selectionBarWidth / 2)
            .style('fill', this.selection1Color) 
            .attr('stroke', 'grey')
          barCells.append("circle")   
            .attr('class', 'circle-selection-2')
            .attr('cx', (d: string) => barWidth / 2 + 0.5*selectionBarWidth)
            .attr('cy', this.height-selectionBarWidth / 2)
            .attr('r',selectionBarWidth / 2)
            .style('fill', this.selection2Color)   
            .attr('stroke', 'grey')  
        };
        selections();
      };

      const drawCircle = () => {
        const circleXOffset = x.bandwidth() / 2;
        const circleYOffset = this.circleYOffset;
        const circleR = Math.min(this.width / 30, x.bandwidth() / 10);

        svg.selectAll('circle')
          .data(this.agreementKeys)
          .join('circle')
          .attr('class', 'cumulative')
          .attr('cx', (d: number) => (x(d) as number) + circleXOffset)
          .attr('cy', (d: number) => circleYOffset(d))
          .attr('r', circleR)
          .attr('fill', 'lightgray')
          .attr('stroke', 'black')
          .style('paint-order', 'stroke')
          .on('mouseenter', (d: number) => this.hover = ({type: 'cumulative', count: d}))
          .on('mouseleave', this.clearHover)
          .on('click', (d: number) => this.select(d, 'cumulative', 'first'))
          .on('contextmenu', (d: number) => this.select(d, 'cumulative', 'second'));
      };

      const drawLine = () => {
        const line = d3.line()
          .x((d) => d[0])
          .y((d) => d[1]);

        const coordinates: Array<[number, number]> = [];
        const coordinateXOffset = x.bandwidth() / 2;
        const coordinateYOffset = (d: number) => {
          const numberOfInstances = this.cumulativeAgreements[d].size;
          const fractionOfTotalInstances = numberOfInstances / this.instances.length;
          return y(fractionOfTotalInstances);
        };
        this.agreementKeys.forEach((key) => {
          const xVal = (x(key) as number) + coordinateXOffset;
          const yVal = coordinateYOffset(key);
          coordinates.push([xVal, yVal]);
        });

        svg.append('path')
          .datum(coordinates)
          .attr('d', line)
          .attr('fill', 'none')
          .attr('stroke', 'lightgray')
          .attr('stroke-width', '2px');
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

      drawLine();
      drawCircle();
      drawBars();
      yAxisMarkerLine();
      yAxisMarkerText();

      this.drawHover();
      this.drawSelections();
      this.drawHoverExternal();
    },
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const bars = chart.selectAll('.bar');
      const circles = chart.selectAll('.cumulative');
      const yAxisMarkerLine = chart.select('.y-axis-marker-line');
      const yAxisMarkerText = chart.select('.y-axis-marker-text');

      const moveDuration = 500;
      const disappearDuration = 1000;

      switch (this.hover.type) {
        case 'individual':
          bars.data(this.agreementKeys)
            .transition()
            .duration(moveDuration)
            .attr('fill', (d: number) => d === this.hover.count ? 'black' : 'lightgray');
          circles
            .transition()
            .duration(moveDuration)
            .attr('fill', 'lightgray');
          yAxisMarkerLine
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1', this.barYOffset(this.hover.count))
            .attr('x2', this.width)
            .attr('y2', this.barYOffset(this.hover.count));
          yAxisMarkerText
            .transition()
            .duration(moveDuration)
            .attr('transform', `translate(
              ${this.x.paddingOuter() * this.x.bandwidth() / 2},
              ${this.barYOffset(this.hover.count) - 10})`)
            .text(`${(this.agreements[this.hover.count].size / this.instances.length * 100).toFixed(1)}%`);
          break;
        case 'cumulative':
          const hoverCountIndex = this.agreementKeys.indexOf(this.hover.count);
          bars.data(this.agreementKeys)
            .transition()
            .duration(moveDuration)
            .attr('fill', (d: number, i: number) => i <= hoverCountIndex ? 'black' : 'lightgray');
          circles.data(this.agreementKeys)
            .transition()
            .duration(moveDuration)
            .attr('fill', (d: number) => d === this.hover.count ? 'black' : 'lightgray');
          yAxisMarkerLine
            .transition()
            .duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('y1', this.circleYOffset(this.hover.count))
            .attr('x2', (this.x(this.hover.count) as number) + this.x.bandwidth() / 2)
            .attr('y2', this.circleYOffset(this.hover.count));
          yAxisMarkerText
            .transition()
            .duration(moveDuration)
            .attr('transform', `translate(
              ${this.x.paddingOuter() * this.x.bandwidth() / 2},
              ${this.circleYOffset(this.hover.count) - 10})`)
            .text(`${(this.cumulativeAgreements[this.hover.count].size / this.instances.length * 100).toFixed(1)}%`);
          break;
        default:
          bars
            .transition()
            .duration(disappearDuration)
            .attr('fill', 'lightgray');
          circles
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
          break;
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
        bars.data(this.agreementKeys)
          .transition()
          .duration(250)
          .attr('fill', (d: number) =>
            this.agreements[d].has(this.externalHoverInstance)
            ? 'black'
            : 'lightgray');
      }
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
        const fractionOfTotalInstances = overlappingInstances.size / this.instances.length;
        return this.y(fractionOfTotalInstances);
      };
      const height = (instances: Set<string>, selection: Set<string>) => {
        return this.height - yOffset(instances, selection);
      };

      if (!first) {
        barSelection1.attr('height', '0');
        circleSelection1.attr("visibility","hidden")
      } else {
        barSelection1
          .data(this.agreementKeys)
          .attr('y', (d: number) => yOffset(this.agreements[d], first.instances))
          .attr('height', (d: number) => height(this.agreements[d], first.instances));
        circleSelection1
          .data(this.agreementKeys)
          .attr("visibility", (d:number) => {
                    return height(this.agreements[d], first.instances) == 0?"hidden"
                      :height(this.agreements[d], first.instances)/ this.height>0.05?"hidden":"visible"
                    })    
      }

      if (!second) {
        barSelection2.attr('height', '0');
        circleSelection2.attr("visibility","hidden")
      } else {
        barSelection2
          .data(this.agreementKeys)
          .attr('y', (d: number) => yOffset(this.agreements[d], second.instances))
          .attr('height', (d: number) => height(this.agreements[d], second.instances));
        circleSelection2
          .data(this.agreementKeys)
          .attr("visibility", (d:number) => {
                    return height(this.agreements[d], second.instances) == 0?"hidden"
                      :height(this.agreements[d], second.instances)/ this.height>0.05?"hidden":"visible"
                    })      
      }
    },
    select(
      d: number,
      type: 'individual' | 'cumulative',
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const instances = type === 'individual'
        ? this.agreements[d]
        : this.cumulativeAgreements[d];
      const description = type === 'individual'
        ? `Instances which exactly ${d} classifiers correctly classified`
        : `Instances which at least ${d} classifiers correctly classified`;

      this.$store.dispatch('prependToSelectionHistory', { instances, description });
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
