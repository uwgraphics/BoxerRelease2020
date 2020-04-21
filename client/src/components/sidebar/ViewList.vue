<template>
  <div>
    <v-list>
      <v-list-item
        v-for="view in $store.state.views.all"
        :key="view"
      >
        <v-list-item-icon>
          <v-icon
            @click="() => $store.dispatch('openView', view)"
          >add_box</v-icon>
        </v-list-item-icon>
        <v-list-item-title>{{ view }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';

export default Vue.extend({
  name: 'ViewList',
});
</script>
