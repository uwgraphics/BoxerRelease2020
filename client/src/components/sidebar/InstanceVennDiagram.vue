<template>
  <div>
    <svg
      width="100%"
      :viewBox="`0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`"
      ref="svg"
    ></svg>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';

import { colors } from '../../theme';
import { SelectionRecord } from '../../types';
import {
  difference,
  generateRandomId,
  intersection,
  union,
} from '../../utils';
import {
  Predicate,
  PredicateComposed,
  PredicateNegated,
  PredicateSimple,
  Rule,
} from '../constraints/types';
import {
  blankConstraint,
  composePredicates,
} from '../constraints/utils';

export default Vue.extend({
  name: 'InstanceVennDiagram',
  data() {
      const margin = { top: 50, right: 20, bottom: 50, left: 20 };
      const width = 400 - margin.left - margin.bottom;
      const height = 200 - margin.top - margin.bottom;
      return {
        height,
        margin,
        width,
      };
  },
  computed: {
    barHeight(): number {
      return this.height / 3;
    },
    barWidth(): number {
      return this.width;
    },
    complement(): Set<string> {
      return difference(this.instances, this.firstSecondUnion);
    },
    first(): Set<string> {
      const first =
        (this.selections.first)
        ? this.selections.first.instances
        : new Set<string>();
      return first;
    },
    firstOnly(): Set<string> {
      return difference(this.first, this.second);
    },
    firstSecondUnion(): Set<string> {
      return union(this.first, this.second);
    },
    firstSecondIntersection(): Set<string> {
      return intersection(this.first, this.second);
    },
    gradientId(): string {
      return generateRandomId();
    },
    instances(): Set<string> {
      return this.$store.getters.filteredInstances;
    },
    interBarHeight(): number {
      return this.height - 2 * this.barHeight;
    },
    second(): Set<string> {
      const second =
        (this.selections.second)
        ? this.selections.second.instances
        : new Set<string>();
      return second;
    },
    secondOnly(): Set<string> {
      return difference(this.second, this.first);
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    xTotal(): d3.ScaleLinear<number, number> {
      const xTotal = d3.scaleLinear()
        .domain([0, this.instances.size])
        .range([0, this.barWidth]);
      return xTotal;
    },
    xSelection(): d3.ScaleLinear<number, number> {
      const xSelection = d3.scaleLinear()
        .domain([0, Math.max(1, this.firstSecondUnion.size)])
        .range([0, this.barWidth]);
      return xSelection;
    },
  },
  watch: {
    instances() {
      this.drawInitial();
    },
    selections() {
      this.drawHover();
    },
  },
  mounted() {
    this.drawInitial();
  },
  methods: {
    drawHover() {
      // @ts-ignore
      const svg = d3.select(this.$refs.svg);

      const moveDuration = 1000;

      const drawBars = () => {
        const rectComplement = svg.select('.rect-complement');
        const rectUnion = svg.select('.rect-union');
        const rectFirstOnly = svg.select('.rect-first-only');
        const rectIntersection = svg.select('.rect-intersection');
        const rectSecondOnly = svg.select('.rect-second-only');

        rectUnion
          .transition().duration(moveDuration)
          .attr('x', 0)
          .attr('width', this.xTotal(this.firstSecondUnion.size));

        rectComplement
          .transition().duration(moveDuration)
          .attr('x', this.xTotal(this.firstSecondUnion.size))
          .attr('width', this.barWidth - this.xTotal(this.firstSecondUnion.size));

        rectFirstOnly
          .transition().duration(moveDuration)
          .attr('width', this.xSelection(this.firstOnly.size));

        rectIntersection
          .transition().duration(moveDuration)
          .attr('x', this.xSelection(this.firstOnly.size))
          .attr('width', this.xSelection(this.firstSecondIntersection.size));

        rectSecondOnly
          .transition().duration(moveDuration)
          .attr('x', this.xSelection(this.first.size))
          .attr('width', this.xSelection(this.secondOnly.size));
      };
      drawBars();

      const drawLines = () => {
        const leftLine = svg.select('.left-line');
        const rightLine = svg.select('.right-line');

        if (!this.firstSecondUnion.size) {
          leftLine
            .transition().duration(moveDuration)
            .attr('stroke-opacity', 0);

          rightLine
            .transition().duration(moveDuration)
            .attr('stroke-opacity', 0)
            .attr('x1', 0)
            .attr('x2', 0);
        } else {
          leftLine
            .transition().duration(moveDuration)
            .attr('stroke-opacity', 1);

          rightLine
            .transition().duration(moveDuration)
            .attr('stroke-opacity', 1)
            .attr('x1', this.xTotal(this.firstSecondUnion.size))
            .attr('x2', this.barWidth);
        }
      };
      drawLines();

      const drawText = () => {
        const textComplement = svg.select('.text-complement');
        const textUnion = svg.select('.text-union');
        const textFirstOnly = svg.select('.text-first-only');
        const textIntersection = svg.select('.text-intersection');
        const textSecondOnly = svg.select('.text-second-only');

        textUnion
          .html(this.percentageText(this.firstSecondUnion.size, this.instances.size))
          .transition().duration(moveDuration)
          .attr('x',  this.xTotal(this.firstSecondUnion.size) / 2);

        textComplement
          .html(this.percentageText(this.complement.size, this.instances.size))
          .transition().duration(moveDuration)
          .attr('x',
            this.xTotal(this.firstSecondUnion.size)
            + (this.barWidth - this.xTotal(this.firstSecondUnion.size)) / 2);

        textFirstOnly
          .html(this.percentageText(this.firstOnly.size, this.firstSecondUnion.size))
          .transition().duration(moveDuration)
          .attr('x',  this.xSelection(this.firstOnly.size) / 2);

        textIntersection
          .html(this.percentageText(this.firstSecondIntersection.size, this.firstSecondUnion.size))
          .transition().duration(moveDuration)
          .attr('x',  this.xSelection(this.firstOnly.size) + this.xSelection(this.firstSecondIntersection.size) / 2);

        textSecondOnly
          .html(this.percentageText(this.secondOnly.size, this.firstSecondUnion.size))
          .transition().duration(moveDuration)
          .attr('x',  this.xSelection(this.first.size) + this.xSelection(this.secondOnly.size) / 2);
      };
      drawText();

    },
    drawInitial() {
      // @ts-ignore
      const svg = d3.select(this.$refs.svg);
      svg.selectAll('*').remove();

      const defineGradient = () => {
        const defs = svg.append('defs');

        const gradient = defs.append('linearGradient')
          .attr('id', this.gradientId)
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '0%')
          .attr('y2', '100%');
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', colors.overlapSelections.first)
          .attr('stop-opacity', 1);
        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', colors.overlapSelections.second)
          .attr('stop-opacity', 1);
      };
      defineGradient();

      const chart = svg.append('g')
        .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

      const drawBars = () => {
        const barTotal = chart.append('g')
          .attr('class', 'bar-whole')
          .attr('transform', `translate(${0}, ${0})`);

        const barUnion = chart.append('g')
          .attr('class', 'bar-union')
          .attr('transform', `translate(${0}, ${this.barHeight + this.interBarHeight})`);

        barUnion.append('rect')
          .attr('class', 'rect-outline')
          .attr('width', this.barWidth)
          .attr('height', this.barHeight)
          .attr('fill', 'none')
          .attr('stroke', 'black');

        barTotal.append('rect')
          .attr('class', 'rect-union')
          .attr('x', 0)
          .attr('width', this.xTotal(this.firstSecondUnion.size))
          .attr('height', this.barHeight)
          .attr('fill', 'black')
          .attr('stroke', 'black')
          .on('click', () => this.select('union', this.selections.first, this.selections.second));

        barTotal.append('rect')
          .attr('class', 'rect-complement')
          .attr('x', this.xTotal(this.firstSecondUnion.size))
          .attr('width', this.barWidth - this.xTotal(this.firstSecondUnion.size))
          .attr('height', this.barHeight)
          .attr('fill', 'lightgray')
          .attr('stroke', 'black')
          .on('click', () => this.select('complement', this.selections.first, this.selections.second));

        barUnion.append('rect')
          .attr('class', 'rect-first-only')
          .attr('width', this.xSelection(this.firstOnly.size))
          .attr('height', this.barHeight)
          .attr('fill', colors.overlapSelections.first)
          .attr('stroke', 'black')
          .on('click', () => this.select('difference', this.selections.first, this.selections.second));

        barUnion.append('rect')
          .attr('class', 'rect-intersection')
          .attr('x', this.xSelection(this.firstOnly.size))
          .attr('width', this.xSelection(this.firstSecondIntersection.size))
          .attr('height', this.barHeight)
          .attr('fill', `url(#${this.gradientId})`)
          .attr('stroke', 'black')
          .on('click', () => this.select('intersection', this.selections.first, this.selections.second));

        barUnion.append('rect')
          .attr('class', 'rect-second-only')
          .attr('x', this.xSelection(this.first.size))
          .attr('width', this.xSelection(this.secondOnly.size))
          .attr('height', this.barHeight)
          .attr('fill', colors.overlapSelections.second)
          .attr('stroke', 'black')
          .on('click', () => this.select('difference', this.selections.second, this.selections.first));

        const drawText = () => {
          barTotal.append('text')
            .attr('class', 'text-union')
            .attr('x',  this.xTotal(this.firstSecondUnion.size) / 2)
            .attr('y', -10)
            .attr('dominant-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .html(this.percentageText(this.firstSecondUnion.size, this.instances.size));

          barTotal.append('text')
            .attr('class', 'text-complement')
            .attr('x',
              this.xTotal(this.firstSecondUnion.size)
              + (this.barWidth - this.xTotal(this.firstSecondUnion.size)) / 2)
            .attr('y', -10)
            .attr('dominant-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .html(this.percentageText(this.complement.size, this.instances.size));

          barUnion.append('text')
            .attr('class', 'text-first-only')
            .attr('x',  this.xSelection(this.firstOnly.size) / 2)
            .attr('y', this.barHeight + 10)
            .attr('dominant-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .html(this.percentageText(this.firstOnly.size, this.firstSecondUnion.size));

          barUnion.append('text')
            .attr('class', 'text-intersection')
            .attr('x',  this.xSelection(this.firstOnly.size) + this.xSelection(this.firstSecondIntersection.size) / 2)
            .attr('y', this.barHeight + 10)
            .attr('dominant-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .html(this.percentageText(this.firstSecondIntersection.size, this.firstSecondUnion.size));

          barUnion.append('text')
            .attr('class', 'text-second-only')
            .attr('x',  this.xSelection(this.first.size) + this.xSelection(this.secondOnly.size) / 2)
            .attr('y', this.barHeight + 10)
            .attr('dominant-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .html(this.percentageText(this.secondOnly.size, this.firstSecondUnion.size));
        };
        drawText();
      };
      drawBars();

      const drawLines = () => {
        const leftLine = chart.append('line')
          .attr('class', 'left-line')
          .attr('x1', 0)
          .attr('y1', this.barHeight)
          .attr('x2', 0)
          .attr('y2', this.barHeight + this.interBarHeight)
          .attr('stroke', 'black')
          .attr('stroke-opacity', 0);

        const rightLine = chart.append('line')
          .attr('class', 'right-line')
          .attr('x1', this.xTotal(this.firstSecondUnion.size))
          .attr('y1', this.barHeight)
          .attr('x2', this.width)
          .attr('y2', this.barHeight + this.interBarHeight)
          .attr('stroke', 'black')
          .attr('stroke-opacity', 0);
      };
      drawLines();

    },
    percentageText(value: number, total: number) {
      if (!value) {
        return '';
      }
      const percentage = value / total * 100;
      if (percentage > 1) {
        return `${percentage.toFixed(0)}%`;
      }
      return `${percentage.toFixed(1)}%`;
    },
    select(
      operation: 'complement' | 'difference' | 'intersection' | 'union',
      operand1: SelectionRecord | null,
      operand2: SelectionRecord | null,
    ) {
      if (!(operand1 && operand2)) {
        console.error(`invalid operand1 (${operand1}) or operand2 (${operand2}) to select in InstanceVennDiagram`);
        return;
      }

      let composition: Set<string> = new Set();
      switch (operation) {
        case 'complement':
          composition = difference(this.instances, union(operand1.instances, operand2.instances));
          break;
        case 'difference':
          composition = difference(operand1.instances, operand2.instances);
          break;
        case 'intersection':
          composition = intersection(operand1.instances, operand2.instances);
          break;
        case 'union':
          composition = union(operand1.instances, operand2.instances);
          break;
      }

      const description =
        (operation === 'complement')
          ? `${operation}(${operand1.id})`
          : `${operation}(${operand1.id}, ${operand2.id})`;

      const payload: {
        instances: Set<string>,
        description: string,
        predicate?: Predicate,
      } = {
        instances: composition,
        description,
      };

      const p1 = operand1.predicate;
      const p2 = operand2.predicate;
      if (!p1) {
        console.error('ERROR: Cannot compose. Predicate of operand1 is not defined!');
      } else if (!p2) {
        console.error('ERROR: Cannot compose. Predicate of operand2 is not defined!');
      } else {
        const predicate: Predicate = composePredicates(p1, p2, operation);
        console.log('composed predicate is', predicate);
        payload.predicate = predicate;
      }

      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('setToMostRecentSelection', 'first');
      this.$store.dispatch('chooseOverlapSelection', { selection: null, whichOverlap: 'second'});
    },
  },
});
</script>
