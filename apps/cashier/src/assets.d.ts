// Metro bundles these assets to a numeric module id at build time; tsc only needs to know the
// `require(...)` is a valid module so strict mode does not flag it.
declare module '*.wav' {
  const asset: number;
  export default asset;
}
declare module '*.mp3' {
  const asset: number;
  export default asset;
}
