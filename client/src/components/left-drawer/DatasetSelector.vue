<template>
  <v-card>
    <v-list
      two-line
      subheader
    >
      <v-list-tile>
        <v-list-tile-content>
          <v-list-tile-title>{{ $store.state.chosenDataset.name }}</v-list-tile-title>
          <v-list-tile-sub-title>Current Dataset</v-list-tile-sub-title>
        </v-list-tile-content>
      </v-list-tile>

      <v-dialog max-width="400">
        <v-btn
          fab small color="light-blue white--text"
          slot="activator"
        >
          <v-icon>add</v-icon>
        </v-btn>
        <DatasetSelectorPopup />
      </v-dialog>
      Load new dataset
    </v-list>
  </v-card>
</template>

<script lang="ts">
import Vue from 'vue';
import DatasetSelectorPopup from './DatasetSelectorPopup.vue';

export default Vue.extend({
  name: 'DatasetSelector',
  components: {
    DatasetSelectorPopup,
  },
  data() {
    return {
      datasetFilepath: '@/assets/actual_output.dat',
    };
  },
});
</script>
