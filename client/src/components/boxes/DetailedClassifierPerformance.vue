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
            <span>Performance (Per-Class)</span>
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
            <v-radio label="precision" value="precision"></v-radio>
            <v-radio label="recall" value="recall"></v-radio>
            <v-radio label="f1" value="f1"></v-radio>
            <v-radio label="mcc" value="mcc"></v-radio>
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
//import { Dictionary } from 'vuex';
export default Vue.extend({
  name: 'Performance_Per_Class)',
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
    const evaluationSelection = 'accuracy' as 'accuracy' | 'precision' | 'recall'
    const hover = {
      // !!! type: '' as 'bar1' | 'bar2' | '',
      type: '' as 'right' | 'wrong' | '',
      classifier: '',
      classes: '',
      value: 0,
    };
    return {
      accuracySorting,
      evaluationSelection,
      height,
      hover,
      margin,
      panel: [],
      bar1Color: '#d1e5f0',
      bar1HoverColor: '#4393c3',
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      width,
      bar2Color: '#fddbc7',
      bar2HoverColor: '#d6604d',
    };
  },
  computed: {
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
      const accuracyAscending = (c1: string, c2: string) => {
        
        var rightsize1 = 0;
        var rightsize2 = 0;
        
        for (var i in this.predictions[c1]) {
          rightsize1 += this.predictions[c1][i].right.size;
        }
        for (var i in this.predictions[c2]) {
          rightsize2 += this.predictions[c2][i].right.size;
        }
        return rightsize1 - rightsize2;
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
    evaluationKeys(): string {
      var evaluationKeys = ""
      switch (this.evaluationSelection) {
        case 'precision':
          evaluationKeys = "precision";
          break;
        case 'recall':
          evaluationKeys = "recall";
          break;
        case 'accuracy':
          evaluationKeys = "accuracy";
          break;
        case 'f1':
          evaluationKeys = "f1";
          break; 
        case 'mcc':
          evaluationKeys = "mcc";
          break;    
      }
      return evaluationKeys;
    },
    predictions(): {
      
      [classifier: string]: {
        [classes : string]: {
          class: String,
          right: Set<string>,
          wrong: Set<string>,
          fp: Set<String>,
          fn: Set<String>,
          tp: Set<String>,
          tn: Set<String>,
          pred: Set<String>,
          actual: Set<String>,
        },
      },
    } {

      const predictions: {
        [classifier: string]: {
          [classes: string] :{
            class: String,
            right: Set<string>,
            wrong: Set<string>,
            fp: Set<String>,
            fn: Set<String>,
            tp: Set<String>,
            tn: Set<String>,
            pred: Set<String>,
            actual: Set<String>,
            },
        },
      } = {};

      this.classifiers.forEach((c) => {
          predictions[c] = {}
          this.classes.forEach((d) => {
            predictions[c][d] = {
            class: new String,
            right: new Set(),
            wrong: new Set(),
            fp: new Set(),
            fn: new Set(),
            tp: new Set(),
            tn: new Set(),
            pred: new Set(),
            actual: new Set(),
            }
          })
        });


      this.instances.forEach((id) => {
        const i = instanceById(id);
        this.classifiers.forEach((c) => {
          var curAcClass = i.actual;
          var curPredClass = i.predictions[c]
          var curClassifier = c;
          predictions[curClassifier][curPredClass].pred.add(id);
          predictions[curClassifier][curAcClass].actual.add(id);
          if (i.predictions[c] == i.actual) {
            predictions[c][curAcClass].right.add(id);
            predictions[curClassifier][curAcClass].tp.add(id);
            this.classes.forEach((j)=>{
              if (j != curPredClass){
                predictions[curClassifier][j].tn.add(id)
              } 
            })
          } else {
            predictions[c][curAcClass].wrong.add(id);
            predictions[c][curPredClass].fp.add(id)
            predictions[curClassifier][curAcClass].fn.add(id);
          }
        });
      });
      console.log(predictions)
      return predictions;
    },
    curData() : void[] {
      const x0Name = this.predictionKeys;
      const x1Name = this.classes;  
      const curData = []
      x0Name.forEach(_x0n => {
        const _data = [];
        x1Name.forEach(_x1n => {
          let pre = this.predictions[_x0n][_x1n].tp.size / (this.predictions[_x0n][_x1n].tp.size + this.predictions[_x0n][_x1n].fp.size )
          let rec = this.predictions[_x0n][_x1n].tp.size / (this.predictions[_x0n][_x1n].tp.size + this.predictions[_x0n][_x1n].fn.size )
          if (this.evaluationKeys == "precision") {
             _data.push(pre)
          } else if (this.evaluationKeys == "recall") {
             _data.push(rec)
          } else if (this.evaluationKeys == "f1") {
            let f1 =  (pre + rec) == 0 ? 0 : 2 * pre * rec / (pre + rec)
             _data.push(f1)
          } else if (this.evaluationKeys == "mcc") {
            var tp = this.predictions[_x0n][_x1n].tp.size;
            var fp = this.predictions[_x0n][_x1n].fp.size 
            var fn = this.predictions[_x0n][_x1n].fn.size;
            var tn = this.predictions[_x0n][_x1n].tn.size 
            if ((Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))) == 0){
               let mcc =  0
               if ((tp * tn - tp * fn) < 0){
                  mcc = -1;
                } else {
                  mcc = 1;
                }
                _data.push(mcc)
            } else {
              let mcc = (tp * tn - tp * fn) / (Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)));
              _data.push(mcc)
            }
          } else {
            let  acc = this.predictions[_x0n][_x1n].right.size / (this.predictions[_x0n][_x1n].right.size + this.predictions[_x0n][_x1n].wrong.size)
            _data.push(acc)
          }
        });
        curData.push(_data);
      })
      return curData
    },
    curData_reverse() : string[] {
      const x0Name = this.predictionKeys;
      const x1Name = this.classes;  
      const curData_reverse = []
      this.curData.forEach((c) => {
        const _data_reverse = [];
        c.forEach((d)=>{
          _data_reverse.push(1-d)
        })
        curData_reverse.push(_data_reverse)
      })
      console.log(curData_reverse)
      return curData_reverse
    },
    hoverData() : string[] {
      const hoverdata = []
        for (var i in this.predictionKeys) {
          for (var j in this.classes) {
            let cur_dict = {"classifier":this.predictionKeys[i],"class":this.classes[j],"value":this.curData[i][j]}
            hoverdata.push(cur_dict)
          }
        }
        return hoverdata
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
        .paddingInner(0.1);
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
      this.hover = ({type: '', classifier: '', classes:'', value:0});
    },
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const rightBars = chart.selectAll('.bar-right');
      const wrongBars = chart.selectAll('.bar-wrong');
      const yAxisMarkerLine = chart.select('.y-axis-marker-line');
      const yAxisMarkerTextRight = chart.select('.y-axis-marker-text-right');
      const yAxisMarkerTextWrong = chart.select('.y-axis-marker-text-wrong');
      const selectedBarText = chart.select('.bar-selectedBarText');

      if (this.hover.classifier && this.hover.classes) {
        selectedBarText.text(this.hover.classifier+": "+this.hover.classes)
        .style("visibility","visible");  
      }     
      
      if (this.hover.type === 'right') {
        rightBars.data(this.hoverData)
          .attr('fill', (d: string) =>
            d["classifier"] === this.hover.classifier && d["class"] === this.hover.classes
              ? this.bar1HoverColor
              : this.bar1Color);
      } else {
        rightBars.attr('fill', this.bar1Color);
      }
      if (this.hover.type === 'wrong') {
        wrongBars.data(this.hoverData)
          .attr('fill', (d: string) =>
            d["classifier"]  === this.hover.classifier && d["class"] === this.hover.classes
              ? this.bar2HoverColor
              : this.bar2Color);
      } else {
        wrongBars.attr('fill', this.bar2Color);
      }
      const moveDuration = 500;
      const disappearDuration = 1000;
      if (this.hover.type) {
        yAxisMarkerLine
        .transition()
        .duration(moveDuration)
        .attr('stroke-opacity', 1)
        .attr('y1',  (d: string) => this.y(this.hover.value))
        .attr('x2', this.width)
        .attr('y2', (d: string) =>  this.y(this.hover.value));
      yAxisMarkerTextRight
        .transition()
        .duration(moveDuration)
        .attr('fill-opacity', 1)
        .attr('transform', `translate(
          ${this.x.paddingOuter() * this.x.bandwidth() / 2},
          ${this.y( this.hover.value) + 10})`)
        .text(`${( this.hover.value * 100).toFixed(1)}%`);
      yAxisMarkerTextWrong
        .transition()
        .duration(moveDuration)
        .attr('fill-opacity', 1)
        .attr('transform', `translate(
          ${this.x.paddingOuter() * this.x.bandwidth() / 2},
          ${this.y( this.hover.value) - 10})`)
        .text(`${((1- this.hover.value) * 100).toFixed(1)}%`)
        .style("visibility", this.evaluationKeys == "f1" || this.evaluationKeys == "mcc"?"hidden":"visible")
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
        .attr('fill-opacity', 0)
        .style("visibility", this.evaluationKeys == "f1"|| this.evaluationKeys == "mcc"?"hidden":"visible")

    } 
      
      
    },
    drawHoverExternal() {
      // @ts-ignore
      console.log("externalHoverInstance",this.externalHoverInstance)
      const chart = d3.select(this.$refs.svg);
      const rightBars = chart.selectAll('.bar-right');
      const wrongBars = chart.selectAll('.bar-wrong');
      if (this.externalHoverInstance) {
        rightBars.data(this.hoverData)
          .attr('fill', (d: string) =>
            this.predictions[d["classifier"]].right.has(this.externalHoverInstance)
              ? this.bar1HoverColor
              : this.bar1Color);
        wrongBars.data(this.hoverData)
          .attr('fill', (d: string) =>
            this.predictions[d["classifier"]].wrong.has(this.externalHoverInstance)
              ? this.bar2HoverColor
              : this.bar2Color);
      } else {
        rightBars.attr('fill', this.bar1Color);
        wrongBars.attr('fill', this.bar2Color);
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
      
      const x = this.x;
      const y = this.y;
      const z = d3.scaleOrdinal()
        .range(["#d1e5f0", "#fddbc7"]);
      const x0Name = this.predictionKeys;
      const x1Name = this.classes;  
      const curData = []
      const curData_reverse = []
      for (var i in this.curData) {
        curData.push(this.curData[i])
      }
      for (var i in this.curData_reverse) {
        curData_reverse.push(this.curData_reverse[i])
      }
      const x0 = d3.scaleBand()
        .domain(x0Name)
        .range([0, this.width])
        .paddingInner(0.1);
      const x1 = d3.scaleBand()
        .domain(x1Name)
        .rangeRound([0, x0.bandwidth()])
        .padding(0.05);


      const drawAxes = () => {
        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(x0)
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
            const yOffset = this.height + this.margin.bottom;
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
          .text(this.evaluationKeys == 'f1'?'F1 Vale': this.evaluationKeys == "mcc"? 'MCC value':'Fraction of instances');
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
          .attr('fill', this.bar2Color)
          .style("visibility", this.evaluationKeys == 'f1'|| this.evaluationKeys == "mcc"?"hidden":"visible");
        legend.append('rect')
          .attr('y', height / 2)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.bar1Color)
          .style("visibility", this.evaluationKeys == 'f1'|| this.evaluationKeys == "mcc"?"hidden":"visible");
        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text(this.evaluationKeys == 'accuracy'? 'misclassified'
            : this.evaluationKeys == 'precision'? 'FP' :'FN')
          .style("visibility", this.evaluationKeys == 'f1'|| this.evaluationKeys == "mcc"?"hidden":"visible");  
        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height * 3 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text(this.evaluationKeys == 'accuracy'? 'correctly classified'
            : this.evaluationKeys == 'precision'? 'TP' : 'TP')
          .style("visibility", this.evaluationKeys == 'f1'|| this.evaluationKeys == "mcc"?"hidden":"visible");  


        const selectedBarText = d3.select(this.$refs.svg)
          .select('svg')
          .append('g')
            .attr('class', 'selectedBarText')
            .attr('transform', `translate(
              ${this.margin.left },
              ${height / 3})`);  
        selectedBarText.append('text')
          .attr('class', 'bar-selectedBarText')
          .attr('transform', `translate(${0}, ${height * 1 / 4})`)
          .attr('font-size', '16px')
          .text('name selected Bar')
          .style("visibility", "hidden")//:"visible");        
      };
      drawLegend();

      const drawBars = () => {
        const barWidth = x.bandwidth();
        console.log('curdata',curData)
        console.log('curdata_reverse',curData_reverse)
        console.log("hoverData",this.hoverData)
        const barMultitp = svg.append('g')
            .selectAll('g')
            .data(curData)
            .enter().append('g')
            .attr('transform', (d, i) => `translate(${x0(x0Name[i])},0)`)
            .selectAll('rect')
            .data(d => d)
            .enter();
       
        const multibars = barMultitp.append('rect')
            .attr('class', 'bar-right')
            .attr('x', (d, i) => x1(x1Name[i]))
            .attr('y', d => y(d))
            .attr('width', x1.bandwidth())
            .attr('height', d => this.height - y(d))
            .attr('fill', "#d1e5f0")
            .data(this.hoverData)
            .on('mouseenter', (d) => this.hover = ({type: 'right', classifier: d["classifier"], classes:d["class"], value:d["value"]}))
            .on('mouseleave', this.clearHover)
            .on('click', (d) => this.select(d["classifier"], 'right', 'first',d["class"]))
            .on('contextmenu', (d) => this.select(d["classifier"], 'right', 'second',d["class"]))    
        barMultitp.append("circle") 
            .attr('class', 'bar-right-circle')
            .attr('cx', (d, i) => (x1(x1Name[i])+barWidth/4))
            .attr('cy', d => this.height-10)
            .attr('r','10px')
            .style('fill', "#d1e5f0")
            .attr('stroke', 'grey')
            .attr("visibility", (d) => {
              console.log(d)
              return d == 0 ?"hidden": d>0.2? "hidden" :"visible"
              })
            .data(this.hoverData)
            .on('mouseenter', (d) => this.hover = ({type: 'right', classifier: d["classifier"], classes:d["class"], value:d["value"]}))
            .on('mouseleave', this.clearHover)
            .on('click', (d) => this.select(d["classifier"], 'right', 'first',d["class"]))
            .on('contextmenu', (d) => this.select(d["classifier"], 'right', 'second',d["class"]))
        const barMultitpRe = svg.append('g')
                .selectAll('g')
                .data(curData_reverse)
                .enter().append('g')
                .attr('transform', (d, i) => `translate(${x0(x0Name[i])},0)`)
                .selectAll('rect')
                .data(d => d)
                .enter()
        const multirebars =  barMultitpRe.append('rect')
            .attr('class', 'bar-wrong')
            .attr('x', (d, i) => x1(x1Name[i]))
            .attr('y', d => y(1))
            .attr('width', x1.bandwidth())
            .attr('height', d => this.height - y(d))
            .attr('fill', "#fddbc7")
            //.attr("visibility", this.evaluationKeys == "accuracy"?"hidden":"visible")
            .data(this.hoverData)
            .on('mouseenter', (d) => this.hover = ({type: 'wrong', classifier: d["classifier"], classes:d["class"], value:d["value"]}))
            .on('mouseleave', this.clearHover)
            .on('click', (d) => this.select(d["classifier"], 'wrong', 'first',d["class"]))
            .on('contextmenu', (d) => this.select(d["classifier"], 'wrong', 'second',d["class"]))
            .style("visibility", this.evaluationKeys == "f1"|| this.evaluationKeys == "mcc"?"hidden":"visible")
        var bar2_circle = barMultitpRe.append("circle")   
            .attr('cx', (d, i) => (x1(x1Name[i])+barWidth/4))
            .attr('cy', d => y(1)+10)
            .attr('r','10px')
            .style('fill', '#fddbc7')
            .attr('stroke', 'grey')
            .attr("visibility", (d) => {
              if (this.evaluationKeys == "f1"|| this.evaluationKeys == "mcc") return "hidden"
              console.log(d)
              return d == 0?"hidden":d >0.2?"hidden":"visible"
              })
            .data(this.hoverData)
            .on('mouseenter', (d) => this.hover = ({type: 'wrong', classifier: d["classifier"], classes:d["class"], value:d["value"]}))
            .on('mouseleave', this.clearHover)
            .on('click', (d) => this.select(d["classifier"], 'wrong', 'first',d["class"]))

        const selections = () => {
          console.log("call sleections")
          const selectionBarWidth = x.bandwidth() / 8;
          //barMultitp
           multibars.append('rect')
            .attr('class', 'bar-right-selection-1')
            .attr('x', barWidth / 2 - selectionBarWidth)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection1Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
            .attr('pointer-events', 'none');
          //barMultitp
          multibars.append('rect')
            .attr('class', 'bar-right-selection-2')
            .attr('x', barWidth / 2)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection2Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
            .attr('pointer-events', 'none');
          //barMultitpRe
          multirebars.append('rect')
            .attr('class', 'bar-wrong-selection-1')
            .attr('x', barWidth / 2 - selectionBarWidth)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection1Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
            .attr('pointer-events', 'none');
          //barMultitpRe
          multirebars.append('rect')
            .attr('class', 'bar-wrong-selection-2')
            .attr('x', barWidth / 2)
            .attr('width', selectionBarWidth)
            .attr('fill', this.selection2Color)
            .attr('stroke', 'black')
            .attr('stroke-width', '2px')
            .attr('pointer-events', 'none');

          //barMultitpRe
          multibars.append("circle")   
            .attr('class', 'circle-right-selection-1')
            .attr('cx', barWidth / 2 - selectionBarWidth)
            .attr('r','10px')
            .style('fill', this.selection1Color)
            .attr('stroke', 'grey')
          //barMultitpRe
          multibars.append("circle")   
            .attr('class', 'circle-right-selection-2')
            .attr('cx', barWidth / 2 )
            .attr('r','10px')
            .style('fill', this.selection2Color)
            .attr('stroke', 'grey')
          //barMultitpRe
          multirebars.append("circle")   
            .attr('class', 'circle-wrong-selection-1')
            .attr('cx', barWidth / 2 - selectionBarWidth)
            .attr('r','10px')
            .style('fill', this.selection1Color)
            .attr('stroke', 'grey')
          //barMultitpRe
          multirebars.append("circle")   
            .attr('class', 'circle-wrong-selection-2')
            .attr('cx', barWidth / 2 )
            .attr('r','10px')
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
          .attr('fill', this.bar1HoverColor)
          .attr('pointer-events', 'none');
        svg.append('text')
          .attr('class', 'y-axis-marker-text-wrong')
          .attr('text-anchor', 'middle')
          .attr('font-size', 20)
          .attr('fill', this.bar2HoverColor)
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

      const { first, second } = this.selections;
      const rightYOffset = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = overlappingInstances.size / this.instances.length;
        return this.y(fractionOfTotalInstances);
      };
      const rightHeight = (instances: Set<string>, selection: Set<string>) => {
        return this.height - rightYOffset(instances, selection);
      };
      const wrongHeight = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = overlappingInstances.size / this.instances.length;
        return this.height - this.y(fractionOfTotalInstances);
      };
      if (!first) {
        barRightSelection1.attr('height', '0');
        barWrongSelection1.attr('height', '0');

        circleRightSelection1.attr("visibility", "hidden")
        circleWrongSelection1.attr("visibility", "hidden")
      } else {
        barRightSelection1
          .data(this.hoverData)
          .attr('y', (d: number) => rightYOffset(this.predictions[d["classifier"]][d["class"]].right, first.instances))
          .attr('height', (d: number) => rightHeight(this.predictions[d["classifier"]][d["class"]].right, first.instances));
        barWrongSelection1
          .data(this.hoverData)
          // .attr('y', (d: number) => wrongYOffset(this.predictions[d].wrong, first.instances))
          .attr('height', (d: number) => wrongHeight(this.predictions[d["classifier"]][d["class"]].wrong, first.instances));

        circleRightSelection1
          .data(this.hoverData)
          .attr('cy',this.height-10)
          .attr("visibility", (d:number)=>{
            return rightHeight(this.predictions[d["classifier"]][d["class"]].right, first.instances) == 0? "hidden"
            : rightHeight(this.predictions[d["classifier"]][d["class"]].right, first.instances) / this.height> 0.1? "hidden":"visible"
          })
        circleWrongSelection1
          .attr('cy',10)
          .data(this.hoverData)
          .attr("visibility", (d:number)=>{
            console.log("  wrong height",wrongHeight(this.predictions[d["classifier"]][d["class"]].wrong, first.instances)/ this.height)
            return wrongHeight(this.predictions[d["classifier"]][d["class"]].wrong, first.instances) == 0? "hidden"
            :wrongHeight(this.predictions[d["classifier"]][d["class"]].wrong, first.instances) / this.height> 0.1? "hidden":"visible"
          })
          }
      if (!second) {
        barRightSelection2.attr('height', '0');
        barWrongSelection2.attr('height', '0');

        circleRightSelection2.attr("visibility", "hidden")
        circleWrongSelection2.attr("visibility", "hidden")
      } else {
        barRightSelection2
          .data(this.hoverData)
          .attr('y', (d: number) => rightYOffset(this.predictions[d["classifier"]][d["class"]].right, second.instances))
          .attr('height', (d: number) => rightHeight(this.predictions[d["classifier"]][d["class"]].right, second.instances));
        barWrongSelection2
          .data(this.hoverData)
          // .attr('y', (d: number) => wrongYOffset(this.predictions[d].wrong, second.instances))
          .attr('height', (d: number) => wrongHeight(this.predictions[d["classifier"]][d["class"]].wrong, second.instances));

        circleRightSelection2
          .data(this.hoverData)
          .attr('cy',this.height-10)
          .attr("visibility", (d:number)=>{
            return rightHeight(this.predictions[d["classifier"]][d["class"]].right, second.instances) == 0? "hidden"
            : rightHeight(this.predictions[d["classifier"]][d["class"]].right, second.instances) / this.height> 0.1? "hidden":"visible"
          })
        circleWrongSelection2
          .attr('cy',10)
          .data(this.hoverData)
          .attr("visibility", (d:number)=>{
            return wrongHeight(this.predictions[d["classifier"]][d["class"]].wrong, second.instances) == 0? "hidden"
            :wrongHeight(this.predictions[d["classifier"]][d["class"]].wrong, second.instances) / this.height> 0.1? "hidden":"visible"
          }) 
      }
    },
    select(
      classifier: string,
      type: 'right' | 'wrong',
      whichOverlap: 'first' | 'second',
      className: string,
    ) {
      console.log("trigger select",this.predictions[classifier][className])
      d3.event.preventDefault();
      d3.event.stopPropagation();
      const constraint = blankConstraint();
      constraint.rule = Rule.RIGHT;
      constraint.classifier = classifier;
      constraint.negation = (type === 'wrong');
      const instances = this.predictions[classifier][className][type];
      const description = `${classifier} ${className}Instances which ${classifier} got ${type}`;
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric: this.predictions[classifier][className]
      };
      const payload = {
        description,
        instances,
        predicate,
        classifier,
        className,
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