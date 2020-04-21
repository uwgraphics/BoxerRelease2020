<template>
  <v-expansion-panels
      v-model="panel"
      multiple
  >
    <v-expansion-panel>
      <v-expansion-panel-header>Filters (tick to exclude)</v-expansion-panel-header>
      <v-expansion-panel-content>
        <ClassFilter />
        <ClassifierFilter />
      </v-expansion-panel-content>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-header>Views</v-expansion-panel-header>
      <v-expansion-panel-content>
        <ViewList />
      </v-expansion-panel-content>
    </v-expansion-panel>
    <v-expansion-panel>
      <v-expansion-panel-header>Selection History</v-expansion-panel-header>
      <v-expansion-panel-content>
        <SetHistory />
      </v-expansion-panel-content>
      <!-- <v-expansion-panel-content>
        <div slot="header" class="header-title">Instances</div>
        <InstanceList />
      </v-expansion-panel-content> -->
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts">
import Vue from 'vue';

import ClassFilter from './filters/ClassFilter.vue';
import ClassifierFilter from './filters/ClassifierFilter.vue';
import InstanceList from '@/components/sidebar/InstanceList.vue';
import SetHistory from '@/components/sidebar/SetHistory.vue';
import ViewList from './ViewList.vue';

export default Vue.extend({
  name: 'Sidebar',
  components: {
    ClassFilter,
    ClassifierFilter,
    InstanceList,
    SetHistory,
    ViewList,
  },
  data() {
    return {
      // panel: [false, false, true, false],
      panel: [0, 0, 0],
    };
  },
});
</script>

<style scoped>
.header-title {
  font-size: 12px;
}
</style>
