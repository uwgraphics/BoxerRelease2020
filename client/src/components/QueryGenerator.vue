<template>
  <v-dialog width="100%" v-model="dialog">
    <v-btn fab flat large :color="colors.red" slot="activator">
      <v-icon>add</v-icon>
    </v-btn>
    <v-card height="90vh">
      <v-card-title>
        <v-tooltip
          v-for="(b, index) in buttons"
          :key="index"
          bottom
        >
          <template slot="activator">
            <v-btn fab depressed small :color="b.color" @click="b.action">
              <v-icon>{{ b.icon }}</v-icon>
            </v-btn>
          </template>
          <span>{{ b.tooltip }}</span>
        </v-tooltip>
        <span class="title ml-4">
          {{ title }}
        </span>
      </v-card-title>
      <v-card-text>
        <v-container fluid>
          <v-layout>
            <v-flex xs6>
              <v-btn
                fab flat small :color="colors.green"
                @click="addNewConstraint"
              >
                <v-icon>add</v-icon>
              </v-btn>
              New constraint
              <v-list subheader>
                <v-subheader>Constraints</v-subheader>

                <div
                  v-for="(constraint, index) in constraints"
                  :key="index"
                >
                  <v-btn
                    fab flat small :color="colors.red"
                    @click="constraints.splice(index, 1)"
                  >
                    <v-icon>close</v-icon>
                  </v-btn>

                  <v-btn
                    flat fab small
                    @click="constraint.negation = !constraint.negation"
                    :color="constraint.negation ? colors.orange : colors.gray"
                  >
                    <v-icon v-if="constraint.negation">indeterminate_check_box</v-icon>
                    <v-icon v-else>check_box_outline_blank</v-icon>
                  </v-btn>

                  <span>
                    <ChooseRule
                      v-if="!constraint.rule"
                      :constraint="constraint"
                    />
                    <ActualTargetClass
                      v-else-if="constraint.rule === rules.ACTUAL"
                      :boxProps="regularBoxProps"
                      :constraint="constraint"
                    />
                    <ClassifiersAgree
                      v-else-if="constraint.rule === rules.AGREE"
                      :boxProps="regularBoxProps"
                      :constraint="constraint"
                    />
                    <ClassifierPredicted
                      v-else-if="constraint.rule === rules.PREDICTED"
                      :boxProps="regularBoxProps"
                      :constraint="constraint"
                    />
                    <ClassifierRight
                      v-else-if="constraint.rule === rules.RIGHT"
                      :boxProps="regularBoxProps"
                      :constraint="constraint"
                    />
                    <FeatureEquals
                      v-else-if="constraint.rule === rules.FEATURE_EQ"
                      :boxProps="regularBoxProps"
                      :constraint="constraint"
                    />
                    <FeatureGreaterThan
                      v-else-if="constraint.rule === rules.FEATURE_GT"
                      :boxProps="regularBoxProps"
                      :constraint="constraint"
                    />
                    <FeatureLessThan
                      v-else-if="constraint.rule === rules.FEATURE_LT"
                      :boxProps="regularBoxProps"
                      :constraint="constraint"
                    />
                    <span v-else>
                      {{ constraint.rule }}
                      {{ constraint.text }}
                    </span>
                  </span>

                </div>
              </v-list>
            </v-flex>
            <v-flex xs6>
              <ConstrainedInstanceList
                :boxProps="constrainedInstanceListBoxProps"
              />
            </v-flex>
          </v-layout>
        </v-container>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import Vue from 'vue';

import ActualTargetClass from './constraints/ActualTargetClass.vue';
import ChooseRule from './constraints/ChooseRule.vue';
import ClassifierPredicted from './constraints/ClassifierPredicted.vue';
import ClassifierRight from './constraints/ClassifierRight.vue';
import ClassifiersAgree from './constraints/ClassifiersAgree.vue';
import FeatureEquals from './constraints/FeatureEquals.vue';
import FeatureGreaterThan from './constraints/FeatureGreaterThan.vue';
import FeatureLessThan from './constraints/FeatureLessThan.vue';

