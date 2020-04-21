<template>
  <div ref="chart" @mouseleave="onHoverChange(['', ''], '')" />
</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import ColorLegend from '@/components/ColorLegend.vue';
import {
  BoxProps,
  EntityType,
  Instance,
  SelectionAction,
  SelectionRecord,
} from '../../types';
import { colors } from '../../theme';
import {
  instanceById,
  overlapCount,
  overlapFraction,
  truncateLabel,
} from '../../utils';

type ClassCross = [string, string];

export default Vue.extend({
  name: 'ConfusionMatrixMinimal',
  props: {
    boxProps: {
      type: Object as () => BoxProps,
      required: true,
      validator: (boxProps: BoxProps) => {
        return boxProps.classifiers.size === 1;
      },
    },
    colorScales: {
      type: Object as () => {
        diagonal: d3.ScaleLinear<string, string>,
        nondiagonal: d3.ScaleLinear<string, string>,
      },
    },
    hoverInfo: {
      type: Object as () => {
        classes: {
          actual: string,
          predicted: string,
        },
        classifier: string,
      },
      required: true,
    },
    onHoverChange: {
      type: Function,
      required: true,
    },
    sideLength: {
      type: Number,
      required: true,
    },
    updateMaxBucketedInstances: {
      type: Function,
      required: true,
    },
  },
  computed: {
    bucketedInstances(): Array<Set<string>> {
      const classes = this.classes;
      const bucketedInstances: Array<Set<string>> = [];
      classes.forEach((actualClass) => {
        classes.forEach((predictedClass) => {
          bucketedInstances.push(new Set());
        });
      });

      const instances = this.instances;
      instances.forEach((id) => {
        const i = instanceById(id);
        const nClasses = classes.length;
        const actualIndex = classes.indexOf(i.actual);
        const predictedIndex = classes.indexOf(i.predictions[this.classifier]);
        if (actualIndex === -1 || predictedIndex === -1) {
          return;
        }
        const bucketIndex = actualIndex * nClasses + predictedIndex;
        bucketedInstances[bucketIndex].add(id);
      });
      return bucketedInstances;
    },
    cellHeight(): number {
      const cellHeight = this.y.bandwidth();
      return cellHeight;
    },
    cellWidth(): number {
      const cellWidth = this.x.bandwidth();
      return cellWidth;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    classifier(): string {
      return [...this.boxProps.classifiers][0];
    },
    hoverInstance(): string {
      return this.$store.state.hoverInstanceId;
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    instanceSelection(): {
      include: Set<Set<string>>,
      exclude: Set<Set<string>>,
    } {
      return this.$store.state.selections.instance;
    },
    maxBucketedInstances(): {
      diagonal: number,
      nondiagonal: number,
    } {
      const bucketSizes = {
        diagonal: [] as number[],
        nondiagonal: [] as number[],
      };
      this.bucketedInstances.forEach((bucket, index) => {
        if (this.onMainDiagonal(index)) {
          bucketSizes.diagonal.push(bucket.size);
        } else {
          bucketSizes.nondiagonal.push(bucket.size);
        }
      });
      const maxBucketedInstances = {
        diagonal: Math.max(...bucketSizes.diagonal),
        nondiagonal: Math.max(...bucketSizes.nondiagonal),
      };
      this.updateMaxBucketedInstances(maxBucketedInstances);
      return maxBucketedInstances;
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
    topmostSelection(): Set<string> {
      return this.$store.state.selectionHistory[0].instances;
    },
    x(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
        .domain(this.classes)
        .range([0, this.sideLength]);
      return x;
    },
    y(): d3.ScaleBand<string> {
      const y = d3.scaleBand<string>()
        .domain(this.classes)
        .range([0, this.sideLength]);
      return y;
    },
  },
  watch: {
    bucketedInstances() {
      this.drawInitial();
    },
    overlapSelections() {
      this.drawInitial();
    },
  },
  mounted() {
    this.drawInitial();
  },
  methods: {
    cellDescription(predicted: string, actual: string) {
      return (
        (predicted === actual)
          ? `Instances of class '${actual}' correctly classified by classifier '${this.classifier}'`
          : `Instances of class '${actual}' misclassified as class '${predicted}' by classifier '${this.classifier}'`
      );
    },
    drawInitial() {

      const colorScaleDiagonal = this.colorScales.diagonal;
      const colorScaleNonDiagonal = this.colorScales.nondiagonal;

      // @ts-ignore
      d3.select(this.$refs.chart).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.chart)
        .append('svg')
          .attr('width', this.sideLength)
          .attr('height', this.sideLength);

      const applyColorScale = (size: number, index: number) => {
        return (
          this.onMainDiagonal(index)
          ? colorScaleDiagonal(size)
          : colorScaleNonDiagonal(size)
        );
      };

      const classCross: ClassCross[] = d3.cross(this.classes, this.classes);
      const cells = svg.selectAll('matrix-cell')
        .data(classCross)
        .join('g')
          .attr('class', 'matrix-cell')
          .attr('transform', (d: ClassCross) => `${this.translateCell(d)}`)
          .on('click', (d: ClassCross, i: number) => this.updateUserSelection(d, i))
          .on('mouseenter', (d: ClassCross) => this.onHoverChange(d, this.classifier));

      const cellWidth = this.cellWidth;
      const cellHeight = this.cellHeight;
      const drawMatrixCells = () => {
        cells.append('rect')
          .attr('width', cellWidth)
          .attr('height', cellHeight)
          .attr('fill', (d: ClassCross, i: number) => applyColorScale(this.bucketedInstances[i].size, i))
          .attr('stroke-width', '0.5px')
          .attr('stroke', 'black');
      };
      drawMatrixCells();

      this.drawHoverOutline();

      const drawSelection1 = () => {
        const first = this.overlapSelections.first;
        if (first === null) {
          return;
        }
        const instances = first.instances;
        cells.append('rect')
          .attr('y', cellHeight * 4 / 6)
          .attr('width', cellWidth)
          .attr('height', cellHeight / 6)
          .attr('fill', colors.overlapSelections.background)
          .html((d: ClassCross, i: number) => {
            const size = overlapCount(instances, this.bucketedInstances[i]);
            return `
              <title>
                ${size} instance(s) overlap.
              </title>
            `;
          } );
        cells.append('rect')
          .attr('y', cellHeight * 4 / 6)
          .attr('width', (d: ClassCross, i: number) =>
            cellWidth * overlapFraction(instances, this.bucketedInstances[i]))
          .attr('height', cellHeight / 6)
          .attr('fill', colors.overlapSelections.first)
          .attr('pointer-events', 'none');
      };
      drawSelection1();

      const drawSelection2 = () => {
        const second = this.overlapSelections.second;
        if (second === null) {
          return;
        }
        const instances = second.instances;
        cells.append('rect')
          .attr('y', cellHeight * 5 / 6)
          .attr('width', cellWidth)
          .attr('height', cellHeight / 6)
          .attr('fill', colors.overlapSelections.background)
          .html((d: ClassCross, i: number) => {
            const size = overlapCount(instances, this.bucketedInstances[i]);
            return `
              <title>
                ${size} instance(s) overlap.
              </title>
            `;
          } );
        cells.append('rect')
          .attr('y', cellHeight * 5 / 6)
          .attr('width', (d: ClassCross, i: number) =>
            cellWidth * overlapFraction(instances, this.bucketedInstances[i]))
          .attr('height', cellHeight / 6)
          .attr('fill', colors.overlapSelections.second)
          .attr('pointer-events', 'none');
      };
      drawSelection2();

      const drawText = () => {
        cells.append('text')
          .attr('x', cellWidth / 2)
          .attr('y', cellHeight / 2)
          .attr('dominant-baseline', 'middle')
          .attr('text-anchor', 'middle')
          .attr('font-size', 12)
          .html((d: ClassCross, i: number) => {
            const o = this.bucketedInstances[i].size;
            if (o > 0) {
              return `${o}`;
            }
            return '';
          });
      };
    },
    drawHoverOutline() {
      // console.log('drawing hover outline');
      if (
        this.hoverInfo.classes.actual === ''
        || this.hoverInfo.classes.predicted === ''
        || this.hoverInfo.classifier === ''
      ) {
        return;
      }
      const { actual, predicted } = this.hoverInfo.classes;
      // @ts-ignore
      const svg = d3.select(this.$refs.chart).select('svg');

      svg.append('rect')
        .attr('transform', this.translateCell([actual, predicted]))
        .attr('width', this.cellWidth)
        .attr('height', this.cellHeight)
        .attr('fill', 'none')
        .attr('stroke-width', '3px')
        .attr('stroke', '#FF9800')
        .attr('pointer-events', 'none');
      svg.append('text')
        .attr('x', this.x(predicted) as number + this.cellWidth / 2)
        .attr('y', this.y(actual) as number + this.cellHeight / 2)
        .attr('dominant-baseline', 'middle')
        .attr('text-anchor', 'middle')
        .attr('font-size', 12)
        .attr('pointer-events', 'none')
        .html(() => {
          const actualIndex = this.classes.indexOf(actual);
          const predictedIndex = this.classes.indexOf(predicted);
          const index = actualIndex * this.classes.length + predictedIndex;
          const o = this.bucketedInstances[index].size;
          return `${o}`;
        });
    },
    onMainDiagonal(index: number): boolean {
      const elemPerRow = this.boxProps.classes.size;
      const row = Math.floor(index / elemPerRow);
      const col = index % elemPerRow;
      return row === col;
    },
    translateCell(d: ClassCross): string {
      return `translate(${this.x(d[1])}, ${this.y(d[0])})`;
    },
    updateUserSelection(classes: ClassCross, index: number) {
      const [actual, predicted] = classes;
      console.log('user selection updated:', classes, index);
      const payload = {
        instances: this.bucketedInstances[index],
        description: this.cellDescription(predicted, actual),
      };
      this.$store.dispatch('prependToSelectionHistory', payload);
    },
  },
});
</script>

<style scoped>
.matrix-card {
  border-style: solid;
  border-color: black;
  background-color: white;
}
</style>
