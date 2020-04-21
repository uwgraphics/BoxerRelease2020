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
            <span>Pairwise Classifier Consensus</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <div style="margin: 0px 30px;"></div>
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
  generateRandomId,
  instanceById,
  intersection,
} from '../../utils';
import { PredicateSimple, Rule } from '../constraints/types';
import { blankConstraint } from '../constraints/utils';

export default Vue.extend({
  name: 'PairwiseClassifierConsensus',
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
    const margin = {top: 20, right: 200, bottom: 100, left: 200};
    const width = 500;
    const height = 500;
    const hover = {
      consensusType: '' as 'agree' | 'disagree' | '',
      classifiers: ['', ''],
    };
    return {
      // agreeColor: '#4CAF50',
      // disagreeColor: '#F44336',
      agreeColor: '#4393c3',
      backgroundColor: 'white',
      disagreeColor: '#d6604d',
      height,
      hover,
      hoverColor: 'black',
      margin,
      neutralColor: 'white',
      // neutralColor: '#ffffbf',
      panel: [],
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      width,
    };
  },
  computed: {
    agreeScale(): d3.ScaleLinear<string, string> {
      const agreeScale = d3.scaleLinear<string>()
        .domain([0, this.consensusMax])
        .range([this.neutralColor, this.agreeColor]);
      return agreeScale;
    },
    consensus(): {
      [classifier1: string]: {
        [classifier2: string]: {
          agree: Set<string>,
          disagree: Set<string>,
        },
      },
    } {
      const consensus: {
        [classifier1: string]: {
          [classifier2: string]: {
            agree: Set<string>,
            disagree: Set<string>,
          },
        },
      } = {};

      this.classifiers.forEach((c1, index) => {
        consensus[c1] = {};
        this.classifiers.slice(0, index).forEach((c2) => {
          consensus[c1][c2] = {
            agree: new Set(),
            disagree: new Set(),
          };
          // using reversed order of keys references same object
          consensus[c2][c1] = consensus[c1][c2];
        });
      });

      this.instances.forEach((id) => {
        const i = instanceById(id);
        this.classifiers.forEach((c1, index) => {
          this.classifiers.slice(0, index).forEach((c2) => {
            const type = i.predictions[c1] === i.predictions[c2]
              ? 'agree'
              : 'disagree';
            consensus[c1][c2][type].add(id);
          });
        });
      });

      return consensus;
    },
    consensusKeys(): string[] {
      const consensusKeys = Object.keys(this.consensus);
      return consensusKeys;
    },
    consensusMax(): number {
      let consensusMax = 0;

      this.classifiers.forEach((c1, index) => {
        this.classifiers.slice(0, index).forEach((c2) => {
          consensusMax = Math.max(
            consensusMax,
            this.consensus[c1][c2].agree.size,
            this.consensus[c1][c2].disagree.size,
          );
        });
      });

      return consensusMax;
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
    disagreeScale(): d3.ScaleLinear<string, string> {
      const disagreeScale = d3.scaleLinear<string>()
        .domain([0, this.consensusMax])
        .range([this.neutralColor, this.disagreeColor]);
      return disagreeScale;
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
    keyCross(): Array<[unknown, unknown]> {
      const keyCross = d3.cross(this.consensusKeys, this.consensusKeys);
      return keyCross;
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    x(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
        .domain(this.consensusKeys)
        .range([0, this.width])
        .paddingOuter(0.05)
        .paddingInner(0.1);
      return x;
    },
    y(): d3.ScaleBand<string> {
      const y = d3.scaleBand<string>()
        .domain(this.consensusKeys)
        .range([0, this.height])
        .paddingOuter(0.05)
        .paddingInner(0.1);
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
  },
  mounted() {
    this.drawInitial();
  },
  methods: {
    clearHover() {
      this.hover = {
        consensusType: '',
        classifiers: ['', ''],
      };
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
          .attr('fill', this.backgroundColor)
          .attr('stroke', 'black');
      };
      drawBackgroundRect();

      const x = this.x;
      const y = this.y;

      const drawAxes = () => {
        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(d3.axisBottom(x));

        svg.append('g')
          .call(xAxis)
          .attr('class', 'axis')
          .attr('font-size', 20)
          .selectAll('text')
            .attr('transform', 'translate(0, 10) rotate(20)')
            .style('text-anchor', 'start');

        const yAxis = (g: any) => g
          .attr('transform', `translate(${this.width}, ${0})`)
          .call(d3.axisRight(y));

        svg.append('g')
          .call(yAxis)
          .attr('class', 'axis')
          .attr('font-size', 20)
          .selectAll('text');

        svg.selectAll('.axis').selectAll('.domain').remove();
      };
      drawAxes();

      const drawTitles = () => {
        // svg.append('text')
        //   .attr('transform', () => {
        //     const xOffset = this.width / 2;
        //     const yOffset = this.height + this.margin.bottom * 0.8;
        //     return `translate(${xOffset}, ${yOffset})`;
        //   })
        //   .style('text-anchor', 'middle')
        //   .style('font-size', '24px')
        //   .text('Classifier 1');

        // svg.append('text')
        //   .attr('transform', 'rotate(-90)')
        //   .attr('x', -this.height / 2)
        //   .attr('y', -this.margin.left * 0.9)
        //   .attr('dy', '1em')
        //   .style('text-anchor', 'middle')
        //   .style('font-size', '24px')
        //   .text('Classifier 2');

        svg.append('text')
          .attr(
            'transform',
            `translate(
              ${-this.margin.left / 2 + this.width / 2 + this.margin.right / 2},
              ${-this.margin.top / 3}
            )`,
          )
          .attr('text-anchor', 'middle')
          .style('font-size', '30px')
          .text('Pairwise Classifier Consensus');
      };
      // drawTitles();

      const drawLegend = () => {
        const margin = 50;
        const width = this.margin.left - 2 * margin;
        const height = this.height - 2 * margin;

        // @ts-ignore
        const defs = d3.select(this.$refs.svg)
          .select('svg')
          .append('defs');

        interface GradientData {
          id: string;
          color: string;
        }
        const gradientsData: GradientData[] = [
          {
            id: generateRandomId(),
            color: this.agreeColor,
          },
          {
            id: generateRandomId(),
            color: this.disagreeColor,
          },
        ];

        const gradients = defs.selectAll('linearGradient')
          .data(gradientsData)
          .join('linearGradient')
            .attr('id', (d: GradientData) => d.id)
            .attr('x1', '0%')
            .attr('y1', '100%')
            .attr('x2', '0%')
            .attr('y2', '0%');
        gradients.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', this.neutralColor)
          .attr('stop-opacity', 1);
        gradients.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', (d: GradientData) => d.color)
          .attr('stop-opacity', 1);

        // @ts-ignore
        const legend = d3.select(this.$refs.svg)
          .select('svg')
          .append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${margin}, ${this.margin.top + margin})`);

        legend.selectAll('rect')
          .data(gradientsData)
          .join('rect')
            .attr('x', (d: GradientData, i: number) => i * width / 2)
            .attr('width', width / 2)
            .attr('height', height)
            .attr('fill', (d: GradientData, i: number) => `url(#${d.id})`)
            .attr('stroke', 'black');

        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height + margin / 2})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .text(0);
        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${-margin / 2})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .text(this.consensusMax);

        legend.append('text')
          .attr('transform', `translate(${-margin / 2}, ${height / 2}) rotate(-90)`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text('Number of instances');

        legend.append('text')
          .attr('transform', `translate(${width / 4}, ${height / 2}) rotate(-90)`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text('agree');
        legend.append('text')
          .attr('transform', `translate(${width * 3 / 4}, ${height / 2}) rotate(-90)`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text('disagree');

        console.log('legend draw');
      };
      drawLegend();

      const drawSquares = () => {
        const cells = svg.selectAll('.cell')
          .data(this.keyCross)
          .join('g')
            .attr('class', 'cell')
            .attr('transform', (d: string) => `translate(${x(d[0])}, ${y(d[1])})`)
            .on('mouseenter', (d: [string, string]) => {
              const consensusType = this.whichTriangle(d);
              if (!consensusType) {
                return;
              }
              this.hover = { consensusType, classifiers: d };
            })
            .on('mouseleave', this.clearHover)
            .on('click', (d: [string, string]) => this.select(d, 'first'))
            .on('contextmenu', (d: [string, string]) => this.select(d, 'second'));

        cells.append('rect')
          .attr('width', x.bandwidth())
          .attr('height', y.bandwidth())
          .attr('fill', (d: [string, string]) => {
            const consensusType = this.whichTriangle(d);
            if (!consensusType) {
              return this.backgroundColor;
            }
            const count = this.consensus[d[0]][d[1]][consensusType].size;
            const scale = consensusType === 'agree'
              ? this.agreeScale
              : this.disagreeScale;
            return scale(count);
          })
          .attr('stroke', (d: [string, string]) => d[0] === d[1] ? 'none' : 'black')
          .style('paint-order', 'stroke');

        cells.append('circle')
          .attr('class', 'hover-circle')
          .attr('cx', x.bandwidth() / 2)
          .attr('cy', y.bandwidth() / 2)
          .attr('r', Math.min(x.bandwidth(), y.bandwidth()) / 12)
          .attr('fill', 'black');

        const selections = () => {
          const n = 10;

          cells.append('rect')
            .attr('y', this.y.bandwidth() * (n - 2) / n)
            .attr('width', (d: [string, string]) =>
              d[0] === d[1]
                ? 0
                : this.x.bandwidth())
            .attr('height', this.y.bandwidth() / n * 2)
            .attr('fill', 'black');
          cells.append('rect')
            .attr('class', 'selection-1')
            .attr('y', this.y.bandwidth() * (n - 2) / n)
            .attr('height', this.y.bandwidth() / n)
            .attr('fill', this.selection1Color);
          cells.append('rect')
            .attr('class', 'selection-2')
            .attr('y', this.y.bandwidth() * (n - 1) / n)
            .attr('height', this.y.bandwidth() / n)
            .attr('fill', this.selection2Color);
        };
        selections();
      };

      const hoverText = () => {
        svg.append('text')
          .attr('class', 'hover-text')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .attr('font-size', 20)
          .attr('pointer-events', 'none');
      };

      drawSquares();
      hoverText();

      this.drawHover();
      this.drawSelections();
      this.drawHoverExternal();
    },
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const hoverText = chart.select('.hover-text');

      if (this.hover.consensusType) {
        const [c1, c2] = this.hover.classifiers;
        const count = this.consensus[c1][c2][this.hover.consensusType].size;
        hoverText
          .attr('fill-opacity', 0)
          .attr('transform', `translate(
            ${(this.x(c1) as number) + this.x.bandwidth() / 2},
            ${(this.y(c2) as number) + this.y.bandwidth() / 2})`)
          .text(count)
          .transition()
          .duration(500)
          .attr('fill-opacity', 1);
      } else {
        hoverText.text('');
      }
    },
    drawHoverExternal() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const circles = chart.selectAll('.hover-circle');

      if (!this.externalHoverInstance) {
        circles.attr('fill-opacity', 0);
      } else {
        circles.data(this.keyCross)
          .attr('fill-opacity', (d: [string, string]) => {
            const consensusType = this.whichTriangle(d);
            if (!consensusType) {
              return 0;
            }
            const instances = this.consensus[d[0]][d[1]][consensusType];
            if (instances.has(this.externalHoverInstance)) {
              return 1;
            }
            return 0;
          });
      }
    },
    drawSelections() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const barSelection1 = chart.selectAll('.selection-1');
      const barSelection2 = chart.selectAll('.selection-2');

      const { first, second } = this.selections;

      const barWidth = (d: [string, string], selection: SelectionRecord) => {
        const consensusType = this.whichTriangle(d);
        if (!consensusType) {
          return 0;
        }
        const instances = this.consensus[d[0]][d[1]][consensusType];
        const overlappingInstances = intersection(instances, selection.instances);
        const fractionOfTotalInstances = overlappingInstances.size / instances.size;
        const width = this.x.bandwidth() * fractionOfTotalInstances;
        return width;
      };

      if (!first) {
        barSelection1.attr('width', 0);
      } else {
        barSelection1
          .data(this.keyCross)
          .attr('width', (d: [string, string]) => barWidth(d, first));
      }

      if (!second) {
        barSelection2.attr('width', 0);
      } else {
        barSelection2
          .data(this.keyCross)
          .attr('width', (d: [string, string]) => barWidth(d, second));
      }
    },
    select(
      classifiers: [string, string],
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const consensusType = this.whichTriangle(classifiers);
      if (!consensusType) {
        return;
      }

      const [c1, c2] = classifiers;

      const constraint = blankConstraint();
      constraint.rule = Rule.AGREE;
      constraint.negation = (consensusType === 'disagree');
      constraint.classifier = c1;
      constraint.classifier2 = c2;

      const instances = this.consensus[c1][c2][consensusType];
      const description = `Instances on which classifiers ${c1} and ${c2} ${consensusType}`;

      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric:[]
      };
      const payload = {
        description,
        instances,
        predicate,
      };

      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('setToMostRecentSelection', whichOverlap);
    },
    whichTriangle(classifiers: [string, string]) {
      const [c1, c2] = classifiers;
      const c1Index = this.consensusKeys.indexOf(c1);
      const c2Index = this.consensusKeys.indexOf(c2);
      if (c1Index < c2Index) {
        return 'agree';
      }
      if (c1Index > c2Index) {
        return 'disagree';
      }
      return '';
    },
  },
});
</script>

<style scoped>
.card {
  background-color: white;
}
</style>
