import { defineDevtoolModule } from "../core";

// F24 owns admitting reviewed reference routes. An empty optional module proves
// the boundary without pulling retained Velzon routes into the product manifest.
export const referenceDevtoolsModule = defineDevtoolModule({
  id: "velzon-reference",
  kind: "devtool",
  navigation: [],
  routes: [],
});
