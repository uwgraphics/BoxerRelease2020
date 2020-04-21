import Vue from 'vue';
import Vuex from 'vuex';
import * as d3 from 'd3';
import {
  EntityType,
  Feature,
  Instance,
  Metrics,
  SelectionAction,
  SelectionRecord,
  SelectionStrategy,
  Visualization,
  VisualizationType,
} from './types';
import {
  difference,
  intersection,
  instanceById,
  xor,
  union,
} from './utils';
import {
  predicateAbstraction, isConstraintComplete, composePredicates,
} from './components/constraints/utils';

Vue.use(Vuex);

const datasets: {
  [key: string]: {
    path: string,
  },
} = {
  //  'Iris': {
  //     path: 'datasets/iris/',
  //   },
  //   'TCP Tree Explore': {
  //     path: 'datasets/tcp-tree-explore/',
  //   },
  //   'Imputation': {
  //     path: 'datasets/stories/imputation/',
  //   },
  //   'IMDB Movie Reviews': {
  //     path: 'datasets/imdb-preprocessed-stratified/',
  //   },
  //   'IMDB Confidence': {
  //     path: 'datasets/confidence/',
  //   },
  //   'Ensemble': {
  //    path: 'datasets/stories/ensemble/',
  //   },
  //   'recid': {
  //     path: 'datasets/recid/',
  //   },
  //   'date-12000-strat': {
  //     path: 'datasets/date-12000-strat/',
  //   },'fuzz-mod-5-02': {
  //     path: 'datasets/fuzz-mod-5-02/',
  //   },
  //   'tcp-tree-select-9-10': {
  //     path: 'datasets/tcp-tree-select-9-10/',
  //   },
};

//const SERVER_URL = 'http://graphics.cs.wisc.edu/Vis/Boxer/demo/';
const SERVER_URL = 'http://localhost:3000/';