import ConstrainedInstanceList from '@/components/ConstrainedInstanceList.vue';

import {
  BoxProps,
  Instance,
} from '../types';
import { instanceById } from '../utils';

import {
  Constraint,
  PlaceHolder,
  Rule,
  PredicateSimple,
} from './constraints/types';
import {
  blankConstraint,
  constraintToString,
  createFilter,
  isConstraintComplete,
} from './constraints/utils';

export default Vue.extend({
  name: 'QueryGenerator',
  components: {
    ActualTargetClass,
    ChooseRule,
    ClassifierRight,
    ClassifierPredicted,
    ClassifiersAgree,
    ConstrainedInstanceList,
    FeatureEquals,
    FeatureGreaterThan,
    FeatureLessThan,
  },
  data() {
    return {
      colors: {
        gray: '#bbbbbb',
        green: '#0F0',
        orange: '#ffc400',
        red: '#F00',
        yellow: '#FFEB3B',
      },
      dialog: false,
      constraints: [] as Constraint[],
      rules: Rule,
      placeholders: PlaceHolder,
      title: 'Query Creator',
    };
  },
  computed: {
    buttons(): any {
      const buttons = [
        {
          action: this.discardQuery,
          color: this.colors.red,
          icon: 'close',
          tooltip: `Discard constraints and close ${this.title}`,
        },
        {
          action: this.resetQuery,
          color: this.colors.yellow,
          icon: 'refresh',
          tooltip: `Start from scratch`,
        },
        {
          action: this.saveQuery,
          color: this.colors.green,
          icon: 'check',
          tooltip: `Save constraints as a query and close ${this.title}`,
        },
      ];
      return buttons;
    },
    classifiers(): string[] {
      return [...this.$store.getters.classifiers];
    },
    classes(): string[] {
      return [...this.$store.getters.classes];
    },
    constrainedInstances(): string[] {
      let instances = this.instances;
      this.constraints.forEach((constraint) => {
        const filter = createFilter(constraint);
        instances = instances.filter(filter);
      });
      return instances;
    },
    constrainedInstanceListBoxProps(): BoxProps {
      return {
        classes: new Set(this.classes),
        classifiers: new Set(this.classifiers),
        features: new Set(this.features),
        instances: new Set(this.constrainedInstances),
      };
    },
    features(): string[] {
      return [...this.$store.getters.features];
    },
    instances(): string[] {
      return [...this.$store.getters.instances];
    },
    regularBoxProps(): BoxProps {
      return {
        classes: new Set(this.classes),
        classifiers: new Set(this.classifiers),
        features: new Set(this.features),
        instances: new Set(this.instances),
      };
    },
  },
  methods: {
    addNewConstraint() {
      const constraint = blankConstraint();
      this.constraints.unshift(constraint);
    },
    closeDialog() {
      this.dialog = false;
    },
    discardQuery() {
      this.closeDialog();
      this.resetQuery();
    },
    isQueryComplete() {
      return this.constraints.every(isConstraintComplete);
    },
    resetQuery() {
      this.constraints = [];
    },
    saveQuery() {
      if (!this.isQueryComplete()) {
        alert('Please delete or fill incomplete constraints before saving.');
        return;
      }
      const instances = new Set(this.constrainedInstances);
      const descriptions: string[] = [];
      this.constraints.forEach((constraint) => {
        descriptions.push(constraintToString(constraint));
      });

      const predicate: PredicateSimple = {
        type: 'simple',
        constraints: this.constraints,
        metric:[],
      };
      const fullDescription = descriptions.join(' AND ');

      const payload = {
        description: fullDescription,
        instances,
        predicate,
      };

      this.$store.dispatch('prependToSelectionHistory', payload);
      this.closeDialog();
      this.resetQuery();
    },
  },
});
</script>
