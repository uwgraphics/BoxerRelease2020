<template>
  <div class="my-container">
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
            <span>Confusion Matrices</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <div style="margin: 0px 30px;">
            <v-checkbox v-model="filterDummyClassifiers" label="Oracle" value="Oracle"></v-checkbox>
            <v-checkbox v-model="filterDummyClassifiers" label="Majority Classifier" value="Majority Classifier"></v-checkbox>
            <v-checkbox v-model="filterDummyClassifiers" label="Random Classifier" value="Random Classifier"></v-checkbox>
          </div>
        </v-expansion-panel-content>
      </v-expansion-panel>
    </v-expansion-panels>
    <svg
      ref="svg"
      width="100%"
      :viewBox="`0 0 ${dimensions.total.width} ${dimensions.total.height}`"
    />
  </div>

</template>

<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';
import ColorLegend from '@/components/ColorLegend.vue';
import ConfusionMatrixMinimal from '@/components/boxes/ConfusionMatrixMinimal.vue';
import {
  BoxProps,
  EntityType,
  Instance,
  Margin,
  SelectionAction,
  SelectionRecord,
} from '../../types';
import { colors } from '../../theme';
import {
  generateRandomId,
  instanceById,
  intersection,
  overlapCount,
  overlapFraction,
  truncateLabel,
} from '../../utils';
import { PredicateSimple, Rule } from '../constraints/types';
import { blankConstraint } from '../constraints/utils';
import { scaleBand } from 'd3';

type ClassCross = [string, string];
type ClassifierClassCross = [string, string, string];

