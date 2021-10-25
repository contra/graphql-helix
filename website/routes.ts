import { IRoutes, GenerateRoutes } from "@guild-docs/server";

export function getRoutes(): IRoutes {
  const Routes: IRoutes = {
    _: {
      docs: {
        $name: "Docs",
        $routes: ["README", "getting-started"],
      },
    },
  };
  GenerateRoutes({
    Routes,
    folderPattern: "docs",
    basePath: "docs",
    basePathLabel: "Documentation",
  });

  return Routes;
}
