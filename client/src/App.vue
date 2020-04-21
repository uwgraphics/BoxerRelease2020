<template>
  <v-app>
    <div class="app-container">
      <div class="app-bar">
        <!-- <v-icon dark @click="toggleIsClosed">dashboard</v-icon> -->
        <v-dialog v-model="load_dialog" max-width="400">
          <template v-slot:activator="{ on }">
            <v-btn v-on="on" fab small>
              <v-icon>add</v-icon>
            </v-btn>
          </template>
          <DatasetSelectorPopup />
        </v-dialog>
        <span class="dataset-title">{{ $store.state.chosenDataset.name }}</span>
        <v-btn @click="change_grid_size" fab small class="ml-10">
          <v-icon>grid_on</v-icon>
        </v-btn>
      </div>
      <div class="main">
        <div class="NavigationDrawer is-closed" id="nav-1">
          <Navbar />
        </div>
        <RigidTileHome />
        <v-snackbar
          v-model="snackbar"
          style="text-align: center;"
          :timeout="0"
        >
            <span>
              SET UNION MODE
            </span>
        </v-snackbar>
      </div>
    </div>
  </v-app>
</template>

<script lang="ts">
import DatasetSelectorPopup from './components/left-drawer/DatasetSelectorPopup.vue';
import Navbar from '@/components/left-drawer/Navbar.vue';
import RigidTileHome from '@/views/RigidTileHome.vue';
import Vue from 'vue';
import { mapState } from 'vuex';

export default Vue.extend({
  name: 'App',
  components: {
    DatasetSelectorPopup,
    Navbar,
    RigidTileHome,
  },
  data() {
    return {
      load_dialog: false,
    };
  },
  mounted() {
    this.$store.dispatch( 'loadFirstDataset' );
    window.addEventListener( 'keydown', e => this.$store.dispatch("toggleShift", e) );
    window.addEventListener( 'keyup', e => this.$store.dispatch("toggleShift", e) );
  },
  computed: {
    ...mapState([
      'chosenDataset',
    ]),
    snackbar() {
      return !this.$store.getters.intersectionMode;
    }
  },
  methods: {
    change_grid_size() {
      this.$store.dispatch("toggleGridSize");
    },
    buttonPush(b) {
      console.log("DOWN", b);
    },
    buttonUp(b) {
      console.log("UP", b);
    },
    toggleIsClosed() {
      const nav = document.getElementById('nav-1');
      if (nav === null) {
        return;
      }
      nav.classList.toggle('is-closed');
    },
  },
  watch: {
    chosenDataset() {
      this.load_dialog = false;
    }
  }
});
</script>

<style scoped>
.main {
  flex: 1;
  display: flex;
}
.app-container {
  --drawer-width: 400px;
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  font-size: 10px;
}
.Content {
  flex: 1;
  background: lightgray;
  padding: 10px;
  display: flex;
}
.app-bar {
  flex: 0;
  background: #2196F3;
  font-size: 18px;
  color: white;
}
.dataset-title {
  margin-left: 10px;
}
.NavigationDrawer {
  flex: 0 0 auto;
  background: #FFFFFF;
  width: var(--drawer-width);
  transition: all 0.3s ease-in-out;
}
.is-closed {
  margin-left: calc(-1 * var(--drawer-width));
  opacity: 0;
}
</style>
