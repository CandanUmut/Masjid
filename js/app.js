// Entry point: register feature modules, then start the app.
import { start, registerPlugin, makeCtx } from "./main.js";
import { masjidPlugin, setCtxProvider } from "./views/masjid.js";
import { extrasPlugin, setExtrasCtx } from "./views/extras.js";

setCtxProvider(makeCtx);
setExtrasCtx(makeCtx);
registerPlugin(masjidPlugin);
registerPlugin(extrasPlugin);
start();
