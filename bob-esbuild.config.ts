export const config: import("bob-esbuild").BobConfig = {
  tsc: {
    dirs: ["packages/*"],
  },
  verbose: true,
};