export default new Vuex.Store({
  state: {
    tileWidth: "50%",
    baseDataset: 'both' as 'both' | 'train' | 'test',
    baseSelection: {
      description: 'Not yet set',
      id: -1,
      instances: new Set(),
      name: 'Not yet set',
      classifier:"null",
      className:"null",
    } as SelectionRecord,
    chosenDataset: {
      name: '',
      classes: [],
      classifiers: [],
      features: {},
      instances: {},
    } as {
      name: string,
      classes: string[],
      classifiers: string[],
      features: { [id: string]: Feature },
      instances: { [id: string]: Instance },
    },
    datasets,
    hoverInstance: '',
    filters: {
      class: {
        type: SelectionAction.Exclude,
        set: new Set(),
      },
      classifier: {
        type: SelectionAction.Exclude,
        set: new Set(),
      },
      instance: {
        type: SelectionAction.Exclude,
        set: new Set(),
      },
    } as {
      [key in EntityType]: {
        type: SelectionAction,
        set: Set<string>,
      }
    },
    overlapSelections: {
      first: null as SelectionRecord | null,
      second: null as SelectionRecord | null,
    },

    selectionHistory: [] as SelectionRecord[],
    selectionStrategy: SelectionStrategy.Any as SelectionStrategy,
    views: {
      all: [
        VisualizationType.CA,
        VisualizationType.SCP,
        VisualizationType.COV,
        VisualizationType.CMG,
        VisualizationType.FH,
        VisualizationType.OCA,
        VisualizationType.PCC,
        VisualizationType.SM,
        VisualizationType.SMP,
        VisualizationType.ITL,
      ],
      open: [
        VisualizationType.CA,
        VisualizationType.FH,
      ],
    } as {
      all: VisualizationType[],
      open: VisualizationType[],
    },
    intersectionMode: true,
  },

  mutations: {
    newTileWidth(state, width) {
      Vue.set(state, "tileWidth", width);
    },
    toggleSetIntersectionMode(state, intersect) {
      Vue.set(state, 'intersectionMode', intersect);
    },
    setBaseSelection(state, baseSelection: SelectionRecord) {
      Vue.set(state, 'baseSelection', baseSelection);
    },
    setOpenViews(state, views: VisualizationType[]) {
      Vue.set(state.views, 'open', views);
      console.log('open views updated', views);
    },
    setOverlapSelection(
      state,
      payload: {
        whichOverlap: 'first' | 'second',
        selection: SelectionRecord | null,
      },
    ) {
      const {whichOverlap, selection} = payload;
      const newOverlapSelections = Object.assign({}, state.overlapSelections);
      newOverlapSelections[whichOverlap] = selection;
      Vue.set(state, 'overlapSelections', newOverlapSelections);
      console.log(`Set ${whichOverlap} selection set to`, state.overlapSelections[whichOverlap]);
    },
    setSelectionHistory(state, newHistory) {
      Vue.set(state, 'selectionHistory', newHistory);
      const predicate = state.selectionHistory[0].predicate;
      if (predicate) {
        predicateAbstraction(predicate);
      }
    },
    updateDataset(state, newDataset) {
      // logTime('before updatedDataset mutation');
      Vue.set(state, 'chosenDataset', newDataset);
      // logTime('after updatedDataset mutation');
    },
    
    updateHoverInstance(state, id) {
      Vue.set(state, 'hoverInstance', id);
    },
    updateFilter(
      state,
      payload: {
        entityType: EntityType,
        newFilter: {
          type: SelectionAction,
          set: Set<string>,
        },
      },
    ) {
      Vue.set(state.filters, payload.entityType, payload.newFilter);
    },
    
  },
  actions: {
    toggleGridSize(context) {
      if (context.state.tileWidth === "50%") {
        context.commit("newTileWidth", "" + (100 / 3) + "%");
      } else {
        context.commit("newTileWidth", "50%");
      }
    },
    setTileWidth(context, width) {
      context.commit("newTileWidth", width);
    },
    toggleShift(context, keyEvent) {
      if (keyEvent.key === 'Shift') {
        context.commit('toggleSetIntersectionMode', keyEvent.type === 'keyup');
      }
    },
    chooseOverlapSelection(
      context,
      payload: {
        selection: SelectionRecord | null,
        whichOverlap: 'first' | 'second',
      },
    ) {
      context.commit('setOverlapSelection', payload);
    },
   
    clearHoverInstance(context) {
      context.commit('updateHoverInstance', '');
    },
   
    closeView(context, index: number) {
      const pastViews = context.state.views.open;
      const newViews = pastViews.filter((view, i) => i !== index);
      context.commit('setOpenViews', newViews);
    },
    loadFirstDataset(context) {
      const datasetList = Object.keys(context.state.datasets);
      if (datasetList.length === 0) {
        console.error('Vuex state.datasets is empty. Cannot load first dataset.');
        return;
      }
      const firstDataset = datasetList[0];
      context.dispatch('updateDatasetByName', firstDataset);
    },
    openView(context, view: VisualizationType) {
      const pastViews = context.state.views.open;
      // const newViews = [view, ...pastViews];
      const newViews = [...pastViews, view];
      context.commit('setOpenViews', newViews);
    },
    prependToSelectionHistory(context, payload) {
      if (context.state.intersectionMode || context.state.selectionHistory.length < 2) {
        const oldSelectionHistory = context.state.selectionHistory;
        const selection: SelectionRecord = {
          description: payload.description,
          id: oldSelectionHistory.length,
          instances: payload.instances,
          name: 'No name',
        };
        if (payload.predicate) {
          selection.predicate = payload.predicate;
        }
        const newSelectionHistory = [selection, ...oldSelectionHistory];
        context.commit('setSelectionHistory', newSelectionHistory);
      } else {
        // create union with last intersection
        // first add regular 
        console.log("UNION MODE");
        const oldSelectionHistory = context.state.selectionHistory;
        const lastSelection = context.state.selectionHistory[0];
        let instances = new Set([...lastSelection.instances, ...payload.instances]);
        let unionDescription = "union(" + lastSelection.id + ", " + payload.description + ")";
        const selection: SelectionRecord = {
          description: unionDescription,
          id: oldSelectionHistory.length,
          instances: instances,
          name: 'No name',
        };
        if (payload.predicate && lastSelection.predicate) {
          selection.predicate = composePredicates(payload.predicate, lastSelection.predicate, "union");
        }
        const newSelectionHistory = [selection, ...oldSelectionHistory];
        context.commit('setSelectionHistory', newSelectionHistory);
      }
    },
    resetSelectionHistory(context) {
      const trainOrTest = 'train_or_test';
      const cleanSelectionHistory: SelectionRecord[] = [
        {
          id: 0,
          name: 'Original',
          description: 'Original dataset',
          instances: new Set(Object.keys(context.state.chosenDataset.instances)),
        },
        
      ];
      context.commit('setSelectionHistory', cleanSelectionHistory);
      const baseSelection = cleanSelectionHistory[0];
      context.commit('setBaseSelection', baseSelection);
      context.commit('setOverlapSelection', { whichOverlap: 'first', selection: null });
      context.commit('setOverlapSelection', { whichOverlap: 'second', selection: null });
    },
    setBaseSelection(context, baseSelection: SelectionRecord) {
      context.commit('setBaseSelection', baseSelection);
    },
    updateDatasetByName(context, datasetName: string) {
      const datasetList = Object.keys(context.state.datasets);
      const chosenDataset = datasetList.indexOf(datasetName);
      if (chosenDataset === -1) {
        console.error(`Dataset named ${datasetName} not found in state.datasets`);
        return;
      }
      const datasetPath = SERVER_URL + datasets[datasetName].path;
      context.dispatch('updateDataset', datasetPath);
    },
    updateDataset(context, datasetURL: string) {
      let datasetPath = datasetURL.endsWith("/") ? datasetURL : datasetURL + "/";
      const filenames = [
        'manifest.json',
        'results.csv',
        'features.csv',
      ];
      Promise.all(filenames.map((filename) => {
        const url = datasetPath + filename;
        const fileType = filename.split('.').pop();
        return fetch(url)
          .then((response) => {
            if (!response.ok) {
              return Promise.reject(response.status);
            }
            return response.text();
          }).then((data) => {
            switch (fileType) {
              case 'csv':
                return d3.csvParse(data);
              case 'json':
                return JSON.parse(data);
              default:
                return data;
            }
          });
      })).then((data) => {
        const [manifest, resultsData, featuresData] = data; // as [
        
        const checkData = () => {
          const ManifestResultsClassifier = () => {
            const mClassifiers = new Set(manifest.classifiers);
            const rCLassifiers = new Set(resultsData.columns.filter((x: string) => !['id', 'actual'].includes(x)));
            const mismatch = xor(mClassifiers, rCLassifiers);
            console.log(mClassifiers, rCLassifiers)
            if (mismatch.size > 0) {
              console.error('Mismatch in classifiers from manifest and classifiers in results.csv columns headers.');
            }
          };
          ManifestResultsClassifier();

          const resultsFeaturesRows = () => {
            if (resultsData.length !== featuresData.length) {
              console.error('Number of rows in features and results is not equal.');
            }
          };
          resultsFeaturesRows();

          const resultsMissingValues = () => {
            const rData: Array<{[key: string]: any}> = resultsData;
            Object.values(rData).forEach((r) => {
              Object.values(r).forEach((cellString: string) => {
                if (cellString === '') {
                  console.error('Empty cell in results.csv');
                }
              });
            });
          };
          resultsMissingValues();
        };
        checkData();

        // const name = datasetName;
        const pathPieces = datasetPath.split('/');
        const name = pathPieces[pathPieces.length - 2];
        const classes: string[] = manifest.classes.map((c: any) => c.toString());
        const classifiers: string[] = manifest.classifiers.map((c: any) => c.toString());
        const featureNames: string[] = Object.keys(manifest.features).filter((f) => f !== 'id');

        const instances: {[id: string]: Instance} = {};
        resultsData.forEach((
          result: {
            id: string,
            actual: string,
            [classifier: string]: string,
          },
          index: number,
        ) => {
          const {id: rId, actual, ...predictions} = result;
          const {id: fId, ...features} = featuresData[index];
          if (rId !== fId) {
            console.error('Ids in results.csv and features.csv do not match.');
            return;
          }
          instances[index] = {
            actual,
            predictions,
            features,
          };
        });


        const addRandomClassifier = () => {
          const randomClassifier = 'Random Classifier';
          classifiers.unshift(randomClassifier);
          Object.values(instances).forEach((i) => {
            const randomClass = classes[Math.floor(Math.random() * classes.length)];
            i.predictions[randomClassifier] = randomClass;
          });
        };
        addRandomClassifier();

        const addMajorityClassifier = () => {
          const majorityClassifier = 'Majority Classifier';
          classifiers.unshift(majorityClassifier);
          const classCounts: { [className: string]: number } = {};
          classes.forEach((className) => classCounts[className] = 0);
          Object.values(instances).forEach((i) => classCounts[i.actual]++);
          let majorityClass = Object.keys(classCounts)[0];
          Object.keys(classCounts).forEach((className) => {
            if (classCounts[className] > classCounts[majorityClass]) {
              majorityClass = className;
            }
          });
          Object.values(instances).forEach((id) => id.predictions[majorityClassifier] = majorityClass);
        };
        addMajorityClassifier();

        const addOracle = () => {
          const oracle = 'Oracle';
          classifiers.unshift(oracle);
          Object.values(instances).forEach((i) => i.predictions[oracle] = i.actual);
        };
        addOracle();

        const featureObjects: {
          [name: string]: Feature;
        } = manifest.features;
        const testFeatureObjects = () => {
          const allowedTypes = [
            'categorical',
            'interval',
            'nominal',
            'ordinal',
            'ratio',
          ];
          Object.keys(featureObjects).forEach((featureName: string) => {
            const f = featureObjects[featureName];
            //console.log("feature",f)
            if (!f.description) {
              console.error(`Feature ${featureName} has no description.`);
            }
            if (!allowedTypes.includes(f.type)) {
              console.error(`Feature ${featureName} does not have a valid type. It has type "${f.type}" instead`);
            }
          });
        };
        testFeatureObjects();

        const parsedDataset = {
          name,
          classes,
          classifiers,
          features: featureObjects,
          instances,
        };
        // logTime('dataset parsed');
        if (Object.keys(featureObjects).includes('train_or_test')) {
          context.state.baseDataset = 'test';
        } else {
          context.state.baseDataset = 'both';
        }
        context.commit('updateDataset', parsedDataset);
        context.dispatch('resetSelectionHistory');
      });
    },
    updateFilter(
      context,
      payload: {
        entityType: EntityType,
        newFilter: {
          type: SelectionAction,
          set: Set<string>,
        },
      },
    ) {
    
      context.commit('updateFilter', payload);
    },
    updateHover(context, newHover) {
      context.commit('updateHover', newHover);
    },
    updateHoverInstance(context, id) {
      context.commit('updateHoverInstance', id);
    },
    setToMostRecentSelection(context, whichOverlap: 'first' | 'second') {
      const mostRecentSelection = context.state.selectionHistory[0];
      context.dispatch('chooseOverlapSelection', {
        selection: mostRecentSelection,
        whichOverlap,
      });
    },
    
  },
  getters: {
    tileWidth(state) {
      return state.tileWidth;
    },
    intersectionMode(state) {
      return state.intersectionMode;
    },
    classes(state): Set<string> {
      return new Set(state.chosenDataset.classes);
    },
    classifiers(state): Set<string> {
      return new Set(state.chosenDataset.classifiers);
    },
    feature(state): (id: string) => Feature {
      return (id: string) => state.chosenDataset.features[id];
    },
    features(state): Set<string> {
      return new Set(Object.keys(state.chosenDataset.features));
    },
    instance(state): (id: string) => Instance {
      return (id: string) => state.chosenDataset.instances[id];
    },
    instances(state): Set<string> {
      return state.baseSelection.instances;
    },
    filteredClasses(state, getters): Set<string> {
      const classesToExclude = state.filters.class.set;
      const classes = getters.classes;
      const filteredClasses = difference(classes, classesToExclude);
      return filteredClasses;
    },
    filteredClassifiers(state, getters): Set<string> {
      const classifiersToExclude = state.filters.classifier.set;
      const classifiers = getters.classifiers;
      const filteredClassifiers = difference(classifiers, classifiersToExclude);
      return filteredClassifiers;
      // return getters.classifiers;
    },
    filteredInstances(state, getters): Set<string> {
      

      let filteredInstances: string[] = [...getters.instances];
      const trainOrTest = 'train_or_test';
      switch (state.baseDataset) {
        case 'test':
          filteredInstances = filteredInstances.filter((i) => {
            return instanceById(i).features[trainOrTest] === 'test' ||
              instanceById(i).features[trainOrTest] === '0';
          });
          break;
        case 'train':
          filteredInstances = filteredInstances.filter((i) => {
            return instanceById(i).features[trainOrTest] === 'train' ||
              instanceById(i).features[trainOrTest] === '1';
          });
          break;
      }
      return new Set(filteredInstances);
    },
    metrics(state, getters): {
      [classifier: string]: Metrics,
    }  {
      const classes: string[] = [...getters.filteredClasses];
      const classifiers: string[] = [...getters.filteredClassifiers];
      const instances: string[] = [...getters.filteredInstances];

      const metrics: {
        [classifier: string]: Metrics,
      } = {};
      classifiers.forEach((classifier) => {
        // create all metrics
        metrics[classifier] = {
          accuracy: -1,
          acc: { average: -1 },
          mcc: { average: -1 },
          f1: { average: -1 },
          microf1: { average: -1 },
          macrof1: { average: -1 },
          precision: { average: -1 },
          recall: { average: -1 },
          predicted: {},
          actual: {},
          false: {},
          true: {},
          tp: {},
          fp: {},
          fn: {},
          tn: {},
        };
        const m = metrics[classifier];
        
        // actual and predicted of a class
        classes.forEach((actualClass) => {
          m.actual[actualClass] = new Set(instances.filter((i) => instanceById(i).actual === actualClass));
        });
        classes.forEach((predictedClass) => {
          m.predicted[predictedClass] = new Set(instances.filter((i) =>
            instanceById(i).predictions[classifier] === predictedClass));
        });
        
        // true false per class 
        if (classes.length > 2) {
          classes.forEach((actualClass) => {
            var cur_predictions = [...m.predicted[actualClass]]
            var cur_actuals = [...m.actual[actualClass]]
            m.true[actualClass] = intersection(m.actual[actualClass], m.predicted[actualClass]);
            m.tp[actualClass] = m.true[actualClass];
            m.fp[actualClass] = new Set(cur_predictions.filter((i) => !cur_actuals.includes(i)));
            m.fn[actualClass] = new Set(cur_actuals.filter((i) => !cur_predictions.includes(i)));
          });
          classes.forEach((actualClass) => {
            m.false[actualClass] = difference(m.predicted[actualClass], m.actual[actualClass]);
          });
  
          classes.forEach((actualClass)=>{
            m.tn[actualClass]  = new Set();
            classes.forEach((restClass)=>{
              if (restClass != actualClass) {
                m.tn[actualClass]  = new Set([...m.tn[actualClass], ...m.tp[restClass]])
              }
            })
          })
        } else {
          classes.forEach((actualClass) => {
            m.true[actualClass] = intersection(m.actual[actualClass], m.predicted[actualClass]);
          });
          classes.forEach((actualClass) => {
            m.false[actualClass] = difference(m.predicted[actualClass], m.actual[actualClass]);
          });
  
          classes.forEach((actualClass)=>{
            m.tp[actualClass]  = new Set();
            m.fp[actualClass]  = new Set();
            m.fn[actualClass]  = new Set();
            m.tn[actualClass]  = new Set();
          })

          instances.forEach((id) => {
            const i = instanceById(id);
            var c = classifier
            if (i.actual == classes[1]) {
                if (i.predictions[c] == i.actual) {
                  m.tp[classes[1]].add(id);
                } else {
                  m.fn[classes[1]].add(id);
                }
              } else {
                if (i.predictions[c] == i.actual) {
                  m.tn[classes[1]].add(id);
                } else {
                  m.fp[classes[1]].add(id);
                }
              }
          })
        }

        //console.log()
        


        // accuracy
        let totalTrue = 0;
        classes.forEach((actualClass) => {
          totalTrue += m.true[actualClass].size;
        });
        m.accuracy = totalTrue / instances.length;


        // precision pre class
        if (classes.length > 2) {
          let precisionSum = 0;
          classes.forEach((className) => {
            m.precision[className] = m.tp[className].size / (m.tp[className].size + m.fp[className].size);
            precisionSum += m.precision[className];
          });
          m.precision.average = precisionSum / classes.length;
        } else {
          var className = classes[1]
          m.precision[className] =  m.tp[className].size / (m.tp[className].size + m.fp[className].size);
          m.precision[classes[0]] = 1-m.precision[className];
          m.precision.average = m.precision[className] 
        }
        

        
        // recall pre class
        if (classes.length > 2) {
          let recallSum = 0;
          classes.forEach((className) => {
            m.recall[className] = m.tp[className].size / (m.tp[className].size + m.fn[className].size);
            recallSum += m.recall[className];
          });
          m.recall.average = recallSum / classes.length;
        } else {
          var className = classes[1]
          m.recall[className] =  m.tp[className].size / (m.tp[className].size + m.fn[className].size);
          m.recall[classes[0]] = 1-m.recall[className];
          m.recall.average = m.recall[className] 
        }
        
        // f1
        if (classes.length > 2) {
          let f1Sum = 0;
          classes.forEach((className) => {
            const p = m.precision[className];
            const r = m.recall[className];
            m.f1[className] = 2 * p * r / (p + r);
            f1Sum += m.f1[className];
          });
          m.f1.average = f1Sum / classes.length;
        } else {
          var className = classes[1]
          const p = m.precision[className];
          const r = m.recall[className];
          m.f1[className] = 2 * p * r / (p + r);
          m.f1[classes[0]] = 2 * (1-p)*(1-r) / (2-p-r)
          m.f1.average = m.f1[className]
        }
         

        // micro f1
        let tpSum = 0;
        let fpSum = 0;
        let fnSum = 0;
        classes.forEach((className) => {
          tpSum += m.tp[className].size;
          fpSum += m.fp[className].size;
          fnSum += m.fn[className].size;
        });
        let microPrecision = tpSum / (tpSum + fpSum);
        let microRecall = tpSum / (tpSum + fnSum);
        m.microf1.average = m.f1.average//2 * microPrecision * microRecall / (microPrecision + microRecall);

        // macro f1
        m.macrof1.average = 2 * microPrecision * microRecall / (microPrecision + microRecall);//2 * m.precision.average * m.recall.average / (m.precision.average + m.recall.average);

        // mcc
        if (classes.length > 2) {
          var tp = 0;
          var tn = 0;
          var fp = 0;
          var fn = 0;
          classes.forEach((className) => {
            tp += m.tp[className].size;
            tn += m.tn[className].size;
            fp += m.fp[className].size;
            fn += m.fn[className].size;
          })
          if ((Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))) == 0) {
            if ((tp * tn - tp * fn) < 0){
              m.mcc.average = -1;
            } else {
              m.mcc.average = 1;
            }
          } else {
            m.mcc.average = (tp * tn - tp * fn) / (Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)));
          }
        } else {
          var className = classes[1]
          var tp = m.tp[className].size;
          var tn = m.tn[className].size;
          var fp = m.fp[className].size;
          var fn = m.fn[className].size;
          if ((Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))) == 0) {
            m.mcc.average = 0;
          } 
          if ((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn) != 0) {
            m.mcc.average = ((tp*tn-fp*fn) / Math.sqrt((tp+fp)*(tp+fn)*(tn+fp)*(tn+fn)))
          } 
        }
        
      });

      console.log("metrix",metrics)

      return metrics;
    },
    
    visualizations(state, getters): Visualization[] {
      // console.log('recomputing visualizations');
      const visualizations: Visualization[] = [];
      const openViews = state.views.open;
      openViews.forEach((view) => {

        const visualizationTemplate = () => {
          return {
            name: view,
            boxProps: {
              classes: getters.filteredClasses,
              classifiers: getters.filteredClassifiers,
              instances: getters.filteredInstances,
              features: getters.features,
            },
          };
        };
        
       
        switch (view) {
          case VisualizationType.CA:
          case VisualizationType.SCP:
          case VisualizationType.COV:
          case VisualizationType.CMG:
          case VisualizationType.FH:
          case VisualizationType.OCA:
          case VisualizationType.PCC:
          case VisualizationType.SMP:
          case VisualizationType.SM:
          case VisualizationType.ITL:
            visualizations.push(visualizationTemplate());
            break;
          default:
            console.error('Visualization', view, 'not implemented');
            break;
        }
      });

      return visualizations;
    },

  },
});
