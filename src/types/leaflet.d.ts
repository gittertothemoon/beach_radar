import "leaflet";

declare module "leaflet" {
  interface GridLayerOptions {
    reuseTiles?: boolean;
  }
}
