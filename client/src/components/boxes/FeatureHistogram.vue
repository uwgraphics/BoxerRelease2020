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
      <div style="margin: 0px 0px; font-size: 14px; stroke: 'black'; stroke-width:2px; " >
               <v-select v-model="chosenFeature"
                :items="categoryFeatures"
                label="Categorical"
              ></v-select>
      </div>
      <div style="margin: 0px 0px;  font-size: 14px; stroke: 'black'; stroke-width:2px" >
              <v-select v-model="chosenFeature"
                :items="numericFeatures"
                label="Numeric" 
              ></v-select>
           <v-slider 
            class="numberOfBins"
            v-model="numberOfBins"
            :max="binLimits.max"
            :min="binLimits.min"
            :label="`Preferred number of bins: ${numberOfBins}`"
          ></v-slider>
      <div style="margin: 0px 0px; font-size: 14px; stroke: 'black'; stroke-width:2px; " >
               <v-select v-model="chosenFeature"
                :items="classifiers"
                label="ClassifierPredictions"
              ></v-select>
      </div>
      </div>
      <v-radio-group v-model="chosenFeature">
        <v-radio label="ClassDistribution" value="ClassDistribution"></v-radio>
      </v-radio-group>
      </v-expansion-panel-content>
    </v-expansion-panel>
    </v-expansion-panels>
    <v-switch
      v-model="normalization_switch"
      label="normalize"
      class="ml-8"
    ></v-switch>
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
var VueApp: any = Vue;

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
    const hover =  {
      type: null as null | Bin,
      count: -1,
    }; //null as null | Bin;
    const hoverCategory = '';
    const hoverActual = {
      className: '',
    };
    const sorting = '' as ''|'ascending' | 'descending' 


    return {
      numberOfBins: 10,
      binLimits: {
        max: 30,
        min: 1,
      },
      chosenFeature: 'ClassDistribution',
      selected1: '',
      selected2: '',
      categoryFeatures: [],
      sorting,
      height,
      hoverCategory,
      normalization:'No',
      hover,
      hoverActual,
      width,
      margin,
      panel: [],
      panel2: [],
      panel3: [],
      panel4: [],
      selection1Color: '#18FFFF',
      selection2Color: '#FF4081',
      categoricalFeaturesNum:0,
      numericFeaturesNum:0,
    };
  },
  computed: {
    normalization_switch: {
      set() {
        if (this.normalization == "Yes") {
          this.normalization = "No"
        } else {
          this.normalization = "Yes"
        }
      },
      get() {
        return this.normalization === "Yes";
      }
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
    normalizationMode() : String {
      var normalizationMode = ""
      switch (this.normalization) {
        case 'Yes' :
          normalizationMode = "Yes"
          break;
        case 'No' :
          normalizationMode = "No"
          break; 
      }
      return normalizationMode;
    },
    bins(): Array<d3.Bin<string, number>> {
      const bins = d3.histogram<string, number>()
        .domain(this.x.domain() as [number, number])
        //  .thresholds(this.x.ticks(this.numberOfBins))
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
      this.numericFeaturesNum =allFeatures.filter(isNumeric).length 
      let filteredF = allFeatures.filter(isNumeric)
      let finalF = []
      for (var i in filteredF) {
        let cur_dict = { text: filteredF[i], value: filteredF[i] }
        // this.numberFeatures.push(cur_dict);
        finalF.push(cur_dict)
      }
      return finalF//allFeatures.filter(isNumeric);
    },
    bucketedInstances(): {
      [category: string]: Set<string>,
    } {
      if (!this.chosenFeature || !this.categoricalFeatures.includes(this.chosenFeature)) {
        console.log("empty bucketedInstances")
        return {};
      }
      const bucketedInstances: {
        [category: string]: Set<string>,
      } = {};
      if (!this.classifiers.includes(this.chosenFeature)) {
          this.categories.forEach((category) => {
          bucketedInstances[category] = new Set();
        });

        this.instances.forEach((id) => {
          const category = instanceById(id).features[this.chosenFeature];
          if (bucketedInstances[category] === undefined) {
            console.log('undefined category', category);
          }
          bucketedInstances[category].add(id);
        });
        console.log("not empty bucketedInstances",bucketedInstances)
      } else {
        console.log("categories",this.categories)
        this.categories.forEach((category) => {
          bucketedInstances[category] = new Set();
        });
        this.instances.forEach((id) => {
          const category = instanceById(id).predictions[this.chosenFeature];
          if (bucketedInstances[category] === undefined) {
            console.log('undefined category', category);
          }
          bucketedInstances[category].add(id);
        });
        console.log("bucketedInstances",bucketedInstances)

      }
      
      return bucketedInstances;
    },
    categoricalFeatures(): string[] {
      const categoricalFeatures = [...this.boxProps.features].filter((f) => this.$store.getters.feature(f).type === 'categorical');
      this.categoricalFeaturesNum = categoricalFeatures.length;
      for (var i in categoricalFeatures) {
        this.categoryFeatures.push(categoricalFeatures[i])
      }
      for (var i in this.classifiers) {
        //this.categoryFeatures.push(this.classifiers[i])
        categoricalFeatures.push(this.classifiers[i])
      }
      console.log("categoricalFeatures",categoricalFeatures,this.categoryFeatures)
      return categoricalFeatures;
    },
    categories(): string[] {
      if (!this.chosenFeature  || !this.categoricalFeatures.includes(this.chosenFeature)) {
        return [];
      } else {
        var rawData = []
        var nonSort = []
        if (!this.classifiers.includes(this.chosenFeature)) {
          this.$store.getters.feature(this.chosenFeature).categories.forEach((i)=>{
            nonSort.push(i)
            rawData.push(i)
          })
          //console.log("nonSort",nonSort)
          const bucketedinstances: {
            [category: string]: Set<string>,
          } = {};

          rawData.forEach((category) => {
            bucketedinstances[category] = new Set();
          });

          this.instances.forEach((id) => {
            const category = instanceById(id).features[this.chosenFeature];
            bucketedinstances[category].add(id);
          });
          switch (this.sorting) {
            case '':
              return nonSort;
              break;
            case 'ascending':
              rawData.sort(function(x, y){
                return d3.ascending(bucketedinstances[x].size,bucketedinstances[y].size);
              })
              break;
            case 'descending':
              rawData.sort(function(x, y){
                return (bucketedinstances[y].size - bucketedinstances[x].size);
              })
              break;
          }
          console.log("rawData",rawData)
          return rawData;
        } else {
          this.classes.forEach((i)=>{
            nonSort.push(i)
            rawData.push(i)
          })
          const bucketedinstances = {}
          this.classes.forEach((c)=>{
            bucketedinstances[c] = new Set();
          })
         
          this.instances.forEach((id) => {
            const predclass = instanceById(id).predictions[this.chosenFeature];
            bucketedinstances[predclass].add(id);
          });
          switch (this.sorting) {
            case '':
              return nonSort;
              break;
            case 'ascending':
              rawData.sort(function(x, y){
                return d3.ascending(bucketedinstances[x].size,bucketedinstances[y].size);
              })
              break;
            case 'descending':
              rawData.sort(function(x, y){
                return (bucketedinstances[y].size - bucketedinstances[x].size);
              })
              break;
          }
          console.log("rawData",rawData)
          return rawData;
        }
      }
      
    },
     maxByCategory(): number {
      let max = 0;
      if (!this.classifiers.includes(this.chosenFeature)) {
          this.categories.forEach((category) => {
          max = Math.max(max, this.bucketedInstances[category].size);
        });
      } else {
        this.categories.forEach((category) => {
          max = Math.max(max, this.bucketedInstances[category].size);
        });
        // for (var i in this.categories)
      }
      return max;
    },
    bucketKeys(): string[] {
      const totalAscending = (c1: string, c2: string) => {
        return this.buckets[c1].size - this.buckets[c2].size;
      };
      const totalDescending = (c1: string, c2: string) => {
        return -totalAscending(c1, c2);
      };

      const predictionKeys = this.classes;
      switch (this.sorting) {
        case 'ascending':
          predictionKeys.sort(totalAscending);
          break;
        case 'descending':
          predictionKeys.sort(totalDescending);
          break;
      }

      return predictionKeys;
    },
    buckets(): {
      [className: string]: Set<string>,
    } {
      const buckets: {
        [className: string]: Set<string>,
      } = {};

      this.classes.forEach((c) => {
        buckets[c] = new Set();
      });

      this.instances.forEach((id) => {
        const i = instanceById(id);
        buckets[i.actual].add(id);
      });
      return buckets;
    },
    classes(): string[] {
      return [...this.boxProps.classes];
    },
    
    selections(): {
      first: SelectionRecord | null,
      second: SelectionRecord | null,
    } {
      return this.$store.state.overlapSelections;
    },
    showActualClassDistribution() :string{
      var showActualClassDistribution = "No"
            switch (this.chosenFeature) {
              case 'ClassDistribution' :
                showActualClassDistribution = "Yes"
                break;
            }
            return showActualClassDistribution;
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
        .domain([0, this.normalizationMode=="Yes"? 1:1.1 * yMax])
        .range([this.height, 0]);
      return y;
    },
    xCate(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
        .domain(this.categories)
        .range([0, this.width])
        .paddingOuter(0.2)
        .paddingInner(0.3);
      return x;
    },
    yCate(): d3.ScaleLinear<number, number> {
      const yMax =this.maxByCategory;
      const y = d3.scaleLinear()
        .domain([0, this.normalizationMode=="Yes"? 1: 1.1 * yMax])
        .range([this.height, 0]);
      return y;
    },
    xActual(): d3.ScaleBand<string> {
      const x = d3.scaleBand<string>()
        .domain(this.bucketKeys)
        .range([0, this.width])
        .paddingOuter(1)
        .paddingInner(0.3);
      return x;
    },
    yActual(): d3.ScaleLinear<number, number> {
      const bucketSizes = Object.values(this.buckets).map((b: Set<string>) => b.size);
      const yMax = Math.max(...bucketSizes) / this.instances.length;
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
    sorting() {
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
    hoverActual() {
      this.drawHover();
    },
    hoverCategory() {
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
    normalization() {
      this.drawInitial();
    },
    // ActualClassDistribution() {
    //   this.drawInitial();
    // }
  },
  mounted() {
    this.drawInitial();
  },
 methods: {
   clearHover() {
      this.hoverActual = ({ className: '' });
    },
    drawHover() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const barstmp = chart.selectAll('.bar');
      const barstmp2 = chart.selectAll('.bar');
      const barsActual = chart.selectAll('.bar');
      const barstmpcircle = chart.selectAll('.bar-circle');
      const barstmp2circle = chart.selectAll('.bar-circle');

      const textSelection1 = chart.selectAll('.text-selection-1')//.attr("visibility","hidden");
      const textSelection2 = chart.selectAll('.text-selection-2')//.attr("visibility","hidden");

      const barstmprect1 = chart.selectAll('.selection-rect')//.attr("visibility","hidden");//.attr("opacity",0);     
      const barstmprect2 = chart.selectAll('.selection-rect')//.attr("visibility","hidden");//.attr("opacity",0);     
      const barsActualRect = chart.selectAll('.selection-rect')//.attr("visibility","hidden");//.attr("opacity",0);     

      const yAxisMarkerLine = chart.select('.y-axis-marker-line');
      const yAxisMarkerText = chart.select('.y-axis-marker-text');

      const moveDuration = 500;
      const disappearDuration = 1000;

      const { first, second } = this.$store.state.overlapSelections//this.selections;


      const hover = this.hover;
      const hoverCategory = this.hoverCategory;
      if (this.showActualClassDistribution == "Yes") {
          const nameMap = {};
          for (var i in this.bucketKeys) {
            nameMap[ this.bucketKeys[i]] =parseInt (i)
          }
          if (!this.hoverActual.className) {
            barsActual
              .attr('fill', 'lightgray');
            yAxisMarkerLine
              .attr('stroke-opacity', 0);
            yAxisMarkerText
              .attr('fill-opacity', 0);
            barsActualRect
                .attr("visibility","hidden");   
            textSelection1
                .attr("visibility","hidden");  
            textSelection2
                .attr("visibility","hidden");          
          } else {
            barsActual.data(this.bucketKeys)
              .attr('fill', (d: string) =>
                d === this.hoverActual.className
                  ? 'black'
                  : 'lightgray');
            barsActualRect.data(this.bucketKeys)
                .attr('visibility', (d: string) =>
                d === this.hoverActual.className
                  ?  "visible" : "hidden"); 
              if (!first)  {
                  textSelection1.data(this.bucketKeys)
                    .attr("visibility", "hidden");   
              } else {
                textSelection1.data(this.bucketKeys)
                    .attr('transform',`translate(
                    ${ 0},
                    ${this.yActual(this.buckets[this.hoverActual.className].size / this.instances.length) - 45})`)

                    .style('text-anchor', 'middle')        
                    .attr("visibility", (d: string) =>
                      d === this.hoverActual.className? "visible":"hidden");   
              }
              if (!second) {
                  textSelection2.data(this.bucketKeys)
                  .attr("visibility", "hidden"); 
              } else {
                  textSelection2.data(this.bucketKeys) 
                  .attr('transform',`translate(
                    ${ 0},
                    ${this.yActual(this.buckets[this.hoverActual.className].size / this.instances.length) - 20})`)
                  .style('text-anchor', 'middle')        
                  .attr("visibility", (d: string) =>
                      d === this.hoverActual.className? "visible":"hidden");   
              }             
            yAxisMarkerLine
              .attr('stroke-opacity', 1)
              .attr('y1', this.yActual(this.buckets[this.hoverActual.className].size / this.instances.length))
              .attr('x2', this.width)
              .attr('y2', this.yActual(this.buckets[this.hoverActual.className].size / this.instances.length));
            
            console.log("this.bucketKeys",this.hoverActual.className,this.xActual(this.hoverActual.className))
            yAxisMarkerText
              .attr('fill-opacity', 1)
              .attr('transform',`translate(
                ${ this.xActual(this.hoverActual.className)},
                ${this.yActual(this.buckets[this.hoverActual.className].size / this.instances.length) - 70})`)
              .text("Percentage: "+`${(this.buckets[this.hoverActual.className].size / this.instances.length * 100).toFixed(1)}%`);

          } 
      } else {
          if (!this.categoricalFeatures.includes(this.chosenFeature)) {
            if (!hover) {
              barstmp
                .attr('fill', 'lightgray');
              barstmpcircle
                .attr('fill', 'lightgray');  
              yAxisMarkerLine
                .attr('stroke-opacity', 0);
              yAxisMarkerText
                .text('');
              barstmprect1
                .attr("visibility","hidden"); 
              textSelection1
                .attr("visibility","hidden");  
              textSelection2
                .attr("visibility","hidden");      
            } else {
              barstmp.data(this.bins)
                .attr('fill', (d: Bin) => d.x0 === hover.x0 ? 'black' : 'lightgray');
              barstmpcircle.data(this.bins)
                .attr('fill', (d: Bin) => d.x0 === hover.x0 ? 'black' : 'lightgray');  
              if (!first)  {
                  textSelection1.data(this.bins)
                    .attr("visibility", "hidden");   
              } else {
                textSelection1.data(this.bins)
                    .attr('transform', this.normalizationMode != "Yes"? `translate(
                      ${-50},
                      ${this.y(hover.length) - 45})`
                      :hover.length==0?`translate(
                      ${-50},
                      ${this.y(0) - 45})`
                      :
                      `translate(
                      ${-50},
                      ${this.y(1) - 45})`
                      )
                    .style('text-anchor', 'middle')        
                    .attr("visibility", (d: Bin) => d.x0 === hover.x0 ? "visible":"hidden");   
              }
              if (!second) {
                  textSelection2.data(this.bins)
                  .attr("visibility", "hidden"); 
              } else {
                  textSelection2.data(this.bins)
                  .attr('transform', this.normalizationMode != "Yes"? `translate(
                  ${-50},
                  ${this.y(hover.length) - 20})`
                  :hover.length==0?`translate(
                  ${-50},
                  ${this.y(0) - 20})`
                  :
                  `translate(
                  ${-50},
                  ${this.y(1) - 20})`
                  )
                  .style('text-anchor', 'middle')        
                  .attr("visibility", (d: Bin) => d.x0 === hover.x0 ? "visible":"hidden"); 
              }
              barstmprect1.data(this.bins)
                .attr('visibility', (d: Bin) => d.x0 === hover.x0 ? "visible" : "hidden");  
              yAxisMarkerLine
                .attr('stroke-opacity', 1)
                .attr('y1', this.normalizationMode != "Yes"? this.y(hover.length)
                        :hover.length==0?this.y(0): this.y(1))
                .attr('x2', this.width)
                .attr('y2', this.normalizationMode != "Yes"? this.y(hover.length)
                        :hover.length==0?this.y(0): this.y(1));

              yAxisMarkerText
                .attr('transform', this.normalizationMode != "Yes"? `translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(hover.length) - 70})`
                  :hover.length==0?`translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(0) - 70})`
                  :
                  `translate(
                  ${(this.x(hover.x0 as number) + this.x(hover.x1 as number)) / 2-0.5*(this.x(hover.x1 as number)-this.x(hover.x0 as number))-50},
                  ${this.y(1) - 70})`
                  )
                .text(this.normalizationMode != "Yes"?"Total: "+ hover.length
                    :hover.length==0?"Total: "+0:"Total: "+1 );

            }
          } else {
              console.log("categoryhover",!hoverCategory.toString().length)
              if (!hoverCategory.toString().length ){
                barstmp2   
                  .attr('fill', 'lightgray');
                barstmp2circle     
                  .attr('fill', 'lightgray');  
                yAxisMarkerLine
                  .attr('stroke-opacity', 0);
                yAxisMarkerText
                  .text('');
                barstmprect2
                  .attr("visibility","hidden");  
                textSelection1
                  .attr("visibility","hidden");  
                textSelection2
                  .attr("visibility","hidden");       
            } else {
              barstmp2.data(this.categories)
                .attr('fill', (d: string) => d === hoverCategory ? 'black' : 'lightgray');
              barstmp2circle.data(this.categories)
                .attr('fill', (d: string) => d === hoverCategory ? 'black' : 'lightgray');  
              if (!first)  {
                  textSelection1.data(this.categories)
                    .attr("visibility", "hidden");   
              } else {
                  textSelection1.data(this.categories)
                    .attr('transform', this.normalizationMode != "Yes"?`translate(
                    ${0},
                    ${this.yCate(this.bucketedInstances[hoverCategory].size) - 45})`
                    :this.bucketedInstances[hoverCategory].size==0?
                    `translate(
                    ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                    ${this.yCate(0) - 45})`
                    :
                    `translate(
                    ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                    ${this.yCate(1) - 45})`
                    )
                    .style('text-anchor', 'middle')        
                    .attr("visibility",(d: string) => d === hoverCategory ? "visible":"hidden");     
              }
              if (!second) {
                  textSelection2.data(this.categories)
                  .attr("visibility", "hidden"); 
              } else {
                  textSelection2.data(this.categories)
                    .attr('transform', this.normalizationMode != "Yes"?`translate(
                    ${0},
                    ${this.yCate(this.bucketedInstances[hoverCategory].size) - 20})`
                    :this.bucketedInstances[hoverCategory].size==0?
                    `translate(
                    ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                    ${this.yCate(0) - 20})`
                    :
                    `translate(
                    ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                    ${this.yCate(1) - 20})`
                    )
                    .style('text-anchor', 'middle')        
                    .attr("visibility", (d: string) => d === hoverCategory ?  "visible":"hidden");
              }   
              barstmprect2.data(this.categories)
                .attr('visibility', (d: string) => d === hoverCategory ?  "visible" : "hidden");     
              yAxisMarkerLine
                .attr('stroke-opacity', 1)
                .attr('y1', this.normalizationMode != "Yes"?this.yCate(this.bucketedInstances[hoverCategory].size)
                        :this.bucketedInstances[hoverCategory].size==0?this.yCate(0)
                        :this.yCate(1))
                            .attr('x2', this.width)
                .attr('y2', this.normalizationMode != "Yes"? this.yCate(this.bucketedInstances[hoverCategory].size)
                        :this.bucketedInstances[hoverCategory].size==0?
                        this.yCate(0): this.yCate(1) );
              yAxisMarkerText
                .attr('transform', this.normalizationMode != "Yes"?`translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number)  },
                  ${this.yCate(this.bucketedInstances[hoverCategory].size) - 70})`
                  :this.bucketedInstances[hoverCategory].size==0?
                  `translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                  ${this.yCate(0) - 70})`
                  :
                  `translate(
                  ${this.xCate.paddingOuter() + (this.xCate(hoverCategory) as number) },
                  ${this.yCate(1) - 70})`
                  )
                .text(this.normalizationMode != "Yes"?"Total: "+this.bucketedInstances[hoverCategory].size: this.bucketedInstances[hoverCategory].size==0?"Total: "+0:"Total: "+1 );
                }
          }
      }
      
      
    },
    drawHoverExternal() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const barstmp = chart.selectAll('.bar');
      const barstmp2 = chart.selectAll('.bar');
      const barsActual = chart.selectAll('.bar');
      const barstmpcircle = chart.selectAll('.bar-circle');
      const barstmp2circle = chart.selectAll('.bar-circle');


      if (this.showActualClassDistribution == "Yes") {
          if (this.externalHoverInstance) {
            barsActual.data(this.bucketKeys)
              .attr('fill', (d: string) =>
                this.buckets[d].has(this.externalHoverInstance)
                  ? 'black'
                  : 'lightgray');
          } else {
            barsActual
              .attr('fill', 'lightgray');
          }
      } else {
            if (!this.categoricalFeatures.includes(this.chosenFeature)) {
            if (!this.externalHoverInstance) {
              barstmp
                .attr('fill', 'lightgray');
              barstmpcircle
                .attr('fill', 'lightgray');  
            } else {
              barstmp.data(this.bins)
                .attr('fill', (d: Bin) =>
                  d.includes(this.externalHoverInstance)
                  ? 'black'
                  : 'lightgray');
              barstmpcircle.data(this.bins)
                .attr('fill', (d: Bin) =>
                  d.includes(this.externalHoverInstance)
                  ? 'black'
                  : 'lightgray');    
            }
          } else {
            if (!this.externalHoverInstance) {
              barstmp2
                .attr('fill', 'lightgray');
              barstmp2circle
                .attr('fill', 'lightgray');  
            } else {
              barstmp2.data(this.categories)
                .attr('fill', (d: string) =>
                  this.bucketedInstances[d].has(this.externalHoverInstance)
                  ? 'black'
                  : 'lightgray');
              barstmp2circle.data(this.categories)
                .attr('fill', (d: string) =>
                  this.bucketedInstances[d].has(this.externalHoverInstance)
                  ? 'black'
                  : 'lightgray');    
            }
          }
      }
      
     
    },
    drawInitial() {
      // @ts-ignore
      console.log("drwa new",this.bins)
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

      const xActual = this.xActual;
      const yActual= this.yActual;

      const drawAxes = () => {
        const xAxistmp = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(this.x)
              .tickSizeOuter(0),
          );
        const xAxistmp2 = (g: any) => g
            .attr('transform', `translate(${0}, ${this.height})`)
            .call(
              d3.axisBottom(this.xCate)
                .tickSizeOuter(0),
            );  
        const yAxistmp =  (g: any) => g
            .call(
              d3.axisLeft(this.y),
            );
        const yAxistmp2 =  (g: any) => g
            .call(
              d3.axisLeft(this.yCate),
            );

        const xAxis = (g: any) => g
          .attr('transform', `translate(${0}, ${this.height})`)
          .call(
            d3.axisBottom(xActual)
              .tickSizeOuter(0),
          );



        const yAxis = (g: any) => g
          .call(d3.axisLeft(yActual)
            .ticks(5)
            .tickFormat(d3.format('.0%')),
          );

        
        if (this.showActualClassDistribution=="Yes") {
          svg.append('g')
            .call(xAxis)
            .attr('font-size', 20);
          svg.append('g')
            .call(yAxis)
            .attr('font-size', 20);
        }  else {
              if (!this.categoricalFeatures.includes(this.chosenFeature)){
                svg.append('g')
                  .call(xAxistmp);
                svg.append('g')
                  .call(yAxistmp);  
            } else {
              svg.append('g')
                  .call(xAxistmp2);
              svg.append('g')
                  .call(yAxistmp2);   
            }
        }     
        
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
          .text(this.normalizationMode=="Yes"?'Percentage of Instances'
              :this.showActualClassDistribution == "Yes"?'Percentage of Instances':'Number of instances');


        var showtext = this.normalizationMode=="Yes"?`Percentage of Instances (${this.chosenFeature})`
            :`Number of Instances (${this.chosenFeature}):`
        if (this.showActualClassDistribution == "Yes") {
          showtext = this.normalizationMode=="Yes"?`Percentage of Instances per Class`
            :`Percentage of Instances per Class`
        }    

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
          .text(showtext);
      };
      drawTitles();

      const translateCelltmp = (bin: Bin) => {
        const xOffset = this.x(bin.x0 as number) + 1;
        return `translate(${xOffset}, 0)`;
      };
      const translateCelltmp2  = (category: string) => {
          const xOffset = this.xCate(category);
          return `translate(${xOffset}, 0)`;
        };


      const barDescriptiontmp = (bin: Bin): string => {
        return `Instances with feature '${this.chosenFeature}' in range [${bin.x0},${bin.x1})`;
      };
      const barDescriptiontmp2  = (category: string): string => {
        return `Instances with feature '${this.chosenFeature}' equal to '${category}')`;
      };
      
      const cellstmp = svg.selectAll('.celltmp')
        .data(this.bins)
        .join('g')
          .attr('class', 'celltmp')
          .attr('transform', (d: Bin) => translateCelltmp(d))
          .on('mouseenter', (d: Bin) => this.hover = d)
          .on('mouseleave', (d: Bin) => this.hover = null)
          .on('click', (d: Bin) => this.selecttmp(d, 'first'))
          .on('contextmenu', (d: Bin) => this.selecttmp(d, 'second'));
      const  cellstmp2 = svg.selectAll('.celltmp2')
        .data(this.categories)
        .join('g')
          .attr('class', 'celltmp2')
          .attr('transform', (d: string) => translateCelltmp2(d))
          .on('mouseenter', (d: string) => this.hoverCategory = d)
          .on('mouseleave', (d: string) => this.hoverCategory = '')
          .on('click', (d: string) => this.selecttmp2(d, 'first'))
          .on('contextmenu', (d: string) => this.selecttmp2(d, 'second'));
      const cells = svg.selectAll('.cell')
          .data(this.bucketKeys)
          .join('g')
            .attr('class', 'cell')
            .attr('transform', (d: string) => {
              console.log(xActual(d),d)
              return `translate(${xActual(d)}, ${0})`});    
      

      const x = this.x;
      const y = this.y;
      const xCate = this.xCate;
      const yCate = this.yCate;
      const barWidthtmp = (bin: Bin) => x((bin.x1 as number)) - x((bin.x0 as number));
      const barYOffsettmp = (bin: Bin) => this.normalizationMode!="Yes"? this.y(bin.length) : bin.length==0?this.y(0):this.y(1) ;
      const barHeighttmp = (bin: Bin) => this.height - barYOffsettmp(bin);
      const  barWidthtmp2 = xCate.bandwidth();
      const  barYOffsettmp2  = (category: string) =>  this.normalizationMode!="Yes"? this.yCate(this.bucketedInstances[category].size):this.bucketedInstances[category].size==0?this.yCate(0): this.yCate(1);
      const  barHeighttmp2 = (category: string) => this.height - barYOffsettmp2(category);

      const drawBars = () => {
        if (this.showActualClassDistribution == "Yes") {
          const barWidth = xActual.bandwidth();
          cells.append('rect')
            .attr('class', 'bar')
            .attr('y', (d: string) => yActual(this.buckets[d].size / this.instances.length))
            .attr('width', barWidth)
            .attr('height', (d: string) => this.height - yActual(this.buckets[d].size / this.instances.length))
            .attr('fill', 'lightgray')
            .attr('stroke', 'black')
            .style('paint-order', 'stroke')
            .on('mouseenter', (d: string) => this.hoverActual = ({ className: d }))
            .on('mouseleave', this.clearHover)
            .on('click', (d: string) => this.select(d, 'first'))
            .on('contextmenu', (d: string) => this.select(d, 'second'));
          cells.append("circle") 
                    .attr('cx', barWidth/2)
                    .attr('cy', d => this.height-15)
                    .attr('r','15px')
                    .style('fill', 'lightgray')
                    .attr('stroke', 'grey')
                    .attr("visibility", (d:string) => {
                      return yActual(this.buckets[d].size / this.instances.length) == 0?"hidden": (this.buckets[d].size / this.instances.length) > 0.05? "hidden":"visible"
                      })
                      .on('click', (d: string) => this.select(d, 'first'))
                    .on('contextmenu', (d: string) => this.select(d, 'second'));
          cells.append('rect')
                .attr('class', 'selection-rect').attr('y', (d: string) => yActual(this.buckets[d].size / this.instances.length)-90)
                .attr('x',  -1 * 100)
                  .attr('width', 200)
                  .attr('height', 80)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '1px')
                  .attr('fill', 'white')
                  .attr("visibility","hidden");            
        } else {
                if (!this.categoricalFeatures.includes(this.chosenFeature)){
                cellstmp.append('rect')
                .attr('class', 'bar').attr('y', (d: Bin) => barYOffsettmp(d))
                  .attr('width', (d: Bin) => barWidthtmp(d))
                  .attr('height', (d: Bin) => barHeighttmp(d))
                  .attr('stroke', 'black')
                  .attr('stroke-width', '0.5px')
                  .attr('fill', 'lightgray');
                cellstmp.append("circle")   
                  .attr('class', 'bar-circle').attr('cx',(d: Bin) => barWidthtmp(d) / 2 )
                  .attr('cy', (d: Bin) =>  barWidthtmp(d) / 15 > 15 ? this.height - barWidthtmp(d) / 15 : this.height - 15)
                  .attr('r',(d: Bin) => barWidthtmp(d) / 15 > 15 ? barWidthtmp(d) / 15 : 15)
                  .attr("visibility",(d: Bin) => barHeighttmp(d)/ this.height == 0? "hidden"
                        : barHeighttmp(d)/ this.height>0.1? "hidden":"visible")
                  .style('fill', 'lightgray')    
                  .attr('stroke', 'grey')  

                cellstmp.append('rect')
                .attr('class', 'selection-rect').attr('y', (d: Bin) => barYOffsettmp(d)-90)
                .attr('x', -120)//(d: Bin) => -1 * barWidthtmp(d))
                  .attr('width', 140)//(d: Bin) => 2 * barWidthtmp(d))
                  .attr('height', 80)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '1px')
                  .attr('fill', 'white')
                  .attr("visibility","hidden");    
              } else {
                cellstmp2.append('rect')
                .attr('class', 'bar').attr('y', (d: string) => barYOffsettmp2(d))
                  .attr('width', (d: string) => barWidthtmp2)
                  .attr('height', (d: string) => {
                    return barHeighttmp2(d)})
                  .attr('stroke', 'black')
                  .attr('stroke-width', '0.5px')
                  .attr('fill', 'lightgray');
                cellstmp2.append("circle")   
                  .attr('class', 'bar-circle').attr('cx', (d: string) => barWidthtmp2 / 2)
                  .attr('cy', (d: string) =>  {
                    if (this.normalizationMode=="Yes") {
                      if (barWidthtmp2 / 15 > 15) return this.height - barWidthtmp2 / 15 
                      else return this.height - 15
                    } else {
                      if (barWidthtmp2 / 15 > 15) return yCate(1) - barWidthtmp2 / 15
                      else return  yCate(1) - 15
                    }
                    })
                  .attr('r',(d: string) => barWidthtmp2 / 15 > 15?  barWidthtmp2 / 15 : 15)
                  .attr("visibility",(d: string) => barHeighttmp2(d)/ this.height == 0? "hidden"//:"visible")
                        : barHeighttmp2(d)/ this.height>0.1? "hidden":"visible")
                  .style('fill', 'lightgray')    
                cellstmp2.append('rect')
                .attr('class', 'selection-rect').attr('y', (d: string) => barYOffsettmp2(d)-90)
                .attr('x', (d: string) => -70)
                  .attr('width', 140)
                  .attr('height', 80)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '1px')
                  .attr('fill', 'white')
                  .attr("visibility","hidden");    
                
              }    
        }

         
      };
      const selections = () => {
          const selectionBarWidth = (d: Bin) => barWidthtmp(d) / 8;
          const selectionBarWidth2 = barWidthtmp2 / 8;
          if (this.showActualClassDistribution == "Yes") {
            const barWidth = xActual.bandwidth();
            const selectionBarWidthActual = barWidth / 8;
            cells.append('rect')
              .attr('class', 'bar-selection-1')
              .attr('x', barWidth / 2 - selectionBarWidthActual)
              .attr('width', selectionBarWidthActual)
              .attr('fill', this.selection1Color)
              .attr('stroke', 'black')
              .attr('stroke-width', '2px')
              .attr('pointer-events', 'none');
            cells.append('rect')
              .attr('class', 'bar-selection-2')
              .attr('x', barWidth / 2)
              .attr('width', selectionBarWidthActual)
              .attr('fill', this.selection2Color)
              .attr('stroke', 'black')
              .attr('stroke-width', '2px')
              .attr('pointer-events', 'none');


            cells.append("circle")   
              .attr('class', 'circle-selection-1')
              .attr('cx', barWidth / 2 - selectionBarWidthActual / 2)
              .attr('cy', this.height-selectionBarWidthActual / 2)
              .attr('r',selectionBarWidthActual / 2)
              .style('fill', this.selection1Color)
              .attr('stroke', 'grey')
            cells.append("circle")   
              .attr('class', 'circle-selection-2')
              .attr('cx', barWidth / 2 + selectionBarWidthActual / 2)
              .attr('cy', this.height-selectionBarWidthActual / 2)
              .attr('r',selectionBarWidthActual / 2)
              .style('fill', this.selection2Color)
              .attr('stroke', 'grey')

            cells.append("text")   
                  .attr('text-anchor', 'middle')
                  .attr('font-size', 24)
                  .attr('class', 'text-selection-1')
                  //.attr('x',  0)
                  .attr('fill', "steelblue")
                  .attr("visibility","hidden")
           cells.append("text")   
                  .attr('font-size', 24)
                  .attr('class', 'text-selection-2')
                  //.attr('x',  0)
                  .attr('fill', "red")
                  .attr("visibility","hidden")  
          } else {
                if (!this.categoricalFeatures.includes(this.chosenFeature)) {
                cellstmp.append('rect')
                  .attr('class', 'bar-selection-1')
                  .attr('x', (d: Bin) => barWidthtmp(d) / 2 - selectionBarWidth(d))
                  .attr('width', (d: Bin) => selectionBarWidth(d))
                  .attr('fill', this.selection1Color)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '2px')
                cellstmp.append('rect')
                  .attr('class', 'bar-selection-2')
                  .attr('x', (d: Bin) => barWidthtmp(d) / 2)
                  .attr('width', (d: Bin) => selectionBarWidth(d))
                  .attr('fill', this.selection2Color)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '2px')
                cellstmp.append("circle")   
                .attr('class', 'circle-selection-1')  .attr('cx',(d: Bin) => barWidthtmp(d) / 2 - selectionBarWidth(d) / 2)
                  .attr('cy', (d: Bin) => this.height - selectionBarWidth(d) / 2)
                  .attr('r',(d: Bin) => selectionBarWidth(d) / 2)
                  .style('fill', this.selection1Color) 
                  .attr('stroke', 'grey') 
                cellstmp.append("circle")   
                .attr('class', 'circle-selection-2') .attr('cx', (d: Bin) => barWidthtmp(d) / 2  + selectionBarWidth(d) / 2)
                  .attr('cy', (d: Bin) => this.height - selectionBarWidth(d) / 2)
                  .attr('r',(d: Bin) => selectionBarWidth(d) / 2)
                  .style('fill', this.selection2Color)     
                  .attr('stroke', 'grey')  
                
                cellstmp.append("text")   
                  .attr('text-anchor', 'middle')
                  .attr('font-size', 24)
                  .attr('class', 'text-selection-1')
                  .attr('x', (d: Bin) => 0)
                  .attr('fill', "steelblue")
                  .attr("visibility","hidden")
                cellstmp.append("text")   
                  .attr('font-size', 24)
                  .attr('class', 'text-selection-2')
                  .attr('x', (d: Bin) => 0)
                  .attr('fill', "red")
                  .attr("visibility","hidden")

              }  else {
                cellstmp2.append('rect')
                .attr('class', 'bar-selection-1')
                .attr('x', (d: string) => barWidthtmp2 / 2 - selectionBarWidth2)
                  .attr('width', (d: string) => selectionBarWidth2)
                  .attr('fill', this.selection1Color)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '2px')
                  
                cellstmp2.append('rect')
                .attr('class', 'bar-selection-2').attr('x', (d: string) => barWidthtmp2 / 2)
                  .attr('width', (d: string) => selectionBarWidth2)
                  .attr('fill', this.selection2Color)
                  .attr('stroke', 'black')
                  .attr('stroke-width', '2px')
                
                cellstmp2.append("circle")   
                .attr('class', 'circle-selection-1')  .attr('cx',(d: string) => barWidthtmp2 / 2 - 0.5*selectionBarWidth2)
                  .attr('cy', (d: string) =>  {
                  if (this.normalizationMode=="Yes") {
                    if (barWidthtmp2 / 15 > 15) return this.height - 10
                    else return this.height - 10
                  } else {
                    if (barWidthtmp2 / 15 > 15) return yCate(1) - 10
                    else return  yCate(1) - 10
                  }
                  })
                  .attr('r','10px')
                  .style('fill', this.selection1Color) 
                
                cellstmp2.append("circle")   
                .attr('class', 'circle-selection-2').attr('cx',(d: string) => barWidthtmp2 / 2 + 0.5*selectionBarWidth2)
                  .attr('cy', (d: string) =>  {
                  if (this.normalizationMode=="Yes") {
                    if (barWidthtmp2 / 15 > 15) return this.height - 10
                    else return this.height - 10
                  } else {
                    if (barWidthtmp2 / 15 > 15) return yCate(1) - 10
                    else return  yCate(1) - 10
                  }
                  })
                  .attr('r','10px')
                  .style('fill', this.selection2Color)   
                  
                
                cellstmp2.append("text")   
                  .attr('text-anchor', 'middle')
                  .attr('font-size', 24)
                  .attr('class', 'text-selection-1')
                  .attr('x', (d: string) => 0 )
                  .attr('fill', "steelblue")
                  .attr("visibility","hidden")
                cellstmp2.append("text")   
                  .attr('font-size', 24)
                  .attr('class', 'text-selection-2')
                  .attr('x', (d: string) => 0 )
                  .attr('fill',"red")
                  .attr("visibility","hidden")

              }
          }
          
        };
      const yAxisMarkerLine = () => {
        if (this.showActualClassDistribution == "Yes") {
          svg.append('line')
          .attr('class', 'y-axis-marker-line')
          .attr('y1', yActual(1))
          .attr('x2', this.width)
          .attr('y2', yActual(1))
          .attr('stroke', 'red')
          .attr('stroke-width', '2px')
          .attr('stroke-opacity', 0)
          .attr('pointer-events', 'none');
        } else {
            if (!this.categoricalFeatures.includes(this.chosenFeature)){
            svg.append('line')
              .attr('class', 'y-axis-marker-line')
              .attr('y1', y(1))
              .attr('x2', this.width)
              .attr('y2', y(1))
              .attr('stroke', 'red')
              .attr('stroke-width', '2px')
              .attr('stroke-opacity', 0)
              .attr('pointer-events', 'none');
          } else {
            svg.append('line')
              .attr('class', 'y-axis-marker-line')
              .attr('y1', yCate(1))
              .attr('x2', this.width)
              .attr('y2', yCate(1))
              .attr('stroke', 'red')
              .attr('stroke-width', '2px')
              .attr('stroke-opacity', 0)
              .attr('pointer-events', 'none');
          }
        }
         
      };
      const yAxisMarkerText = () => {
        svg.append('text')
          .attr('class', 'y-axis-marker-text')
          .attr('text-anchor', 'middle')
          .attr('font-size', 20)
          .attr('pointer-events', 'none');
      };
      // rect-selection
      // yAxisMarkeRect();
      yAxisMarkerLine();
      yAxisMarkerText();
      drawBars();
      selections();

      this.drawHover();
      this.drawHoverExternal();
      this.drawSelections();
    },
   
    drawSelections() {
      // @ts-ignore
      const chart = d3.select(this.$refs.svg);
      const barSelection1 = chart.selectAll('.bar-selection-1');
      const barSelection2 = chart.selectAll('.bar-selection-2');

      const circleSelection1 = chart.selectAll('.circle-selection-1');
      const circleSelection2 = chart.selectAll('.circle-selection-2');

      const textSelection1 = chart.selectAll('.text-selection-1');
      const textSelection2 = chart.selectAll('.text-selection-2');

      const { first, second } = this.selections;
      var formatDecimal = d3.format(".0f")
      if (this.normalizationMode=="Yes") {
        formatDecimal = d3.format(".3f")
      }

      const rightYOffset = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        const fractionOfTotalInstances = overlappingInstances.size / this.instances.length;
        return this.yActual(fractionOfTotalInstances);
      };
      const rightHeight = (instances: Set<string>, selection: Set<string>) => {
        return this.height - rightYOffset(instances, selection);
      };
      const yOffset = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        if (!this.categoricalFeatures.includes(this.chosenFeature)) 
          return this.normalizationMode=="Yes"? this.y(overlappingInstances.size / (instances.size)) : this.y(overlappingInstances.size);
         else 
          return this.normalizationMode=="Yes"? this.yCate(overlappingInstances.size /(instances.size)) : this.yCate(overlappingInstances.size);
      };
      const height = (instances: Set<string>, selection: Set<string>) => {
          return this.height - yOffset(instances, selection);
      };
      const yText = (instances: Set<string>, selection: Set<string>) => {
        const overlappingInstances = intersection(instances, selection);
        if (!this.categoricalFeatures.includes(this.chosenFeature)) 
          return this.normalizationMode=="Yes"? (overlappingInstances.size / (instances.size)) :(overlappingInstances.size);
         else 
          return this.normalizationMode=="Yes"? (overlappingInstances.size /(instances.size)) : (overlappingInstances.size);
      };
      
      
      if (this.showActualClassDistribution=="Yes") {
        if (!first) {
          barSelection1.attr('height', '0');
          circleSelection1.attr("visibility","hidden")
          textSelection1.attr("visibility","hidden")
        } else {
          barSelection1
            .data(this.bucketKeys)
            .attr('y', (d: number) => rightYOffset(this.buckets[d], first.instances))
            .attr('height', (d: number) => rightHeight(this.buckets[d], first.instances));

          circleSelection1
            .data(this.bucketKeys)
            .attr("visibility", (d:number) => {
                      return rightHeight(this.buckets[d], first.instances) == 0?"hidden"
                      :rightHeight(this.buckets[d], first.instances) / this.height >0.05?"hidden":"visible"
                      })
          textSelection1
                  .data(this.bucketKeys)
                  //.attr('y', (d: number) => rightYOffset(this.buckets[d], first.instances)-10)
                  .text( (d: number) => "1st: "+formatDecimal(yText(this.buckets[d], first.instances)))            

        }

        if (!second) {
          barSelection2.attr('height', '0');
          circleSelection2.attr("visibility","hidden")
          textSelection2.attr("visibility","hidden")
        } else {
          barSelection2
            .data(this.bucketKeys)
            .attr('y', (d: number) => rightYOffset(this.buckets[d], second.instances))
            .attr('height', (d: number) => rightHeight(this.buckets[d], second.instances));

          circleSelection2
            .data(this.bucketKeys)
            .attr("visibility", (d:number) => {
                      return rightHeight(this.buckets[d], second.instances) == 0?"hidden"
                      :rightHeight(this.buckets[d], second.instances) / this.height >0.05?"hidden":"visible"
                      })
          textSelection2
                  .data(this.bucketKeys)
                  //.attr('y',  (d: number) => rightYOffset(this.buckets[d], second.instances)-10)
                  .text( (d: number) => "2rd: "+formatDecimal(yText(this.buckets[d], second.instances)))               
        }
      } else {
            if (!first) {
            barSelection1.attr('height', 0);
            circleSelection1.attr("visibility","hidden").text("")
            textSelection1.attr("visibility","hidden")
          } else {
            if (!this.categoricalFeatures.includes(this.chosenFeature)) {
                barSelection1
                  .data(this.bins)
                  .attr('y', (d: Bin) => yOffset(new Set(d), first.instances))
                  .attr('height', (d: Bin) => height(new Set(d), first.instances));
              circleSelection1
                  .data(this.bins)
                  .attr("visibility", (d:Bin) => {
                          if (!isNaN(parseInt(formatDecimal(yText(new Set(d), first.instances))))){
                            return height(new Set(d), first.instances)== 0?"hidden"
                              :height(new Set(d), first.instances) / this.height>0.05?"hidden":"visible"
                          }
                            else return "hidden"
                            })    
              textSelection1
                  .data(this.bins)
                  //.attr('y', (d: Bin) => yOffset(new Set(d), first.instances)-10)
                  .text( ((d: Bin) => "1st: "+formatDecimal(yText(new Set(d), first.instances))))
                              
            } else {
                barSelection1
                .data(this.categories)
                .attr('y', (d: string) => yOffset(this.bucketedInstances[d], first.instances))
                .attr('height', (d: string) => height(this.bucketedInstances[d], first.instances));

              circleSelection1
                .data(this.categories)
                .attr("visibility", (d:number) => {
                          if (!isNaN(parseInt(formatDecimal(yText(this.bucketedInstances[d], first.instances))))) {
                            return height(this.bucketedInstances[d], first.instances) == 0?"hidden"
                            :height(this.bucketedInstances[d], first.instances) / this.height>0.05?"hidden":"visible"
                          }
                          else return "hidden"
                          })  
              textSelection1
                .data(this.categories)
                //.attr('y', (d: string) => yOffset(this.bucketedInstances[d], first.instances)-10)
                .text((d: string) =>"1st: "+ formatDecimal(yText(this.bucketedInstances[d], first.instances)))
                    
            }
          }
          if (!second) {
            barSelection2.attr('height', 0);
            circleSelection2.attr("visibility","hidden")
            textSelection2.attr("visibility","hidden").text("")
          } else {
            if (!this.categoricalFeatures.includes(this.chosenFeature))  {
                barSelection2
                  .data(this.bins)
                  .attr('y', (d: Bin) => yOffset(new Set(d), second.instances))
                  .attr('height', (d: Bin) => height(new Set(d), second.instances));
                circleSelection2
                  .data(this.bins)
                  .attr("visibility", (d:Bin) => {
                          if (!isNaN(parseInt( formatDecimal(yText(new Set(d), second.instances))))) {
                            return height(new Set(d), second.instances)== 0?"hidden"
                              :height(new Set(d), second.instances) / this.height>0.05?"hidden":"visible"
                          } else return "hidden"
                          })    
                textSelection2
                  .data(this.bins)
                  //.attr('y', (d: Bin) => yOffset(new Set(d), second.instances)-10)
                  .text((d: Bin) => "2rd: "+formatDecimal(yText(new Set(d), second.instances)))          
            } else {
                barSelection2
                  .data(this.categories)
                  .attr('y', (d: string) => yOffset(this.bucketedInstances[d], second.instances))
                  .attr('height', (d: string) => height(this.bucketedInstances[d], second.instances));

                circleSelection2
                  .data(this.categories)
                  .attr("visibility", (d:number) => {
                          if ( !isNaN(parseInt(formatDecimal(yText(this.bucketedInstances[d], second.instances))))) {
                            return height(this.bucketedInstances[d], second.instances) == 0?"hidden"
                              :height(this.bucketedInstances[d], second.instances) / this.height>0.05?"hidden":"visible"
                          } else return "hidden"
                  })  
                textSelection2
                  .data(this.categories)
                  //.attr('y', (d: string) => yOffset(this.bucketedInstances[d], second.instances)-10)
                  .text((d: string) => "2rd: "+formatDecimal(yText(this.bucketedInstances[d], second.instances)))                  
            }
          }
      }
      
    },
    selecttmp(
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
    selecttmp2(
      d: string,
      whichOverlap: 'first' | 'second',
    ) {
      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.FEATURE_EQ;
      constraint.feature = this.chosenFeature;
      constraint.value = d;

      const instances = this.bucketedInstances[d];
      const description = `Instances with feature '${this.chosenFeature}' equal to '${d}')`;
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric:[],
      };
      const payload = {
        description,
        instances,
        predicate,
      };

      this.$store.dispatch('prependToSelectionHistory', payload);
      this.$store.dispatch('setToMostRecentSelection', whichOverlap);
    },
    select(
      className: string,
      whichOverlap: 'first' | 'second',
    ) {

      d3.event.preventDefault();
      d3.event.stopPropagation();

      const constraint = blankConstraint();
      constraint.rule = Rule.ACTUAL;
      constraint.target = className;

      const instances = this.buckets[className];
      const description = `Instances of class ${className}`;
      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: [constraint],
        metric: [],
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
