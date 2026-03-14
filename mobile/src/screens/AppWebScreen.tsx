import { WebSurface } from "../components/WebSurface";
import { MOBILE_APP_URL } from "../config/env";

export const AppWebScreen = () => {
  return <WebSurface title="Mappa spiagge" initialUrl={MOBILE_APP_URL} />;
};
