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
            <span>Performance (Overall)</span>
          </div>
        </v-expansion-panel-header>
        <v-expansion-panel-content>
          <div style="margin: 0px 30px;">
          <v-radio-group v-model="accuracySorting" label="Sort by accuracy">
            <v-radio label="ascending" value="ascending"></v-radio>
            <v-radio label="descending" value="descending"></v-radio>
            <v-radio label="alphabetical" value="alphabetical"></v-radio>
            <v-radio label="none" value=""></v-radio>
          </v-radio-group>
        </div>
        <div style="margin: 0px 30px;">
          <v-radio-group v-model="evaluationSelection" label="Evaluation method">
            <v-radio label="accuracy" value="accuracy"></v-radio>
            <v-radio id="mcc" label="mcc" value="mcc"></v-radio>
            <v-radio v-if="classNumber > 2"
            label="microf1" value="microf1"></v-radio>
            <v-radio v-if="classNumber > 2"
            label="macrof1" value="macrof1"></v-radio>
            <v-radio v-if="classNumber <= 2"
            label="f1" value="f1"></v-radio>
            <v-radio v-if="classNumber <= 2"
            label="precision" value="precision"></v-radio>
            <v-radio v-if="classNumber <= 2"
            label="recall" value="recall"></v-radio>
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
  name: 'Performance_Overall',
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
    const accuracySorting = '' as 'ascending' | 'descending' | '' | 'alphabetical';
    const evaluationSelection = 'accuracy' as 'mcc'| 'f1' | 'precision'| 'recall'| 'microf1' | 'macrof1'| 'accuracy'
    const hover = {
      type: '' as 'right' | 'wrong' | '',
      classifier: '',
    };
    return {
      accuracySorting,
      evaluationSelection,
      height,
      hover,
      margin,
      panel: [],
      rightColor: '#d1e5f0',
      rightHoverColor: '#4393c3',
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      width,
      wrongColor: '#fddbc7',
      wrongHoverColor: '#d6604d',
      classNumber:[...this.boxProps.classes].length,
    };
  },
  computed: {
    classes(): string[] {
      this.classNumber = [...this.boxProps.classes].length
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
    externalHoverInstance(): string {
      return this.$store.state.hoverInstance;
    },
    features(): string[] {
      return [...this.boxProps.features];
    },
    instances(): string[] {
      return [...this.boxProps.instances];
    },
    predictionKeys(): string[] {

      var scope = this.evaluationKeys
      
      const accuracyAscending = (c1: string, c2: string) => {
        if (scope == "f1") {
          return this.predictions[c1].f1 - this.predictions[c2].f1;
        } else if (scope == "macrof1") {
          return this.predictions[c1].macro_f1 - this.predictions[c2].macro_f1;
        } else if (scope == "microf1") {
          return this.predictions[c1].micro_f1 - this.predictions[c2].micro_f1;
        } else if (scope == "mcc") {
          return this.predictions[c1].mcc - this.predictions[c2].mcc;
        } else if (scope == "precision") {
          return this.predictions[c1].precision - this.predictions[c2].precision;
        } else if (scope == "recall") {
          return this.predictions[c1].recall - this.predictions[c2].recall;
        }
        return this.predictions[c1].right.size - this.predictions[c2].right.size;
      };
      const accuracyDescending = (c1: string, c2: string) => {
        return -accuracyAscending(c1, c2);
      };

      const predictionKeys = this.classifiers.slice();
      switch (this.accuracySorting) {
        case 'ascending':
          predictionKeys.sort(accuracyAscending);
          break;
        case 'descending':
          predictionKeys.sort(accuracyDescending);
          break;
        case 'alphabetical':
          predictionKeys.sort();
          break;
      }

      return predictionKeys;
    },
    evaluationKeys() : String {
      var evaluationKeys = ""
      switch (this.evaluationSelection) {
        case 'accuracy' :
          evaluationKeys = "accuracy"
          break;
        case 'f1' :
          evaluationKeys = "f1"
          break; 
        case 'microf1' :
          evaluationKeys = "microf1"  
          break;
        case 'macrof1' :
          evaluationKeys = "macrof1"
          break;
        case 'mcc' :
          evaluationKeys = "mcc"
          break;
        case 'precision' :
          evaluationKeys = "precision"
          break;
        case 'recall' :
          evaluationKeys = "recall"
          break;      
      }
      return evaluationKeys;
    },
    predictions(): {
      [classifier: string]: {
        right: Set<string>,
        wrong: Set<string>,
        fp: Set<String>,
        fn: Set<String>,
        tp: Set<String>,
        tn : Set<String>,
        f1: number, 
        micro_f1: number,
        macro_f1:number,
        mcc: number,
        precision: number,
        recall: number,
        accuracy:number,
      },
    } {
      const predictions: {
        [classifier: string]: {
          right: Set<string>,
          wrong: Set<string>,
          fp: Set<String>,
          fn: Set<String>,
          tp: Set<String>,
          tn : Set<String>,
          f1: number, 
          micro_f1: number,
          macro_f1:number,
          mcc: number,
          precision: number,
          recall: number,
          accuracy:number,
        },
      } = {};

      this.classifiers.forEach((c) => {
        predictions[c] = {
          right: new Set(),
          wrong: new Set(),
          fp: new Set(),
          fn: new Set(),
          tp: new Set(),
          tn: new Set(),
          f1: 0,
          micro_f1: 0,
          macro_f1:0,
          mcc: 0,
          precision: 0,
          recall: 0,
          accuracy:0,
        };
      });

      // get the tp fp fn per classifier per class
      var total_data = {}
      this.classifiers.forEach((c) =>{
        total_data[c] = {}
        this.classes.forEach((d)=>{
          total_data[c][d] = {"right":[],"wrong":[],"tp":[],"fp":[],"fn":[],"tn":[],"pred":[],"actual":[]}
        })
      })
      this.instances.forEach((id)=>{
        var i  = instanceById(id)
        this.classifiers.forEach((c) => {
          var curAcClass = i.actual;
          var curPredClass = i.predictions[c]
          var curClassifier = c;
          total_data[curClassifier][curPredClass].pred.push(id);
          total_data[curClassifier][curAcClass].actual.push(id);

          if (i.predictions[c] == i.actual) {
            total_data[c][curAcClass].right.push(id);
            total_data[curClassifier][curAcClass].tp.push(id);
            this.classes.forEach((j)=>{
              if (j != curPredClass){
                total_data[curClassifier][j].tn.push(id)
              } 
            })
          } else {
            total_data[c][curAcClass].wrong.push(id);
            total_data[c][curPredClass].fp.push(id)
            total_data[curClassifier][curAcClass].fn.push(id);
          }
        });
      })
      //get the tp. fp fn for binary classification problem 
      const instances_num = this.instances.length;
      this.instances.forEach((id) => {
        const i = instanceById(id);
        this.classifiers.forEach((c) => {
          if (i.predictions[c] === i.actual) {
            predictions[c].right.add(id);
          } else {
            predictions[c].wrong.add(id);
          }
          if (i.actual == this.classes[1]) {
              if (i.predictions[c] == i.actual) {
                predictions[c].tp.add(id);
              } else {
                predictions[c].fn.add(id);
              }
            } else {
              if (i.predictions[c] == i.actual) {
                predictions[c].tn.add(id);
              } else {
                predictions[c].fp.add(id);
              }
            }
        })
      })

      //calculate the value of each evaluation
      this.classifiers.forEach((c)=>{
        var tp = predictions[c].tp.size
        var fp = predictions[c].fp.size
        var fn = predictions[c].fn.size
        var tn = predictions[c].tn.size
        predictions[c].precision = tp / (tp + fp);
        predictions[c].recall = tp /  (tp + fn);
        predictions[c].accuracy = predictions[c].right.size / (predictions[c].right.size + predictions[c].wrong.size)
        predictions[c].f1 = 2 *  predictions[c].precision *  predictions[c].recall / ( predictions[c].precision +  predictions[c].recall)
        if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
          predictions[c].mcc = ((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn)))
        } else {
          predictions[c].mcc = 0
        }
      })

      if (this.classes.length > 2) {
        this.classifiers.forEach((c)=>{
            var total_tp = 0
            var total_fp = 0
            var total_tn = 0
            var total_fn = 0

            var total_f1 = 0
            this.classes.forEach((j)=>{
              var cur_tp = total_data[c][j].tp.length
              var cur_fp = total_data[c][j].fp.length
              var cur_tn = total_data[c][j].tn.length
              var cur_fn = total_data[c][j].fn.length

              total_tp +=  cur_tp
              total_fp += cur_fp
              total_tn +=  cur_tn
              total_fn += cur_fn

              var cur_pre = cur_tp / (cur_tp + cur_fp )
              var cur_recall = cur_tp / (cur_tp + cur_fn )
              total_f1 += ((cur_pre + cur_recall) == 0)? 0 : 2 * cur_pre * cur_recall / (cur_pre + cur_recall)
            })
            predictions[c].micro_f1 = total_f1 / this.classes.length
            var total_recall= total_tp / (total_tp + total_fn)
            var total_pre= total_tp / (total_tp + total_fp )
            predictions[c].macro_f1 = (total_recall + total_pre ) == 0? 0 : total_recall * total_pre * 2 / (total_recall + total_pre )
            if ((total_tp+total_fp)*(total_tp+total_fn)*(total_tn+total_fp)*(total_tn+total_fn) != 0) {
              predictions[c].mcc = ((total_tp*total_tn-total_fp*total_fn) / Math.sqrt((total_tp+total_fp)*(total_tp+total_fn)*(total_tn+total_fp)*(total_tn+total_fn)))
            } else {
              predictions[c].mcc = 0
            }
        })
      }
      return predictions;
    },

    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    x(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
        .domain(this.predictionKeys)
        .range([0, this.width])
        .paddingOuter(1)
        .paddingInner(0.3);
      return x;
    },
    y(): d3.ScaleLinear<number, number> {
      const y = d3.scaleLinear()
        .domain([this.evaluationKeys == "mcc"? -1 : 0, 1])
        .range([this.height, 0]);
      return y;
    },
  },
  watch: {
    accuracySorting() {
      this.drawInitial();
    },
    evaluationSelection() {
      this.drawInitial();
    },
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
      this.hover = ({type: '', classifier: ''});
    },
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const rightBars = chart.selectAll('.bar-right');
      const wrongBars = chart.selectAll('.bar-wrong');
      const yAxisMarkerLine = chart.select('.y-axis-marker-line');
      const yAxisMarkerTextRight = chart.select('.y-axis-marker-text-right');
      const yAxisMarkerTextWrong = chart.select('.y-axis-marker-text-wrong');
      const { first, second } = this.selections;
      const textRightSelection1 = chart.selectAll('.text-right-selection-1').attr("visibility","hidden");
      const textRightSelection2 = chart.selectAll('.text-right-selection-2').attr("visibility","hidden");
      const textWrongSelection1 = chart.selectAll('.text-wrong-selection-1').attr("visibility","hidden");
      const textWrongSelection2 = chart.selectAll('.text-wrong-selection-2').attr("visibility","hidden");

      if (!first || this.evaluationKeys == "mcc" || this.evaluationKeys == "microf1" || this.evaluationKeys == "macrof1"|| this.evaluationKeys == "f1") {
        textRightSelection1.attr("visibility","hidden")
        textWrongSelection1.attr("visibility","hidden")
      }  else {
        if (this.hover.type === 'right')
          textRightSelection1.data(this.predictionKeys).attr("visibility", (d: string) =>
              d === this.hover.classifier
                ? "visible":"hidden");
        if (this.hover.type === 'wrong')        
          textWrongSelection1.attr("visibility", (d: string) =>
            d === this.hover.classifier
              ? "visible":"hidden");
      } 
      if (!second|| this.evaluationKeys == "mcc" || this.evaluationKeys == "microf1" || this.evaluationKeys == "macrof1"|| this.evaluationKeys == "f1") {
        textRightSelection2.attr("visibility","hidden")
        textWrongSelection2.attr("visibility","hidden")
      } else {
        if (this.hover.type === 'right')
          textRightSelection2.data(this.predictionKeys).attr("visibility", (d: string) =>
              d === this.hover.classifier
                ? "visible":"hidden");
        if (this.hover.type === 'wrong')                  
          textWrongSelection2.attr("visibility", (d: string) =>
            d === this.hover.classifier
              ? "visible":"hidden");
      }
      if (this.hover.type === 'right') {
        rightBars.data(this.predictionKeys)
          .attr('fill', (d: string) =>
            d === this.hover.classifier
              ? this.rightHoverColor
              : this.rightColor);
      } else {
        rightBars.attr('fill', this.rightColor);
      }

      if (this.hover.type === 'wrong') {
        wrongBars.data(this.predictionKeys)
          .attr('fill', (d: string) =>
            d === this.hover.classifier
              ? this.wrongHoverColor
              : this.wrongColor);
      } else {
        wrongBars.attr('fill', this.wrongColor);
      }

      const moveDuration = 500;
      const disappearDuration = 1000;
      if (this.hover.type) {
        yAxisMarkerLine
          .transition()
          .duration(moveDuration)
          .attr('stroke-opacity', 1)
          .attr('y1', this.evaluationKeys == "f1" ? this.y(this.predictions[this.hover.classifier].f1) 
                                                :this.evaluationKeys == "precision" ? this.y(this.predictions[this.hover.classifier].precision) 
                                                :this.evaluationKeys == "recall" ? this.y(this.predictions[this.hover.classifier].recall) 
                                                :this.evaluationKeys == "microf1" ? this.y(this.predictions[this.hover.classifier].micro_f1) 
                                                :this.evaluationKeys == "macrof1" ? this.y(this.predictions[this.hover.classifier].macro_f1) 
                                                :this.evaluationKeys == "mcc" ? this.y(this.predictions[this.hover.classifier].mcc) 
                                                : this.y(this.predictions[this.hover.classifier].right.size / this.instances.length))
          .attr('x2', this.width)
          .attr('y2', this.evaluationKeys == "f1" ? this.y(this.predictions[this.hover.classifier].f1) 
                                                :this.evaluationKeys == "precision" ? this.y(this.predictions[this.hover.classifier].precision) 
                                                :this.evaluationKeys == "recall" ? this.y(this.predictions[this.hover.classifier].recall) 
                                                :this.evaluationKeys == "microf1" ? this.y(this.predictions[this.hover.classifier].micro_f1) 
                                                :this.evaluationKeys == "macrof1" ? this.y(this.predictions[this.hover.classifier].macro_f1) 
                                                :this.evaluationKeys == "mcc" ? this.y(this.predictions[this.hover.classifier].mcc) 
                                                : this.y(this.predictions[this.hover.classifier].right.size / this.instances.length));
        yAxisMarkerTextRight
          .transition()
          .duration(moveDuration)
          .attr('fill-opacity', 1)
          .attr('transform', this.evaluationKeys == "f1"?  
            `translate(
            ${this.x.paddingOuter() * this.x.bandwidth() / 2},
            ${this.y(this.predictions[this.hover.classifier].f1) + 10})`
            :this.evaluationKeys == "precision"?  
            `translate(
            ${this.x.paddingOuter() * this.x.bandwidth() / 2},
            ${this.y(this.predictions[this.hover.classifier].precision) + 10})`
            :this.evaluationKeys == "recall"?  
            `translate(
            ${this.x.paddingOuter() * this.x.bandwidth() / 2},
            ${this.y(this.predictions[this.hover.classifier].recall) + 10})`
            :this.evaluationKeys == "microf1"?  
            `translate(
            ${this.x.paddingOuter() * this.x.bandwidth() / 2},
            ${this.y(this.predictions[this.hover.classifier].micro_f1) + 10})`
            :this.evaluationKeys == "macrof1"?  
            `translate(
            ${this.x.paddingOuter() * this.x.bandwidth() / 2},
            ${this.y(this.predictions[this.hover.classifier].macro_f1) + 10})`
            :this.evaluationKeys == "mcc"?  
            `translate(
            ${this.x.paddingOuter() * this.x.bandwidth() / 2},
            ${this.y(this.predictions[this.hover.classifier].mcc) + 10})`
            : `translate(
            ${this.x.paddingOuter() * this.x.bandwidth() / 2},
            ${this.y(this.predictions[this.hover.classifier].right.size / this.instances.length) + 10})`)
          .text(this.evaluationKeys == "f1"? `${(this.predictions[this.hover.classifier].f1 * 100).toFixed(1)}%`
                :this.evaluationKeys == "precision"? `${(this.predictions[this.hover.classifier].precision * 100).toFixed(1)}%`
                :this.evaluationKeys == "recall"? `${(this.predictions[this.hover.classifier].recall * 100).toFixed(1)}%`
                :this.evaluationKeys == "microf1"? `${(this.predictions[this.hover.classifier].micro_f1 * 100).toFixed(1)}%`
                :this.evaluationKeys == "macrof1"? `${(this.predictions[this.hover.classifier].macro_f1 * 100).toFixed(1)}%`
                :this.evaluationKeys == "mcc"? `${(this.predictions[this.hover.classifier].mcc * 100).toFixed(1)}%`
                :`${(this.predictions[this.hover.classifier].right.size / this.instances.length * 100).toFixed(1)}%`);
        if (this.evaluationKeys == "accuracy") {
           yAxisMarkerTextWrong
            .transition()
            .duration(moveDuration)
            .attr('fill-opacity', 1)
            .attr('transform', this.evaluationKeys == "f1" ?
            `translate(
              ${this.x.paddingOuter() * this.x.bandwidth() / 2},
              ${ this.y (1/ (2 * this.predictions[this.hover.classifier].tp.size / (this.predictions[this.hover.classifier].tp.size + this.predictions[this.hover.classifier].fp.size)))- 10})`
              :`translate(
              ${this.x.paddingOuter() * this.x.bandwidth() / 2},
              ${this.y(this.predictions[this.hover.classifier].right.size / this.instances.length) - 10})`)
            .text(this.evaluationKeys == "f1" ?
                  `${(this.predictions[this.hover.classifier].f1 * 100).toFixed(1)}%`
                  :this.evaluationKeys == "precision" ?
                  `${(this.predictions[this.hover.classifier].precision * 100).toFixed(1)}%`
                  :this.evaluationKeys == "recall" ?
                  `${(this.predictions[this.hover.classifier].recall * 100).toFixed(1)}%`
                  :this.evaluationKeys == "microf1" ?
                  `${(this.predictions[this.hover.classifier].micro_f1 * 100).toFixed(1)}%`
                  :this.evaluationKeys == "macrof1" ?
                  `${(this.predictions[this.hover.classifier].macro_f1 * 100).toFixed(1)}%`
                  :this.evaluationKeys == "mcc" ?
                  `${(this.predictions[this.hover.classifier].mcc * 100).toFixed(1)}%`
                  :`${(this.predictions[this.hover.classifier].wrong.size / this.instances.length * 100).toFixed(1)}%`);
        }
      } else {
        yAxisMarkerLine
          .transition()
          .duration(disappearDuration)
          .attr('stroke-opacity', 0);
        yAxisMarkerTextRight
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
        yAxisMarkerTextWrong
          .transition()
          .duration(disappearDuration)
          .attr('fill-opacity', 0);
      }
    },
    drawHoverExternal() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const rightBars = chart.selectAll('.bar-right');
      const wrongBars = chart.selectAll('.bar-wrong');

      if (this.externalHoverInstance) {
        rightBars.data(this.predictionKeys)
          .attr('fill', (d: string) =>
            this.predictions[d].right.has(this.externalHoverInstance)
              ? this.rightHoverColor
              : this.rightColor);
        wrongBars.data(this.predictionKeys)
          .attr('fill', (d: string) =>
            this.predictions[d].wrong.has(this.externalHoverInstance)
              ? this.wrongHoverColor
              : this.wrongColor);
      } else {
        rightBars.attr('fill', this.rightColor);
        wrongBars.attr('fill', this.wrongColor);
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
          .attr('font-size', 20)
          .selectAll('text')
          .attr('transform', 'rotate(30)')
          .attr('text-anchor', 'start');

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
          .text('Classifier');

        svg.append('text')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 2)
          .attr('y', -this.margin.left * 0.9)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text(this.evaluationKeys == "accuracy"? 'Fraction of instances'
            :this.evaluationKeys == "mcc"? 'MCC value'
            :this.evaluationKeys == "precision"? 'Fraction of instances'
            :this.evaluationKeys == "recall"? 'Fraction of instances'
            :this.evaluationKeys == "microf1"? "Micro F1 value"
            :this.evaluationKeys == "macrof1"? "Macro F1 value":'F1 value');
        svg.append('text')
          //.attr('transform', 'rotate(-90)')
          .attr('x', this.width / 2)
          .attr('y', -100)
          .attr('dy', '1em')
          .style('text-anchor', 'middle')
          .style('font-size', '32px')
          .text(this.evaluationKeys == "accuracy"? 'Accuracy'
            :this.evaluationKeys == "mcc"? 'MCC'
            :this.evaluationKeys == "precision"? 'Precision'
            :this.evaluationKeys == "recall"? 'Recall'
            :this.evaluationKeys == "microf1"? "Micro F1"
            :this.evaluationKeys == "macrof1"? "Macro F1":'F1');
 


      };
      drawTitles();

      const drawLegend = () => {
        const width = this.width / 4;
        const height = this.margin.top / 2;

        // @ts-ignore
        const legend = d3.select(this.$refs.svg)
          .select('svg')
          .append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(
              ${this.margin.left + this.width * 3 / 4},
              ${height / 3})`);

        legend.append('rect')
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.wrongColor)
          .style("visibility", this.evaluationKeys == "accuracy" 
                          ||  this.evaluationKeys == "precision" 
                          ||  this.evaluationKeys == "recall"? "visible":"hidden");

          
        legend.append('rect')
          .attr('y', height / 2)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.rightColor)
          .style("visibility", this.evaluationKeys == "accuracy" 
                          ||  this.evaluationKeys == "precision" 
                          ||  this.evaluationKeys == "recall"? "visible":"hidden");

        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text(this.evaluationKeys == "accuracy" ? "misclassified"
                          : this.evaluationKeys == "precision" ? "fp"
                          : this.evaluationKeys == "recall"? "fn": '')
          .style("visibility", this.evaluationKeys == "accuracy" 
                          ||  this.evaluationKeys == "precision" 
                          ||  this.evaluationKeys == "recall"? "visible":"hidden");

        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height * 3 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text(this.evaluationKeys == "accuracy" ? "correctly classified"
                          : this.evaluationKeys == "precision" ? "tp"
                          : this.evaluationKeys == "recall"? "tp": '')
          .style("visibility", this.evaluationKeys == "accuracy" 
                          ||  this.evaluationKeys == "precision" 
                          ||  this.evaluationKeys == "recall"? "visible":"hidden");
      };
      drawLegend();

      const drawBars = () => {
        const barCells = svg.selectAll('.cell')
          .data(this.predictionKeys)
          .join('g')
            .attr('class', 'cell')
            .attr('transform', (d: string) => `translate(${x(d)}, ${0})`);

        const barWidth = x.bandwidth();

        var bar1_circle = barCells.append("circle")   
          .attr('cx', barWidth / 2)
          .attr('cy', (d: string) => this.height-15)
          .attr('r','15px')
          .attr('fill', this.rightColor)
          .attr('stroke', 'grey')
          .on('mouseenter', (d: string) => this.hover = ({type: 'right', classifier: d}))
          .on('mouseleave', this.clearHover) 
          .on('click', (d: string) => this.select(d, 'right', 'first'))
          .on('contextmenu', (d: string) => this.select(d, 'right', 'second'))
          .style('visibility', (d: string) => {
            var value =  this.evaluationKeys == "f1" ? (this.predictions[d].f1)
            : this.evaluationKeys == "mcc" ? (this.predictions[d].mcc)
            : this.evaluationKeys == "precision" ? (this.predictions[d].precision)
            : this.evaluationKeys == "recall" ? (this.predictions[d].recall)
            :this.evaluationKeys == "microf1" ? (this.predictions[d].micro_f1)
            :this.evaluationKeys == "macrof1" ? (this.predictions[d].macro_f1):(this.predictions[d].right.size / this.instances.length)
            if (value < 0.05 )  return "visible"
            return "hidden"});

        var bar1 = barCells.append('rect')
          .attr('class', 'bar-right')
          .attr('y', (d: string) => this.evaluationKeys == "f1" ? y(this.predictions[d].f1)
              : this.evaluationKeys == "mcc" ? y(this.predictions[d].mcc)
              : this.evaluationKeys == "precision" ? y(this.predictions[d].precision)
              : this.evaluationKeys == "recall" ? y(this.predictions[d].recall)
              : this.evaluationKeys == "microf1" ? y(this.predictions[d].micro_f1)
              : this.evaluationKeys == "macrof1" ? y(this.predictions[d].macro_f1)
              :y(this.predictions[d].right.size / this.instances.length))
          .attr('width', barWidth)
          .attr('height', (d: string) => this.evaluationKeys == "f1" ? this.height - y(this.predictions[d].f1)
            : this.evaluationKeys == "mcc" ? this.height - y(this.predictions[d].mcc)
            : this.evaluationKeys == "precision" ? this.height - y(this.predictions[d].precision)
            : this.evaluationKeys == "recall" ? this.height - y(this.predictions[d].recall)
            :this.evaluationKeys == "microf1" ? this.height - y(this.predictions[d].micro_f1)
            :this.evaluationKeys == "macrof1" ? this.height - y(this.predictions[d].macro_f1)
            :this.height - y(this.predictions[d].right.size / this.instances.length))
          .attr('fill', this.rightColor)
          .attr('stroke', 'black')
          .style('paint-order', 'stroke')
          .on('mouseenter', (d: string) => this.hover = ({type: 'right', classifier: d}))
          .on('mouseleave', this.clearHover) 
        
        if (this.evaluationKeys == "accuracy" ||  this.evaluationKeys == "precision" ||  this.evaluationKeys == "recall") {
            bar1.on('click', (d: string) => this.select(d, 'right', 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'right', 'second'));

            barCells.append('rect')
              .attr('class', 'bar-wrong')
              .attr('y', (d: string) => y(1))
              .attr('width', barWidth)
              .attr('height', (d: string) => this.evaluationKeys == "precision" ? this.height - y(1-this.predictions[d].precision)
                : this.evaluationKeys == "recall" ? this.height - y(1-this.predictions[d].recall)
                :this.height - y(1-this.predictions[d].right.size / this.instances.length))
              .attr('fill', this.wrongColor)
              .attr('stroke', 'black')
              .style('paint-order', 'stroke')
              .on('mouseenter', (d: string) => this.hover = ({type: 'wrong', classifier: d}))
              .on('mouseleave', this.clearHover)
              .on('click', (d: string) => this.select(d, 'wrong', 'first'))
              .on('contextmenu', (d: string) => this.select(d, 'wrong', 'second'));
            var bar1_circle = barCells.append("circle")   
                    .attr('cx', barWidth / 2)
                    .attr('cy', 15)
                    .attr('r','15px')
                    .attr('fill', this.wrongColor)
                    .attr('stroke', 'grey')
                    .on('mouseenter', (d: string) => this.hover = ({type: 'wrong', classifier: d}))
                    .on('mouseleave', this.clearHover)
                    .on('click', (d: string) => this.select(d, 'wrong', 'first'))
                    .on('contextmenu', (d: string) => this.select(d, 'wrong', 'second'))
                    .style('visibility', (d: string) => {
                      var value =  this.evaluationKeys == "precision" ? (1-this.predictions[d].precision)
                      : this.evaluationKeys == "recall" ?(1-this.predictions[d].recall)
                      :(1-this.predictions[d].right.size / this.instances.length)
                      if (value == 0) return "hidden"
                      if (value < 0.05 )  return "visible"
                      return "hidden"});
                      
        }
        
        const selections = () => {
          const selectionBarWidth = x.bandwidth() / 8;
          barCells.append('rect')
            .attr('class', 'bar-right-selection-1')
            .attr('x', barWidth / 2 - selectionBarWidth)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection1Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
            .attr('pointer-events', 'none')
            .style("visibility", this.evaluationKeys == "accuracy" 
                          ||  this.evaluationKeys == "precision" 
                          ||  this.evaluationKeys == "recall"? "visible":"hidden")
            ; 
            
         
            
          barCells.append('rect')
            .attr('class', 'bar-right-selection-2')
            .attr('x', barWidth / 2)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection2Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
            .attr('pointer-events', 'none')
            .style("visibility", this.evaluationKeys == "accuracy" 
                          ||  this.evaluationKeys == "precision" 
                          ||  this.evaluationKeys == "recall"? "visible":"hidden")
            ; 

          barCells.append('rect')
            .attr('class', 'bar-wrong-selection-1')
            .attr('x', barWidth / 2 - selectionBarWidth)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection1Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
            .attr('pointer-events', 'none')
            .style("visibility", this.evaluationKeys == "accuracy" 
                          ||  this.evaluationKeys == "precision" 
                          ||  this.evaluationKeys == "recall"? "visible":"hidden")
            ; 

          barCells.append('rect')
            .attr('class', 'bar-wrong-selection-2')
            .attr('x', barWidth / 2)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection2Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
            .attr('pointer-events', 'none')
            .style("visibility", this.evaluationKeys == "accuracy" 
                          ||  this.evaluationKeys == "precision" 
                          ||  this.evaluationKeys == "recall"? "visible":"hidden")
            ;                

          barCells.append("circle")   
            .attr('class', 'circle-right-selection-1')
            .attr('cx', barWidth / 2 - selectionBarWidth / 2)
            .attr('cy', this.height-selectionBarWidth / 2)
            .attr('r', selectionBarWidth / 2)
            .style('fill', this.selection1Color)
            .attr('stroke', 'grey')
            .attr("visibility","hidden")
            
          barCells.append("circle")   
            .attr('class', 'circle-right-selection-2')
            .attr('cy', this.height-selectionBarWidth / 2)
            .attr('cx', barWidth / 2 + selectionBarWidth / 2 )
            .attr('r',selectionBarWidth / 2)
            .style('fill', this.selection2Color)
            .attr('stroke', 'grey')
            .attr("visibility","hidden")
            
          barCells.append("circle")   
            .attr('class', 'circle-wrong-selection-1')
            .attr('cx', barWidth / 2 - selectionBarWidth / 2)
            .attr('cy', selectionBarWidth / 2)
            .attr('r',selectionBarWidth / 2)
            .style('fill', this.selection1Color)
            .attr('stroke', 'grey')
            .attr("visibility","hidden") 
            
          barCells.append("circle")   
            .attr('class', 'circle-wrong-selection-2')
            .attr('cx', barWidth / 2 + selectionBarWidth / 2)
            .attr('cy', selectionBarWidth / 2)
            .attr('r',selectionBarWidth / 2)
            .style('fill', this.selection2Color)  
            .attr('stroke', 'grey')  
            .attr("visibility","hidden")

           barCells.append("text")   
              .attr('text-anchor', 'middle')
              .attr('font-size', 24)
              .attr('class', 'text-right-selection-1')
              .attr('x', -10)
              .attr('fill', "black")
              .attr("visibility","hidden")  ;  
           barCells.append("text")   
              .attr('text-anchor', 'middle')
              .attr('font-size', 24)
              .attr('class', 'text-right-selection-2')
              .attr('x', barWidth )
              .attr('fill', "black")
              .attr("visibility","hidden")   ;    
          barCells.append("text")   
              .attr('text-anchor', 'middle')
              .attr('font-size', 24)
              .attr('class', 'text-wrong-selection-1')
              .attr('x', -10)
              .attr('fill', "black")
              .attr("visibility","hidden")  ;
           barCells.append("text")   
              .attr('text-anchor', 'middle')
              .attr('font-size', 24)
              .attr('class', 'text-wrong-selection-2')
              .attr('x', barWidth)
              .attr('fill', "black")
              .attr("visibility","hidden")  ;    
            
        };
        selections();
      };

      const yAxisMarkerLine = () => {
        svg.append('line')
          .attr('class', 'y-axis-marker-line')
          .attr('y1', y(1))
          .attr('x2', this.width)
          .attr('y2', y(1))
          .attr('stroke', 'black')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');
      };

      const yAxisMarkerText = () => {
        svg.append('text')
          .attr('class', 'y-axis-marker-text-right')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'hanging')
          .attr('font-size', 20)
          .attr('fill', this.rightHoverColor)
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-wrong')
          .attr('text-anchor', 'middle')
          .attr('font-size', 20)
          .attr('fill', this.wrongHoverColor)
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
      const barRightSelection1 = chart.selectAll('.bar-right-selection-1');
      const barRightSelection2 = chart.selectAll('.bar-right-selection-2');
      const barWrongSelection1 = chart.selectAll('.bar-wrong-selection-1');
      const barWrongSelection2 = chart.selectAll('.bar-wrong-selection-2');

      const circleRightSelection1 = chart.selectAll('.circle-right-selection-1');
      const circleRightSelection2 = chart.selectAll('.circle-right-selection-2');
      const circleWrongSelection1 = chart.selectAll('.circle-wrong-selection-1');
      const circleWrongSelection2 = chart.selectAll('.circle-wrong-selection-2');

      const textRightSelection1 = chart.selectAll('.text-right-selection-1');
      const textRightSelection2 = chart.selectAll('.text-right-selection-2');
      const textWrongSelection1 = chart.selectAll('.text-wrong-selection-1');
      const textWrongSelection2 = chart.selectAll('.text-wrong-selection-2');
      const formatDecimal = d3.format(".1f")

      const { first, second } = this.selections;

      const rightYOffset = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = this.predictions[classifierName][typeString]
        var totalInstances = 0
        if (this.evaluationKeys=="precision"){           
          totalInstances = this.predictions[classifierName]["fp"].size+this.predictions[classifierName]["tp"].size
        }else if  ( this.evaluationKeys=="recall"){
           totalInstances = this.predictions[classifierName]["fn"].size+this.predictions[classifierName]["tp"].size}
        else{    
           totalInstances = this.instances.length}
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = overlappingInstances.size / totalInstances;
        return this.y(fractionOfTotalInstances);
      };
      const rightHeight = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = this.predictions[classifierName][typeString]
        return this.height - rightYOffset(classifierName, typeString,selection);
      };

      const wrongHeight = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = this.predictions[classifierName][typeString]
        var totalInstances = 0
        if (this.evaluationKeys=="precision"){           
          totalInstances = this.predictions[classifierName]["fp"].size+this.predictions[classifierName]["tp"].size
        }else if  ( this.evaluationKeys=="recall"){
           totalInstances = this.predictions[classifierName]["fn"].size+this.predictions[classifierName]["tp"].size}
        else{    
           totalInstances = this.instances.length}
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = overlappingInstances.size / totalInstances;
        return this.height - this.y(fractionOfTotalInstances);
      };

      const hoverText  = (classifierName:string, typeString: string, selection: Set<string>) => {
        const instances = this.predictions[classifierName][typeString]
        var totalInstances = 0
        if (this.evaluationKeys=="precision"){           
          totalInstances = this.predictions[classifierName]["fp"].size+this.predictions[classifierName]["tp"].size
        }else if  ( this.evaluationKeys=="recall"){
           totalInstances = this.predictions[classifierName]["fn"].size+this.predictions[classifierName]["tp"].size}
        else{    
           totalInstances = this.instances.length}
        const overlappingInstances = intersection(instances, selection);
        return overlappingInstances.size;
      };
      

      if (!first) {
        barRightSelection1.attr('height', '0');
        barWrongSelection1.attr('height', '0');

        circleRightSelection1.attr("visibility","hidden");
        circleWrongSelection1.attr("visibility","hidden");

        textRightSelection1.attr("visibility","hidden");
        textWrongSelection1.attr("visibility","hidden");
      } else {
        barRightSelection1
          .data(this.predictionKeys)
          .attr('y', (d: string) => rightYOffset(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", first.instances))
          .attr('height', (d: string) => rightHeight(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", first.instances));
        barWrongSelection1
          .data(this.predictionKeys)
          .attr('height', (d: string) => wrongHeight(d,this.evaluationKeys=="precision"? "fp" :
            this.evaluationKeys=="recall"?"fn" :"wrong", first.instances));
        
        circleRightSelection1.attr("visibility", (d:string) => {
                    return rightHeight(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", first.instances) == 0 ?"hidden": 
                    rightHeight(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", first.instances) / this.height>0.05? "hidden" 
                    :"visible"
                    })
        circleWrongSelection1.attr("visibility",(d:string) => {
                    return wrongHeight(d,this.evaluationKeys=="precision"? "fp" :
            this.evaluationKeys=="recall"?"fn" :"wrong", first.instances) == 0 ?"hidden": 
                    wrongHeight(d,this.evaluationKeys=="precision"? "fp" :
            this.evaluationKeys=="recall"?"fn" :"wrong", first.instances) / this.height>0.05? "hidden" 
                    :"visible"
                    })
        textRightSelection1
               .data(this.predictionKeys)
               .attr('y', (d: string) => rightYOffset(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", first.instances))
               .text((d: string) => formatDecimal(hoverText(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", first.instances)))
        textWrongSelection1
               .data(this.predictionKeys)
               .text((d: string) =>formatDecimal( hoverText(d,this.evaluationKeys=="precision"? "fp" :
            this.evaluationKeys=="recall"?"fn" :"wrong", first.instances)))
      }

      if (!second) {
        barRightSelection2.attr('height', '0');
        barWrongSelection2.attr('height', '0');

        circleRightSelection2.attr("visibility","hidden");
        circleWrongSelection2.attr("visibility","hidden");

        textRightSelection2.attr("visibility","hidden");
        textWrongSelection2.attr("visibility","hidden");
      } else {
        barRightSelection2
          .data(this.predictionKeys)
          .attr('y', (d: string) => rightYOffset(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", second.instances))
          .attr('height', (d: string) => rightHeight(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", second.instances));
        barWrongSelection2
          .data(this.predictionKeys)
          .attr('height', (d: string) => wrongHeight(d,this.evaluationKeys=="precision"? "fp" :
            this.evaluationKeys=="recall"?"fn" :"wrong", second.instances));

        circleRightSelection2.attr("visibility", (d:string) => {
                    return rightHeight(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", second.instances) == 0 ?"hidden": 
                    rightHeight(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", second.instances) / this.height>0.05? "hidden" 
                    :"visible"
                    })
        circleWrongSelection2.attr("visibility",(d:string) => {
                    return wrongHeight(d,this.evaluationKeys=="precision"? "fp" :
            this.evaluationKeys=="recall"?"fn" :"wrong", second.instances)== 0 ?"hidden": 
                    wrongHeight(d,this.evaluationKeys=="precision"? "fp" :
            this.evaluationKeys=="recall"?"fn" :"wrong", second.instances) / this.height>0.05? "hidden" 
                    :"visible"
                    })  
        textRightSelection2
               .data(this.predictionKeys)
               .attr('y', (d: string) => rightYOffset(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", second.instances))
               .text((d: string) => formatDecimal(hoverText(d,this.evaluationKeys=="precision"? "tp" :
            this.evaluationKeys=="recall"?"tp" :"right", second.instances)))
        textWrongSelection2
               .data(this.predictionKeys)
               .text((d: string) => formatDecimal(hoverText(d,this.evaluationKeys=="precision"? "fp" :
            this.evaluationKeys=="recall"?"fn" :"wrong", second.instances)))
      }

       if (this.evaluationKeys == "microf1" || this.evaluationKeys == "macrof1" || this.evaluationKeys == "f1" || this.evaluationKeys == "mcc") {
         circleRightSelection1.attr("visibility","hidden");
         circleRightSelection2.attr("visibility","hidden");
         circleWrongSelection1.attr("visibility","hidden");
         circleWrongSelection2.attr("visibility","hidden");
      }
    },
    select(
      classifier: string,
      type: 'right' | 'wrong',
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.RIGHT;
      constraint.classifier = classifier;
      constraint.negation = (type === 'wrong');

      const curType = ((this.evaluationKeys == "precision"||this.evaluationKeys == "recall") && type=='right')? "tp" 
      :(this.evaluationKeys=="accuracy" && type=='right')?"right"
      :(this.evaluationKeys=="precision" && type=='wrong')?"fp"
      :(this.evaluationKeys=="recall" && type=='wrong')?"fn":"wrong"
      

      const instances = this.predictions[classifier][curType];
      const description = `Instances which ${classifier} got ${type}`;
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
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
  },
});
</script>

<style scoped>
.card {
  background-color: white;
}
</style>