export default Vue.extend({
  name: 'ConfusionMatrixGrid',
  components: {
    ColorLegend,
    ConfusionMatrixMinimal,
  },
  data() {
    const width = 1000;
    const height = 900;
    const total = {
      width,
      height,
    };
    const predictedClassLegend = {
      xOffset: 0,
      yOffset: 0,
      width: 0.7 * width,
      height: 150,
    };
    const colorLegend = {
      xOffset: predictedClassLegend.width,
      yOffset: 0,
      width: width - predictedClassLegend.width,
      height: predictedClassLegend.height,
    };
    const actualClassLegend = {
      xOffset: 0,
      yOffset: predictedClassLegend.height,
      width: 200,
      height: height - predictedClassLegend.height,
    };
    const matrixGrid = {
      xOffset: actualClassLegend.width,
      yOffset: actualClassLegend.yOffset,
      width: width - actualClassLegend.width,
      height: actualClassLegend.height,
    };
    return {
      colors,
      dimensions: {
        actualClassLegend,
        colorLegend,
        matrixGrid,
        predictedClassLegend,
        total,
      },
      filterDummyClassifiers: [] as string[],
      hoverInfo: {
        classes: {
          actual: '',
          predicted: '',
        },
        classifier: '',
      },
      panel: [],
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
    actualClassScale(): d3.ScaleBand<string> {
      const actualClassScale = d3.scaleBand<string>()
        .domain(this.classes)
        .range([0, this.y.bandwidth()])
        .paddingInner(0);

      return actualClassScale;
    },
    allBucketedInstances(): {
      [classifierName: string]: Array<Set<string>>,
    } {
      const allBucketedInstances: {
        [classifierName: string]: Array<Set<string>>,
      } = {};

      this.classifiers.forEach((c) => {
        allBucketedInstances[c] = this.bucketedInstancesByClassifier(c);
      });

      return allBucketedInstances;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    classCross(): unknown[] {
      const classCross = d3.cross(this.classes, this.classes);
      return classCross;
    },
    classifierClassCross(): ClassifierClassCross[] {
      const f = (a: any, b: any) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
      // @ts-ignore
      const cartesian = (a: any, b: any, ...c: any[]) => (b ? cartesian(f(a, b), ...c) : a);
      const classifierClassCross = cartesian(this.classifiers, this.classes, this.classes);

      return classifierClassCross;
    },
    classifiers(): string[] {
      const classifiers = [...this.boxProps.classifiers].filter((c) => !this.filterDummyClassifiers.includes(c));
      return classifiers;
    },
    colorScales(): {
      diagonal: d3.ScaleLinear<string, string>,
      nondiagonal: d3.ScaleLinear<string, string>,
    } {
      const colorScales = {
        diagonal: d3.scaleLinear<string>()
          .domain([0, this.maxBucketedInstances.diagonal])
          .range([this.colors.goodLight, colors.goodDark]),
        nondiagonal: d3.scaleLinear<string>()
          .domain([0, this.maxBucketedInstances.nondiagonal])
          .range([this.colors.badLight, colors.badDark]),
      };
      return colorScales;
    },
    gradientId(): {
      correctlyClassified: string,
      misclassified: string,
    } {
      return {
        correctlyClassified: generateRandomId(),
        misclassified: generateRandomId(),
      };
    },
    margin(): {
      colorLegend: Margin,
      grid: Margin,
      sideBar: Margin,
      topBar: Margin,
    } {
      const grid = {
        top: 0.05 * this.dimensions.matrixGrid.height,
        right: 0.05 * this.dimensions.matrixGrid.width,
        bottom: 0.05 * this.dimensions.matrixGrid.height,
        left: 0.05 * this.dimensions.matrixGrid.width,
      };
      const colorLegend = {
        top: 0.25 * this.dimensions.colorLegend.height,
        right: 0.1 * this.dimensions.colorLegend.width,
        bottom: 0.25 * this.dimensions.colorLegend.height,
        left: 0.1 * this.dimensions.colorLegend.width,
      };
      const sideBar = {
        top: 0.2 * this.dimensions.actualClassLegend.height,
        right: 0.6 * this.dimensions.actualClassLegend.width,
        bottom: 0.1 * this.dimensions.actualClassLegend.height,
        left: 0.1 * this.dimensions.actualClassLegend.width,
      };
      const topBar = {
        top: 0.6 * this.dimensions.predictedClassLegend.height,
        right: 0.1 * this.dimensions.predictedClassLegend.width,
        bottom: 0.1 * this.dimensions.predictedClassLegend.height,
        left: 0.25 * this.dimensions.predictedClassLegend.width,
      };
      return {
        colorLegend,
        grid,
        sideBar,
        topBar,
      };
    },
    // hoverInstance(): string {
    //   return this.$store.state.hoverInstanceId;
    // },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    matricesPerRow(): number {
      const matricesPerRow = Math.ceil(Math.sqrt(this.classifiers.length));
      return matricesPerRow;
    },
    maxBucketedInstances(): {
      diagonal: number,
      nondiagonal: number,
    } {
      const maxBucketedInstances = {
        diagonal: 1,
        nondiagonal: 1,
      };
      this.classifiers.forEach((c) => {
        const classifierMax = this.maxBucketedInstancesByClassifier(c);
        maxBucketedInstances.diagonal = Math.max(
          classifierMax.diagonal,
          maxBucketedInstances.diagonal,
        );
        maxBucketedInstances.nondiagonal = Math.max(
          classifierMax.nondiagonal,
          maxBucketedInstances.nondiagonal,
        );
      });

      return maxBucketedInstances;
    },
    nRows(): number {
      const nRows = this.matricesPerRow;
      return nRows;
    },
    predictedClassScale(): d3.ScaleBand<string> {
      const predictedClassScale = d3.scaleBand<string>()
        .domain(this.classes)
        .range([0, this.x.bandwidth()])
        .paddingInner(0);

      return predictedClassScale;
    },
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    x(): d3.ScaleBand<string> {
      const margin = this.margin.grid;
      const width = this.dimensions.matrixGrid.width - margin.left - margin.right;
      const xIndices = [];
      for (let i = 0; i < this.matricesPerRow; i++) {
        xIndices.push(i.toString());
      }
      const x = d3.scaleBand()
        .domain(xIndices)
        .range([0, width])
        .paddingInner(0.2);

      return x;
    },
    y(): d3.ScaleBand<string> {
      const margin = this.margin.grid;
      const height = this.dimensions.matrixGrid.height - margin.top - margin.bottom;
      const yIndices : string[] = [];
      for (let i = 0; i < this.nRows; i++) {
        yIndices.push(i.toString());
      }
      const y = d3.scaleBand()
        .domain(yIndices)
        .range([0, height])
        .paddingInner(0.2);

      return y;
    },
  },
  watch: {
    boxProps() {
      this.drawInitial();
    },
    classifiers() {
      this.drawInitial();
    },
    // bucketedInstances() {
    //   this.drawInitial();
    // },
    hoverInfo() {
      this.drawHover();
    },
    instances() {
      this.drawInitial();
    },
    matricesPerRow() {
      this.drawGrid();
    },
    // overlapSelections() {
    //   this.drawUpdate();
    // },
    selections() {
      this.drawSelections();
    },
  },
  mounted() {
    this.drawInitial();
  },
  methods: {
    bucketedInstancesByClassifier(classifier: string): Array<Set<string>> {
      const classes = this.classes;
      const bucketedInstances: Array<Set<string>> = [];
      classes.forEach((actualClass) => {
        classes.forEach((predictedClass) => {
          bucketedInstances.push(new Set());
        });
      });

      const instances = this.instances;
      // const instances = this.instances;
      instances.forEach((id) => {
        const i = instanceById(id);
        const nClasses = classes.length;
        const actualIndex = classes.indexOf(i.actual);
        const predictedIndex = classes.indexOf(i.predictions[classifier]);
        if (actualIndex === -1 || predictedIndex === -1) {
          return;
        }
        const bucketIndex = actualIndex * nClasses + predictedIndex;
        bucketedInstances[bucketIndex].add(id);
      });
      return bucketedInstances;
    },
    cachedBucketedInstancesByClassifier(classifier: string): Array<Set<string>> {
      return this.allBucketedInstances[classifier];
    },
    cellDescription(d: ClassifierClassCross): string {
      const [classifier, actual, predicted] = d;
      return (
        (predicted === actual)
          ? `Instances of class '${actual}' correctly classified by classifier '${classifier}'`
          : `Instances of class '${actual}' misclassified as class '${predicted}' by classifier '${classifier}'`
      );
    },
    // createBoxProps(classifier: string) {
    //   // const boxProps = Object.assign({}, this.boxProps);
    //   // boxProps.classifiers = new Set([classifier]);
    //   // return boxProps;
    //   return Object.assign({}, this.boxProps, { classifiers: new Set([classifier]) });
    //   // return this.testBoxProps[classifier];
    // },
    drawInitial() {
      // @ts-ignore
      // d3.select(this.$refs.svg).selectAll('*').remove();

      this.drawColorLegend();
      this.drawSidebar();
      this.drawTopBar();
      this.drawGrid();
      this.drawSelections();
    },
    // drawUpdate() {
    //   this.updateSidebar();
    //   this.updateTopBar();
    // },
    drawColorLegend() {
      const margin = this.margin.colorLegend;
      const width = this.dimensions.colorLegend.width - margin.left - margin.right;
      const height = this.dimensions.colorLegend.height - margin.top - margin.bottom;

      // @ts-ignore
      const svg = d3.select(this.$refs.svg);

      interface GradientData {
        id: string;
        colorDark: string;
        colorLight: string;
      }
      const gradientsData: GradientData[] = [
        {
          id: this.gradientId.misclassified,
          colorDark: colors.badDark,
          colorLight: colors.badLight,
        },
        {
          id: this.gradientId.correctlyClassified,
          colorDark: colors.goodDark,
          colorLight: colors.goodLight,
        },
      ];

      const defineGradients = () => {
        svg.selectAll('.color-legend-defs').remove();
        const defs = svg.append('defs')
          .attr('class', 'color-legend-defs');

        const gradients = defs.selectAll('linearGradient')
          .data(gradientsData)
          .join('linearGradient')
            .attr('id', (d: GradientData) => d.id)
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');
        gradients.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', (d: GradientData) => d.colorLight)
          .attr('stop-opacity', 1);
        gradients.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', (d: GradientData) => d.colorDark)
          .attr('stop-opacity', 1);
      };
      defineGradients();

      svg.selectAll('.color-legend').remove();
      const legend = svg.append('g')
        .attr('class', 'color-legend')
        .attr('transform', `translate(
          ${this.dimensions.colorLegend.xOffset + margin.left},
          ${this.dimensions.colorLegend.yOffset + margin.top})`);

      const drawBackgroundRect = () => {
        svg.append('rect')
          .attr('x', this.dimensions.colorLegend.xOffset)
          .attr('y', this.dimensions.colorLegend.yOffset)
          .attr('width', this.dimensions.colorLegend.width)
          .attr('height', this.dimensions.colorLegend.height)
          .attr('fill', 'cyan')
          .attr('fill-opacity', 0.2);
      };
      // drawBackgroundRect();

      const drawGradients = () => {
        const gradientRects = legend.selectAll('rect')
          .data(gradientsData)
          .join('rect')
            .attr('y', (d: GradientData, i: number) => i * height / 2)
            .attr('width', width)
            .attr('height', height / 2)
            .attr('stroke', 'black')
            .attr('stroke-width', '0.5px')
            .style('fill', (d: GradientData) => `url(#${d.id})`);
      };
      drawGradients();

      const drawAxis = () => {
        const agreeAxis = d3.scaleLinear<number, number>()
          .domain([0, this.maxBucketedInstances.diagonal])
          .range([0, width]);

        legend.append('g')
          .call(d3.axisTop(agreeAxis).ticks(3))
          .attr('font-size', 16);

        const disagreeAxis = d3.scaleLinear<number, number>()
          .domain([0, this.maxBucketedInstances.nondiagonal])
          .range([0, width]);

        legend.append('g')
          .attr('transform', `translate(0 ${height})`)
          .call(d3.axisBottom(disagreeAxis).ticks(3))
          .attr('font-size', 16);
      };
      drawAxis();

      const drawTitles = () => {
        legend.append('text')
          .attr(
            'transform',
            `translate(
              ${width / 2},
              ${height / 4}
            )`,
          )
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .style('font-size', 16)
          .text('misclassified');

        legend.append('text')
          .attr(
            'transform',
            `translate(
              ${width / 2},
              ${height * 3 / 4}
            )`,
          )
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .style('font-size', 16)
          .text('correctly classified');
      };
      drawTitles();
      return;
    },
    drawHover() {
      return;
      const moveDuration = 500;
      const resetDuration = 1000;

      const classifierClassCross = this.classifierClassCross;

      // @ts-ignore
      const svg = d3.select(this.$refs.svg);

      const matrixCellRects = svg.selectAll('.matrix-cell-rect');
      const actualClassLegendRects = svg.select('.actual-class-legend').selectAll('.hover-indicator-rect');
      const predictedClassLegendRects = svg.select('.predicted-class-legend').selectAll('.hover-indicator-rect');
      if (
        this.hoverInfo.classes.actual === ''
        || this.hoverInfo.classes.predicted === ''
        || this.hoverInfo.classifier === ''
      ) {
        matrixCellRects
          .transition().duration(resetDuration)
          .attr('fill-opacity', 1);
        actualClassLegendRects
          .transition().duration(resetDuration)
          .attr('fill', 'lightgray');
        predictedClassLegendRects
          .transition().duration(resetDuration)
          .attr('fill', 'lightgray');
      } else {
        matrixCellRects
          .data(classifierClassCross)
          .transition().duration(moveDuration)
          .attr('fill-opacity', (d: ClassifierClassCross) => {
            const [classifier, actual, predicted] = d;
            if (actual === this.hoverInfo.classes.actual && predicted === this.hoverInfo.classes.predicted) {
              return 1;
            }
            return 0.25;
          });

        actualClassLegendRects
          .data(this.classes)
          .transition().duration(moveDuration)
          .attr('fill', (d: string) =>
            (this.hoverInfo.classes.actual === d)
              ? 'black'
              : 'lightgray',
          );
        predictedClassLegendRects
          .data(this.classes)
          .transition().duration(moveDuration)
          .attr('fill', (d: string) =>
            (this.hoverInfo.classes.predicted === d)
              ? 'black'
              : 'lightgray',
          );
      }
    },
    drawHoverExternal() {
      // const hoverDots = svg.selectAll('.hover-dot');

      // hoverDots
      //   .transition().duration(resetDuration)
      //   .attr('fill-opacity', 0);

      // hoverDots
      //   .data(classifierClassCross)
      //   .transition().duration(moveDuration)
      //   .attr('fill-opacity', (d: ClassifierClassCross) => {
      //     const [classifier, actual, predicted] = d;
      //     if (actual === this.hoverInfo.classes.actual && predicted === this.hoverInfo.classes.predicted) {
      //       return 1;
      //     }
      //     return 0;
      //   });
    },
    drawGrid() {
      const margin = this.margin.grid;

      const classes = this.classes;
      const classifiers = this.classifiers;
      const instances = this.instances;

      // @ts-ignore
      const svg = d3.select(this.$refs.svg);
      svg.selectAll('.matrix-grid').remove();
      const matrixGrid = svg.append('g')
        .attr('class', 'matrix-grid')
        .attr('transform', `translate(
          ${this.dimensions.matrixGrid.xOffset + margin.left},
          ${this.dimensions.matrixGrid.yOffset + margin.top})`)
        .on('mouseleave', () => this.updateHoverCell(['', '', '']));

      const drawBackgroundRect = () => {
        svg.append('rect')
          .attr('x', this.dimensions.matrixGrid.xOffset)
          .attr('y', this.dimensions.matrixGrid.yOffset)
          .attr('width', this.dimensions.matrixGrid.width)
          .attr('height', this.dimensions.matrixGrid.height)
          .attr('fill', 'black')
          .attr('fill-opacity', 0.1);
      };
      // drawBackgroundRect();

      const x = this.x;
      const y = this.y;

      const rowIndex = (i: number) => Math.floor(i / this.matricesPerRow);
      const colIndex = (i: number) => i % this.matricesPerRow;

      const matrices = matrixGrid.selectAll('.matrix')
        .data(classifiers)
        .join('g')
          .attr('class', 'matrix')
          .attr('transform', (d: string, i: number) => `translate(
            ${x(colIndex(i).toString())},
            ${y(rowIndex(i).toString())}
          )`);

      matrices.append('rect')
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .attr('fill', 'black')
        .attr('stroke', 'black');

      const actualClassScale = this.actualClassScale;
      const predictedClassScale = this.predictedClassScale;

      const classCross = this.classCross;
      matrices.selectAll('.matrix-cell')
        .data(classCross)
        .join('g')
          .attr('class', 'matrix-cell')
          .attr('transform', (d: ClassCross) => `translate(
            ${predictedClassScale(d[1])},
            ${actualClassScale(d[0])}
          )`);

      const classifierClassCross = this.classifierClassCross;

      const matrixCells = matrixGrid.selectAll('.matrix-cell')
        .data(classifierClassCross)
        .on('mouseenter', (d: ClassifierClassCross) => this.updateHoverCell(d))
        .on('click', (d: ClassifierClassCross) => this.select(d, 'first'))
        .on('contextmenu', (d: ClassifierClassCross) => this.select(d, 'second'));

      const drawCells = () => {
        const cellWidth = predictedClassScale.bandwidth();
        const cellHeight = actualClassScale.bandwidth();
        matrixCells.append('rect')
          .attr('class', 'matrix-cell-rect')
          .attr('width', cellWidth)
          .attr('height', cellHeight * 6 / 8)
          .attr('fill', (d: ClassifierClassCross) => {
            let color = '';
            const [classifier, actual, predicted] = d;
            const actualIndex = classes.indexOf(actual);
            const predictedIndex = classes.indexOf(predicted);
            const bucketIndex = actualIndex * classes.length + predictedIndex;
            const numberOfInstances = this.cachedBucketedInstancesByClassifier(classifier)[bucketIndex].size;
            if (numberOfInstances === 0) {
              return 'white';
            }
            if (actual === predicted) {
              color = this.colorScales.diagonal(numberOfInstances);
            } else {
              color = this.colorScales.nondiagonal(numberOfInstances);
            }
            return color;
          })
          .style('paint-order', 'stroke');

        const selections = () => {
          const selectionBarHeight = actualClassScale.bandwidth() / 8;
          const dotRadius = selectionBarHeight / 3;
          matrixCells.append('rect')
            .attr('class', 'selection-background-rect')
            .attr('y', cellHeight * 6 / 8)
            .attr('width', cellWidth)
            .attr('height', selectionBarHeight * 2)
            .attr('fill', 'black');
          matrixCells.append('rect')
            .attr('class', 'bar-selection-1')
            .attr('y', cellHeight * 6 / 8)
            .attr('width', 0)
            .attr('height', cellHeight / 8)
            .attr('fill', colors.overlapSelections.first)
            .attr('stroke', 'black');
          matrixCells.append('circle')
            .attr('class', 'dot-selection-1')
            .attr('cx', cellWidth / 2)
            .attr('cy', cellHeight * 6 / 8 + cellHeight / 16)
            .attr('r', dotRadius)
            .attr('fill', colors.overlapSelections.first)
            .attr('fill-opacity', 0);
          matrixCells.append('rect')
            .attr('class', 'bar-selection-2')
            .attr('y', cellHeight * 7 / 8)
            .attr('width', 0)
            .attr('height', cellHeight / 8)
            .attr('fill', colors.overlapSelections.second)
            .attr('stroke', 'black');
          matrixCells.append('circle')
            .attr('class', 'dot-selection-2')
            .attr('cx', cellWidth / 2)
            .attr('cy', cellHeight * 7 / 8 + cellHeight / 16)
            .attr('r', dotRadius)
            .attr('fill', colors.overlapSelections.second)
            .attr('fill-opacity', 0);
        };
        selections();
      };
      drawCells();

      const drawMatrixTitles = () => {
        matrices.data(this.classifiers)
          .append('text')
          .attr('transform', () => {
            const xOffset = x.bandwidth() / 2;
            const yOffset = -10;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text((d: string) => d);
      };
      drawMatrixTitles();

      const hoverCircles = () => {
        matrixCells.append('circle')
          .attr('class', 'hover-dot')
          .attr('cx', predictedClassScale.bandwidth() / 2)
          .attr('cy', actualClassScale.bandwidth() / 2)
          .attr('r', Math.min(predictedClassScale.bandwidth(), actualClassScale.bandwidth()) / 6)
          .attr('fill', 'black')
          .attr('fill-opacity', 0);
      };
      hoverCircles();
    },
    drawSelections() {
      console.log('drawing selections');

      const classifierClassCross = this.classifierClassCross;

      // @ts-ignore
      const svg = d3.select(this.$refs.svg);

      const barSelection1 = svg.selectAll('.bar-selection-1');
      const barSelection2 = svg.selectAll('.bar-selection-2');
      const dotSelection1 = svg.selectAll('.dot-selection-1');
      const dotSelection2 = svg.selectAll('.dot-selection-2');

      const { first, second } = this.selections;

      const cellWidth = this.predictedClassScale.bandwidth();
      const cellHeight = this.actualClassScale.bandwidth();

      const dotThreshold = 0.2;

      const selectionWidth = (d: ClassifierClassCross, selection: SelectionRecord) => {
        const instances = this.instancesByCross(d);
        const overlappingInstances = intersection(instances, selection.instances);
        const fractionOfTotalInstances = overlappingInstances.size / instances.size;
        return (
          (fractionOfTotalInstances < dotThreshold)
          ? 0
          : fractionOfTotalInstances * cellWidth
        );
      };

      const dotOpacity = (d: ClassifierClassCross, selection: SelectionRecord) => {
        const instances = this.instancesByCross(d);
        const overlappingInstances = intersection(instances, selection.instances);
        const fractionOfTotalInstances = overlappingInstances.size / instances.size;
        return (
          (fractionOfTotalInstances > 0 && fractionOfTotalInstances < dotThreshold)
          ? 1
          : 0
        );
      };

      if (!first) {
        barSelection1.attr('width', 0);
        dotSelection1.attr('fill-opacity', 0);
      } else {
        barSelection1
          .data(this.classifierClassCross)
          .attr('width', (d: ClassifierClassCross) => selectionWidth(d, first));
        dotSelection1
          .data(this.classifierClassCross)
          .attr('fill-opacity', (d: ClassifierClassCross) => dotOpacity(d, first));
      }

      if (!second) {
        barSelection2.attr('width', 0);
        dotSelection2.attr('fill-opacity', 0);
      } else {
        barSelection2
          .data(this.classifierClassCross)
          .attr('width', (d: ClassifierClassCross) => selectionWidth(d, second));
        dotSelection2
          .data(this.classifierClassCross)
          .attr('fill-opacity', (d: ClassifierClassCross) => dotOpacity(d, second));
      }
    },
    drawSidebar() {
      const margin = this.margin.sideBar;
      const width = this.dimensions.actualClassLegend.width - margin.left - margin.right;
      const height = this.dimensions.actualClassLegend.height - margin.top - margin.bottom;

      const classes = this.classes;

      const y = d3.scaleBand()
        .domain(classes)
        .range([0, height])
        .paddingInner(0.2);

      // @ts-ignore
      const svg = d3.select(this.$refs.svg);
      svg.selectAll('.actual-class-legend').remove();
      const legend = svg.append('g')
        .attr('class', 'actual-class-legend')
        .attr('transform', `translate(
          ${this.dimensions.actualClassLegend.xOffset + margin.left},
          ${this.dimensions.actualClassLegend.yOffset + margin.top})`);

      const drawBackgroundRect = () => {
        svg.append('rect')
          .attr('x', this.dimensions.actualClassLegend.xOffset)
          .attr('y', this.dimensions.actualClassLegend.yOffset)
          .attr('width', this.dimensions.actualClassLegend.width)
          .attr('height', this.dimensions.actualClassLegend.height)
          .attr('fill', 'coral')
          .attr('fill-opacity', 0.2);
      };
      // drawBackgroundRect();

      const entries = legend.selectAll('legend-entry')
        .data(classes)
        .join('g')
          .attr('class', 'legend-entry')
          .attr('transform', (d: string, i: number) => `translate(0, ${y(d)})`);

      entries.append('rect')
        .attr('class', 'hover-indicator-rect')
        .attr('width', width)
        .attr('height', y.bandwidth())
        .attr('fill', (d: string) => (this.hoverInfo.classes.actual === d) ? 'orange' : 'lightgray');

      legend.append('g')
        .attr('class', 'side-axis')
        .attr('transform', `translate(${width}, ${0})`)
        .call(d3.axisRight(y))
        .selectAll('text')
          .style('text-anchor', 'start')
          .style('font-size', 14);

      legend.selectAll('.side-axis').select('.domain').attr('stroke-opacity', '0');

      const drawTitle = () => {
        legend.append('text')
          .attr('transform', `translate(${0}, ${-margin.top / 2})`)
          .attr('text-anchor', 'start')
          .attr('alignment-baseline', 'middle')
          .style('font-size', 20)
          .text('Actual class');
      };
      drawTitle();
    },
    drawTopBar() {
      const margin = this.margin.topBar;
      const width = this.dimensions.predictedClassLegend.width - margin.left - margin.right;
      const height = this.dimensions.predictedClassLegend.height - margin.top - margin.bottom;

      const classes = this.classes;

      const x = d3.scaleBand()
        .domain(classes)
        .range([0, width])
        .paddingInner(0.2);

      // @ts-ignore
      const svg = d3.select(this.$refs.svg);
      svg.selectAll('.predicted-class-legend').remove();
      const legend = svg.append('g')
        .attr('class', 'predicted-class-legend')
        .attr('transform', `translate(
          ${this.dimensions.predictedClassLegend.xOffset + margin.left},
          ${this.dimensions.predictedClassLegend.yOffset + margin.top})`);

      const drawBackgroundRect = () => {
        svg.append('rect')
          .attr('x', this.dimensions.predictedClassLegend.xOffset)
          .attr('y', this.dimensions.predictedClassLegend.yOffset)
          .attr('width', this.dimensions.predictedClassLegend.width)
          .attr('height', this.dimensions.predictedClassLegend.height)
          .attr('fill', 'green')
          .attr('fill-opacity', 0.2);
      };
      // drawBackgroundRect();

      const entries = legend.selectAll('legend-entry')
        .data(classes)
        .join('g')
          .attr('class', 'legend-entry')
          .attr('transform', (d: string, i: number) => `translate(${x(d)}, 0)`);

      entries.append('rect')
        .attr('class', 'hover-indicator-rect')
        .attr('width', x.bandwidth())
        .attr('height', height)
        .attr('fill', (d: string) => (this.hoverInfo.classes.predicted === d) ? 'orange' : 'lightgray');

      legend.append('g')
        .attr('class', 'top-axis')
        .call(d3.axisTop(x))
        .selectAll('text')
          .attr('x', '0.7em')
          .attr('y', '-0.7em')
          .attr('transform', 'rotate(-30)')
          .style('text-anchor', 'start')
          .style('font-size', 14);

      legend.selectAll('.top-axis').select('.domain').attr('stroke-opacity', '0');

      const drawTitle = () => {
        legend.append('text')
          .attr('transform', `translate(${-margin.left / 2}, ${height / 2})`)
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .style('font-size', 20)
          .text('Predicted class');
      };
      drawTitle();
    },
    instancesByCross(d: ClassifierClassCross) {
      const [classifier, actual, predicted] = d;
      const classes = this.classes;
      const actualIndex = classes.indexOf(actual);
      const predictedIndex = classes.indexOf(predicted);
      const bucketIndex = actualIndex * classes.length + predictedIndex;
      const instances = this.cachedBucketedInstancesByClassifier(classifier)[bucketIndex];
      return instances;
    },
    maxBucketedInstancesByClassifier(classifier: string): {
      diagonal: number,
      nondiagonal: number,
    } {
      const bucketSizes = {
        diagonal: [] as number[],
        nondiagonal: [] as number[],
      };
      this.cachedBucketedInstancesByClassifier(classifier).forEach((bucket, index) => {
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
      return maxBucketedInstances;
    },
    onMainDiagonal(index: number): boolean {
      const elemPerRow = this.boxProps.classes.size;
      const row = Math.floor(index / elemPerRow);
      const col = index % elemPerRow;
      return row === col;
    },
    select(
      d: ClassifierClassCross,
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const [classifier, actual, predicted] = d;
      const classes = this.classes;
      const actualIndex = classes.indexOf(actual);
      const predictedIndex = classes.indexOf(predicted);
      const bucketIndex = actualIndex * classes.length + predictedIndex;

      const constraintRow = blankConstraint();
      constraintRow.rule = Rule.ACTUAL;
      constraintRow.target = actual;

      const constraintColumn = blankConstraint();
      constraintColumn.rule = Rule.PREDICTED;
      constraintColumn.classifier = classifier;
      constraintColumn.target = predicted;

      const instances = this.cachedBucketedInstancesByClassifier(classifier)[bucketIndex];
      const description = this.cellDescription(d);

      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraintRow, constraintColumn],
        metric: []
      };
      const payload = {
        description,
        instances,
        predicate,
      };

      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('setToMostRecentSelection', whichOverlap);
    },
    
    // truncateLabel,
    updateHoverCell(d: [string, string, string]) {
      const [classifier, actual, predicted] = d;
      if (
        this.hoverInfo.classes.actual === actual
        && this.hoverInfo.classes.predicted === predicted
        && this.hoverInfo.classifier === classifier
      ) {
        return;
      }
      this.hoverInfo = {
        classes: {
          actual,
          predicted,
        },
        classifier,
      };
    },
    
  },
});
</script>

<style scoped>
.my-container {
  background-color: white
}

</style>
