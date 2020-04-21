<template>
  <v-card>
    <v-card-title>
      <h2>Dataset list</h2>
    </v-card-title>
    <v-card-text>
      <v-list>
        <v-list-item
          v-for="dataset in Object.keys(this.$store.state.datasets)"
          :key="dataset"
          @click="updateDatasetByName(dataset)"
        >
          <v-list-item-content>
            <v-list-item-title v-text="dataset"></v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
      <v-layout>
        <v-flex xs8>
          <v-text-field
            label="Enter Custom Dataset URL"
            outline
            v-model="customDatasetURL"
          ></v-text-field>
        </v-flex>
        <v-flex xs4>
          <v-btn
            @click="() => { updateDataset(customDatasetURL); customDatasetURL = '' }"
          >
            Load
          </v-btn>
        </v-flex>
      </v-layout>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import Vue from 'vue';
import { mapActions } from 'vuex';

export default Vue.extend({
  name: 'DatasetSelectorPopup',
  data() {
    return {
      customDatasetURL: '',
    };
  },
  methods: {
    ...mapActions([
      'updateDataset',
      'updateDatasetByName',
    ]),
  },
});
</script>
