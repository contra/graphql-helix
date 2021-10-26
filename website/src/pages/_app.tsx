import "remark-admonitions/styles/infima.css";
import "../../public/style.css";

import { appWithTranslation } from "next-i18next";

import { extendTheme, theme as chakraTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";
import { ExtendComponents, handlePushRoute, CombinedThemeProvider, DocsPage, AppSeoProps } from "@guild-docs/client";
import { Header, Subheader, Footer } from "@theguild/components";

import type { AppProps } from "next/app";

ExtendComponents({
  HelloWorld() {
    return <p>Hello World!</p>;
  },
});

const styles: typeof chakraTheme["styles"] = {
  global: (props) => ({
    body: {
      bg: mode("white", "gray.850")(props),
    },
  }),
};

const theme = extendTheme({
  colors: {
    gray: {
      50: "#fafafa",
      100: "#f5f5f5",
      200: "#e5e5e5",
      300: "#d4d4d4",
      400: "#a3a3a3",
      500: "#737373",
      600: "#525252",
      700: "#404040",
      800: "#262626",
      850: "#1b1b1b",
      900: "#171717",
    },
  },
  fonts: {
    heading: "TGCFont, sans-serif",
    body: "TGCFont, sans-serif",
  },
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  styles,
});

const accentColor = "#03a9f4";

const serializedMdx = process.env.SERIALIZED_MDX_ROUTES;
const mdxRoutes = { data: serializedMdx && JSON.parse(serializedMdx) };

function AppContent(appProps: AppProps) {
  const { Component, pageProps, router } = appProps;
  const isDocs = router.asPath.startsWith("/docs");

  return (
    <>
      <Header accentColor={accentColor} activeLink="/open-source" themeSwitch />
      <Subheader
        activeLink={router.asPath}
        product={{
          title: "GraphQL Helix",
          description: "A highly evolved GraphQL HTTP Server",
          image: {
            src: "/assets/logo.svg",
            alt: "Logo",
          },
          onClick: (e) => handlePushRoute("/", e),
        }}
        links={[
          {
            children: "Home",
            title: "GraphQL Helix",
            href: "/",
            onClick: (e) => handlePushRoute("/", e),
          },
          {
            children: "Docs & API",
            title: "View examples",
            href: "/docs",
            onClick: (e) => handlePushRoute("/docs", e),
          },
          {
            children: "GitHub",
            title: "Head to project's GitHub",
            href: "https://github.com/contrawork/graphql-helix",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        ]}
        cta={{
          children: "Get Started",
          title: "Get started",
          href: "/docs/getting-started",
          onClick: (e) => handlePushRoute("/docs/getting-started", e),
        }}
      />
      {isDocs ? <DocsPage appProps={appProps} accentColor={accentColor} mdxRoutes={mdxRoutes} /> : <Component {...pageProps} />}
      <Footer />
    </>
  );
}

const AppContentWrapper = appWithTranslation(function TranslatedApp(appProps) {
  return <AppContent {...appProps} />;
});

const defaultSeo: AppSeoProps = {
  title: "GraphQL Helix",
  description: "Build your own extensible and framework-agnostic GraphQL Server",
  logo: {
    url: "https://raw.githubusercontent.com/contrawork/graphql-helix/13877388d1ea9a3d887370fb231c3552f23cf546/logo.svg",
    width: 150,
    height: 80,
  },
};

export default function App(appProps: AppProps) {
  return (
    <CombinedThemeProvider theme={theme} accentColor={accentColor} defaultSeo={defaultSeo}>
      <AppContentWrapper {...appProps} />
    </CombinedThemeProvider>
  );
}
