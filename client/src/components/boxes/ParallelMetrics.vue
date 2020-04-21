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
            <span>Metrics Parallel</span>
          </div>
        </v-expansion-panel-header>
      </v-expansion-panel>
    </v-expansion-panels>
    <div id="legend1" >

    <v-switch
  v-model="normalization_switch"
  label="Filter"
    ></v-switch>
    </div>
    <div ref="svg" />

  </div> 
  
</template>
<script src="d3.parcoords.js"></script>
<script lang="ts">
import Vue from 'vue';
import * as d3 from 'd3';

import {
  BoxProps,
  Instance,
  SelectionRecord,
  Metrics,
} from '../../types';
import {
  instanceById,
  intersection,
} from '../../utils';
import { PredicateSimple, Rule } from '../constraints/types';
import { blankConstraint } from '../constraints/utils';

interface MetricsWithClassifier {
  classifier: string;
  metrics: Metrics;
}

export default Vue.extend({
  name: 'MetricsParallel',
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
    const margin = {top: 30, right: 20, bottom: 90, left: 120};
    const width = 1000 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;
    const accuracySorting = 'descending' as 'ascending' | 'descending' | '' | 'alphabetical';
    const hover = {
      type: '' as 'right' | 'wrong' | '',
      classifier: '',
    };
    return {
      accuracySorting,
      height,
      normalization:'No',
      hover,
      margin,
      curclick:[],
      panel: [],
      rightColor: '#d1e5f0',
      rightHoverColor: '#4393c3',
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      width,
      selectedEval:'',
      wrongColor: '#fddbc7',
      wrongHoverColor: '#d6604d',
    };
  },
  computed: {
    normalization_switch: {
      get: function() {
				return this.normalization === "Yes";
			},
			set: function() {
        if (this.normalization == "Yes") {
          this.normalization = "No"
        } else {
          this.normalization = "Yes"
        }
				// this.normalization = value ? "Yes" : "No";
			},
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

      console.log(predictionKeys)
      return predictionKeys;
    },
    evaluationMethods(): string[] {
      
      const evaluationMethods = ["accuracy", "mcc"];
      if (this.classes.length > 2) {
        evaluationMethods.push("microf1")
        evaluationMethods.push("macrof1")
      } else {
        evaluationMethods.push("precision")
        evaluationMethods.push("recall")
        evaluationMethods.push("f1")
      }
      return evaluationMethods;
    },
    
    metrics(): MetricsWithClassifier[] {
      const storeMetrics: {
        [classifier: string]: Metrics,
      } = this.$store.getters.metrics;

      const metrics: MetricsWithClassifier[] = Object.entries(storeMetrics).map(([classifier, m]) => {
        return {
          classifier,
          metrics: m,
        };
      });
      return metrics;
    },
    predictions(): {
      [classifier: string]: {
        right: Set<string>,
        wrong: Set<string>,
      },
    } {
      const predictions: {
        [classifier: string]: {
          right: Set<string>,
          wrong: Set<string>,
        },
      } = {};

      this.classifiers.forEach((c) => {
        predictions[c] = {
          right: new Set(),
          wrong: new Set(),
        };
      });

      this.instances.forEach((id) => {
        const i = instanceById(id);
        this.classifiers.forEach((c) => {
          if (i.predictions[c] === i.actual) {
            predictions[c].right.add(id);
          } else {
            predictions[c].wrong.add(id);
          }
        });
      });

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
        .domain(this.evaluationMethods)
        .range([0, this.width])
        .paddingOuter(1)
        .paddingInner(0);
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
    accuracySorting() {
      //this.drawInitial();
    },
    externalHoverInstance() {
      //this.drawHoverExternal();
    },
    hover() {
      //this.drawHover();
    },
    instances() {
      this.drawInitial();
    },
    selections() {
      this.drawSelections();
    },
    normalization_switch() {
      this.drawInitial();
    },
  },
  mounted() {
    this.drawInitial();
  },
  methods: {
    drawInitial() {
      console.log("normalization_switch",this.normalization);
      // @ts-ignore
      d3.select(this.$refs.svg).selectAll('*').remove();
      // @ts-ignore
      const svg = d3.select(this.$refs.svg).append('svg')
        .attr('width', '100%')
        .attr('viewBox', `0 0
          ${this.width + this.margin.left + this.margin.right}
          ${this.height + this.margin.top + this.margin.bottom}`)
        // .call(d3.zoom().on("zoom", function () {
        //     svg.attr("transform", d3.event.transform)
        // }))  
        .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

      const x = this.x;
      const y = this.y;
      

      const drawParelle = () => {
        let vueThis = this;


        const sequentialScale = d3.scaleSequential<string>( d3.interpolateWarm)
        .domain([0, 100])
        .interpolator(function (x) { return d3.interpolateWarm(.8*x);} );
            


        continuous("#legend1", sequentialScale);

        var data = [];
        const fakeyClassifiers = [
        'Oracle',
        'Majority Classifier',
        'Random Classifier',
        ];
        
        this.metrics.forEach((classifier)=>{
          var cur_dict = {"name":classifier.classifier,"accuracy":classifier.metrics.accuracy ? classifier.metrics.accuracy : 0, "mcc":classifier.metrics.mcc.average ? classifier.metrics.mcc.average : 0}
          let flag = 1;
          if (this.classes.length > 2) {
            cur_dict["microf1"] = classifier.metrics.microf1.average ? classifier.metrics.microf1.average  : 0;
            cur_dict["macrof1"] = classifier.metrics.macrof1.average ? classifier.metrics.macrof1.average : 0;
            if (this.normalization == "Yes") {
              if ( cur_dict["microf1"] < 0.5 ||  cur_dict["macrof1"] < 0.5) flag = 0
            }
          } else {
            cur_dict["precision"] = classifier.metrics.precision.average ? classifier.metrics.precision.average : 0;
            cur_dict["recall"] = classifier.metrics.recall.average ? classifier.metrics.recall.average : 0;
            cur_dict["f1"] = classifier.metrics.f1.average ? classifier.metrics.f1.average: 0;
            if (this.normalization == "Yes") {
              if ( cur_dict["precision"] < 0.5 ||  cur_dict["recall"] < 0.5 || cur_dict["f1"]  < 0.5) flag = 0
            }
          }
          if (this.normalization == "Yes") {
            if ( cur_dict["accuracy"] < 0.5 ||  cur_dict["mcc"] < 0 ) flag = 0
          }
          if (flag == 1)
           data.push(cur_dict)
        })
 

        var rect_width = (this.width-this.margin.top -this.margin.bottom) / (2 *(data.length+3))
        //draw classifier selection box
        svg.selectAll("myRect")
          .data(data)
          .enter().append("rect")
              .attr('x',  -this.margin.left+10)
              .attr("y", (d,i)=>this.width/5+i*(rect_width+2))
              .attr('width', this.margin.left+50)
              .attr('height',rect_width)
              .attr('fill', (d,i)=>{
                return fakeyClassifiers.includes(d.name)?"lightgrey":"#69b3a2"})
              .attr("opacity","1")  
              .attr('stroke',"black")
              .attr('stroke-width',1)
              .style("text-anchor", "middle")
              .attr("class","rect-classifier")
              
        svg.selectAll("myRectText")
          .data(data)
          .enter().append("text")
              .style("text-anchor", "middle")
              .attr('x',  (-this.margin.left+50)/3)
              .attr("y", (d,i)=>this.width/5+i*(rect_width+2)+rect_width/3*2)
              .attr("class","text-rect-classifier")
              .text((d,i)=>{
                return d.name})
              .style("fill", "black")
              .style("font-size", "18px")
              .on('mouseenter', function(d,i) {
                d3.select(this).attr("fill", "white")
                showHover(d,i)
              })
              .on('mouseleave', function(d,i) {
                d3.select(this).attr("fill", "black")
                removeHover(d,i)
              })


        console.log("parallel data", data)
        const dimensions = d3.keys(data[0]).filter(function(d) { return d!="name" })
        const evaluationMethods = this.evaluationMethods

        var y = {}
        for (var i in dimensions) {
          var name = dimensions[i];
          var lowthreshold = 0;
          if (this.normalization == "Yes") {
              y[name] = d3.scaleLinear()
            //.domain([name == "mcc"? -1 : 0, 1])
            .domain([name == "mcc"? 0 : .5, 1])		// MG - only better than chance
              .range([this.height, 0])
          } else {
            y[name] = d3.scaleLinear()
          .domain([name == "mcc"? -1 : 0, 1])
            // .domain([name == "mcc"? 0 : .5, 1])		// MG - only better than chance
              .range([this.height, 0])
          }
        }
        var x = d3.scalePoint()
          .range([0, this.width])
          .padding(0.5)
          .domain(dimensions);

        function path(d) {
            return d3.line()(dimensions.map(function(p) { return [x(p), y[p](d[p])]; }));
        }


        var curdata = []
        data.forEach(d=>{
            curdata.push(d)
        });
        
        svg
          .selectAll("myPath")
          .data(data)
          .enter().append("path")
          .attr("d",  path)
          .attr("class","parallel-path")
          .attr("id",(d,i)=>d.name)
          .style("fill", "none")
          .style("stroke", (d,i)=>{
            return fakeyClassifiers.includes(d.name)?"grey":"#69b3a2"
            })
          .style("stroke-width", 3)
          .style("opacity", 1)
          .on('mouseenter', function(d,i) {
              showHover(d,i)
            })
            .on('mouseleave', function(d,i) {
              removeHover(d,i)
            })

        // Draw the axis:
        svg.selectAll("myAxis")
          .data(dimensions).enter()
          .append("g")
          .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
          .each(function(d) { d3.select(this).call(d3.axisLeft<d3.AxisDomain>(y[d]).scale(y[d])); })
          .append("text")
            .attr("class","parallel-text")
            .attr("id",(d,i)=>"parallel-text-"+i)
            .style("text-anchor", "middle")
            .attr("y", -9)
            .attr('font-size', 22)
            .text(function(d) { return d; })
            .style("fill", "grey")
            .on("click", (d,i)=>{  
                  this.curclick = [d,i]
                  showSelected(d,i,vueThis)
                  }
            )
        
        if (this.curclick.length ==2) showSelected(this.curclick[0],this.curclick[1],vueThis)
       function showHover(d,i) {
         const allpaths = d3.selectAll('.parallel-path')
                        .style("stroke-width", (m)=>d.name==m["name"]?6:3)
                        .attr("stroke-opacity",(m)=>d.name==m["name"]?"1":"0.2")
         const allRects =  d3.selectAll('.rect-classifier').attr("opacity", (m)=>d.name==m["name"]?"1":"0.2")  //.style("fill",  (m)=>d.name==m.name?"grey":"lightgrey")
         const allRectTexts = d3.selectAll('.text-rect-classifier').attr("opacity", (m)=>d.name==m["name"]?"1":"0.2")//.style("fill", (m)=>d.name==m.name?"white":"black")

       }      

       function removeHover(d,i) {
         const allpaths = d3.selectAll('.parallel-path')
                        .style("stroke-width", 3)
                        .attr("stroke-opacity","1")
         const allRects =  d3.selectAll('.rect-classifier').attr("opacity", "1")
         const allRectTexts = d3.selectAll('.text-rect-classifier').attr("opacity", "1")
          
       }
       function showSelected(d,i,vueThis) {
         const margin = {top: 30, right: 20, bottom: 90, left: 120};
          const width = 1000 - margin.left - margin.right;
          const height = 600 - margin.top - margin.bottom;
          var rect_width = (width-margin.top -margin.bottom) / (2 *(data.length+3))
          const sequentialScale = d3.scaleSequential<string>( d3.interpolateWarm)
            .domain([0, vueThis.classifiers.length-1])
            .interpolator(function (x) { return d3.interpolateWarm(.8*x);} );
		  
          const allpaths = d3.selectAll('.parallel-path');
          const allpathtexts = d3.selectAll('.parallel-text').style("fill", "grey")
                              .style(" font-weight","normal").attr('font-size', 22); 
          const allRects =  d3.selectAll('.rect-classifier')//.attr("opacity", (m)=>d.name==m.name?"1":"0.2")  //.style("fill",  (m)=>d.name==m.name?"grey":"lightgrey")
          const allRectTexts = d3.selectAll('.text-rect-classifier')//.attr("opacity", (m)=>d.name==m.name?"1":"0.2")//.style("fill", (m)=>d.name==m.name?"white":"black")

                      

          const evaluation = dimensions[i]
          var curtops = []
          
          curdata.sort(function(x,y) {
            return  y[evaluation] - x[evaluation]});
          var count = 0;
          while (count < 3) {
            curtops.push(curdata[count].name)
            count += 1;
          }

          var fakeData = curdata.filter(d=>{
            return fakeyClassifiers.includes(d.name)})

          curdata = curdata.filter(d=>{
            return !fakeyClassifiers.includes(d.name)})
          curdata = curdata.concat(fakeData)
          
          console.log("curdata",curdata, fakeData)

          allpathtexts
            .style("fill", function(d,j){
            return i===j?"black":"grey"
            })
            .style("font-weight",function(d,j){
            return i===j?"bold":"normal"
            })
            .attr('font-size', function(d,j){
            return i===j?24:20
            }); 

          var pathColormap = {}
          for (var k in curdata) {
              pathColormap[curdata[k]["name"]] = k
          }
          
          allpaths.style("stroke",(d,i)=>{
            if (fakeyClassifiers.includes(d["name"])) {
              return "grey"
            }
            return sequentialScale(pathColormap[d["name"]])
            });   
          allRects.data(curdata).attr("fill",(d,i)=>{
            if (fakeyClassifiers.includes(d["name"])) {
              return "lightgrey"
            }
            return sequentialScale(pathColormap[d["name"]])
            })
            .attr("y", (d,i)=>width/5+i*(rect_width+2));   
         allRectTexts.data(curdata)
            .style("fill",(d,i)=>{
            if (fakeyClassifiers.includes(d["name"])) {
              return "black"
            }
            return "lightgrey"
            })
            .attr('x',  (-margin.left+35)/3)
            .text((d,i)=>{
                return d.name});
        }

        function continuous(selector_id, colorscale) {
          var legendheight = 40,
              legendwidth = 20,
              margin = {top: 2, right: 2, bottom: 0, left: 10};

          var canvas = d3.select(selector_id)
            .style("height", legendheight + "px")
            .style("width", legendwidth + "px")
            .style("position", "relative")
            .append("canvas")
            .attr("height", legendheight - margin.top - margin.bottom)
            .attr("width", 1)
            .style("height", (legendheight - margin.top - margin.bottom) + "px")
            .style("width", (legendwidth - margin.left - margin.right) + "px")
            .style("border", "1px solid #000")
            .style("position", "absolute")
            .style("top", "120%")
            .style("left", "50%")
            .node();

          var ctx = canvas.getContext("2d");

          var legendscale = d3.scaleLinear()
            .range([1, legendheight - margin.top - margin.bottom])
            .domain(colorscale.domain());

          var image = ctx.createImageData(1, legendheight);
          d3.range(legendheight).forEach(function(i) {
            var c = d3.rgb(colorscale(legendscale.invert(i)));
            image.data[4*i] = c.r;
            image.data[4*i + 1] = c.g;
            image.data[4*i + 2] = c.b;
            image.data[4*i + 3] = 255;
          });
          ctx.putImageData(image, 0, 0);
      };
      }  

      drawParelle()

      const drawTitles = () => {
        svg.append('text')
          .attr('transform', () => {
            const xOffset = this.width / 2.2;
            const yOffset = this.height + this.margin.bottom * 0.8;
            return `translate(${xOffset}, ${yOffset})`;
          })
          .style('text-anchor', 'middle')
          .style('font-size', '24px')
          .text('Evaluation Methods');
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
          .attr('fill', this.wrongColor);
        legend.append('rect')
          .attr('y', height / 2)
          .attr('width', width)
          .attr('height', height / 2)
          .attr('fill', this.rightColor);

        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text('misclassified');
        legend.append('text')
          .attr('transform', `translate(${width / 2}, ${height * 3 / 4})`)
          .attr('font-size', '20px')
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text('correctly classified');
      };
      this.drawSelections();
      
    },
    drawSelections() {
      /*console.log("drw praallel", this.selections)
      const { first, second } = this.selections;

      var curclassifier = first.description.split(" ")[0]
      var curclass = first.description.split(" ")[1]

      console.log(curclassifier, curclass)
      console.log(first.predicate.metric)


      const x_edge = this.width / (this.evaluationMethods.length+2)
      const newEvaluationMethods = ["accuracy","mcc","precision","recall"]
      var path = "M";
      var i = 1
      for (var value in newEvaluationMethods) {
        var num = 0;
        if (newEvaluationMethods[value] == "accuracy") {
          num = first.predicate.metric.right.size / (first.predicate.metric.right.size + first.predicate.metric.wrong.size)
        } else if (newEvaluationMethods[value] == "mcc"){
          num = first.predicate.metric.right.size / (first.predicate.metric.right.size + first.predicate.metric.wrong.size)
        } else if (newEvaluationMethods[value] == "precision"){
          num = first.predicate.metric.tp.size / (first.predicate.metric.tp.size + first.predicate.metric.fp.size)
        } else if (newEvaluationMethods[value] == "recall"){
          num = first.predicate.metric.tp.size / (first.predicate.metric.actual.size)
        } 
        if (isNaN(num)) 
          num = 0;
        path += x_edge * i + "," + this.height * (1-num)+"L"
        //points[classifierName][this.evaluationMethods[value]] = {"x":x_edge*i, "y":this.height * (1-num)} 
        i += 1
      }
      path = path.substring(0, path.length-1)
      console.log(path)
      const chart = d3.select(this.$refs.svg);
      const selectedpath = chart.select('.seleted-path').attr("d", path);
      console.log(selectedpath)*/
      
    },
  },
});
</script>

<style scoped>
.card {
  background-color: white;
}
</style>
