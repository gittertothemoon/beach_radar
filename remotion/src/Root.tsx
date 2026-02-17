import "./index.css";
import { Composition } from "remotion";
import {
  BEACH_RADAR_FINAL_FRAMES,
  BeachRadarWaitlistFinal,
} from "./compositions/BeachRadarWaitlistFinal";
import {
  BeachRadarBombPack15,
} from "./compositions/BeachRadarBombPack15";
import {
  BEACH_RADAR_BOMB_FRAMES,
  BEACH_RADAR_BOMB_VARIANTS,
} from "./compositions/BeachRadarBombPack15.config";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BeachRadar-Waitlist-Final"
        component={BeachRadarWaitlistFinal}
        durationInFrames={BEACH_RADAR_FINAL_FRAMES}
        fps={30}
        width={1080}
        height={1920}
      />

      {BEACH_RADAR_BOMB_VARIANTS.map((variant) => (
        <Composition
          key={variant.id}
          id={`BeachRadar-Bomb-${variant.id}`}
          component={BeachRadarBombPack15}
          durationInFrames={BEACH_RADAR_BOMB_FRAMES}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{variantId: variant.id}}
        />
      ))}
    </>
  );
};
