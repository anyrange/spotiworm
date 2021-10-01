import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";
import LoadingSpinner from "@/components/LoadingSpinner.vue";
import "./assets/tailwind.css";
import "./assets/styles.css";
import ApexCharts from "apexcharts";
import VWave from "v-wave";
import isMobile from "./mixins/isMobile";
import meta from "./meta.js";

const app = createApp(App);

app.config.globalProperties.$apexcharts = ApexCharts;

app.use(router).use(store).use(VWave).use(meta).mount("#app");

app.component("LoadingSpinner", LoadingSpinner);
app.mixin(isMobile);
