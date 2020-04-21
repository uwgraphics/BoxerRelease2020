<template>
  <div ref="chart" />
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import { generateRandomId } from '../utils';

export default Vue.extend({
  name: 'ColorLegend',
  props: {
    colors: {
      type: Array as () => string[],
      default: () => ['white', 'black'],
    },
    height: {
      type: Number,
      default: 100,
    },
    lowerBound: {
      type: Number,
      default: 0,
    },
    title: {
      type: String,
      required: true,
    },
    upperBound: {
      type: Number,
      default: 1,
    },
    width: {
      type: Number,
      default: 500,
    },
  },
  data() {
    const margin = {top: 10, right: 20, bottom: 60, left: 20};
    const width = this.width - margin.left - margin.right;
    const height = this.height - margin.top - margin.bottom;
    return {
      dimensions: {
        height,
        width,
      },
      margin,
    };
  },
  computed: {
    gradientId(): string {
      return generateRandomId();
    },
  },
  watch: {
    upperBound() {
      this.draw();
    },
  },
  mounted() {
    this.draw();
  },
  methods: {
    draw() {
      const x = d3.scaleLinear<number, number>()
        .domain([this.lowerBound, Math.max(1, this.upperBound)])
        .range([0, this.dimensions.width]);

      // @ts-ignore
      const chart = d3.select(this.$refs.chart);
      chart.selectAll('*').remove();
      // set up linear gradient

      const svg = chart
        .append('svg')
          .attr('width', this.dimensions.width + this.margin.left + this.margin.right)
          .attr('height', this.dimensions.height + this.margin.top + this.margin.bottom)
          .attr('viewBox', `
            0 0
            ${this.dimensions.width + this.margin.left + this.margin.right}
            ${this.dimensions.height + this.margin.top + this.margin.bottom}`)
        .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

      const drawGradient = () => {
        const linearGradient = chart
          .select('svg')
          .append('defs')
          .append('linearGradient')
            .attr('id', this.gradientId)
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');
        const percentBetweenColors = 100 / (this.colors.length - 1);
        this.colors.forEach((color, index) => {
          linearGradient.append('stop')
            .attr('offset', `${index * percentBetweenColors}%`)
            .attr('stop-color', color);
        });

        svg.append('rect')
          .attr('width', this.dimensions.width)
          .attr('height', this.dimensions.height)
          .attr('stroke', 'black')
          .attr('stroke-width', '0.5px')
          .style('fill', `url(#${this.gradientId})`);
      };
      drawGradient();

      const drawAxis = () => {
        svg.append('g')
          .attr('transform', `translate(0 ${this.dimensions.height})`)
          .call(d3.axisBottom(x).ticks(5))
          .attr('font-size', 16);
      };
      drawAxis();

      const drawTitle = () => {
        svg.append('text')
          .attr(
            'transform',
            `translate(
              ${this.dimensions.width / 2},
              ${this.dimensions.height + this.margin.bottom / 2}
            )`,
          )
          .attr('dy', '1em')
          .attr('text-anchor', 'middle')
          .style('font-size', '16px')
          .text(this.title);
      };
      drawTitle();

      return;

    },
  },
});
</script>

<style scoped>
</style>
