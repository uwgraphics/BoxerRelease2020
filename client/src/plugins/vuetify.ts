/*
import Vue from 'vue';
import Vuetify from 'vuetify/lib';
// import 'vuetify/src/stylus/app.styl';
import 'vuetify/src/styles/main.sass';

Vue.use(Vuetify, {
  iconfont: 'md',
});
*/
// src/plugins/vuetify.js

import Vue from 'vue';
import Vuetify from 'vuetify/lib';

Vue.use(Vuetify);

const opts = {};

export default new Vuetify(opts);
