import { HeroGradient, InfoList } from "@theguild/components";
import { handlePushRoute, NPMBadge } from "@guild-docs/client";

export default function Index() {
  return (
    <>
      <HeroGradient
        title="GraphQL Helix"
        description="Build your own extensible and framework-agnostic GraphQL Server"
        link={{
          href: "/docs",
          children: "Get Started",
          title: "Get started with GraphQL Helix",
          onClick: (e) => handlePushRoute("/docs", e),
        }}
        version={<NPMBadge name="graphql-helix" />}
        colors={["#000000", "#03a9f4"]}
      />

      <InfoList
        title="Features"
        items={[
          {
            title: "Flexible",
            description:
              "Abstracts away logic that's common to all GraphQL HTTP servers while leaving the implementation to you. Implement the features you want and take full control of your transport layer.",
          },
          {
            title: "Minimal",
            description: "No bloat. No paid platform integration. Zero dependencies outside of graphql-js.",
          },
          {
            title: "Framework and runtime agnostic",
            description:
              "Everyone has their favorite HTTP framework. Helix does not dictate which library you should use. Whether it is the raw Node.js http module, fastify, koa, or express! The core logic can even be used with deno or even in the browser! Your GraphQL layer should never block you from upgrading to the latest version of your HTTP framework or even block you from migrating to another HTTP framework. With GraphQL Helix you can make your own choices.",
          },
          {
            title: "HTTP first",
            description:
              "Allows you to create GraphQL over HTTP specification-compliant servers. However, if you need to diverge from that GraphQL Helix does not block you from doing so! As you are fully in charge of your HTTP handler features such as query operation batching or persisted queries can be added with ease! You will never be blocked by opinionated frameworks and maintainers!",
          },
          {
            title: "Subscriptions over HTTP",
            description:
              "GraphQL Helix is capable of executing Subscriptions over HTTP instead of WebSockets via Server Sent Events. For getting started adding WebSocket GraphQL handlers alongside HTTP handlers can cause headaches and maybe you don't even need it!",
          },
          {
            title: "Defer and Stream over HTTP",
            description:
              "GraphQL Helix supports the Incremental Delivery over HTTP, which allows to incrementally stream parts of the execution result to the clients instead of having to wait for the slowest resolver to complete. All you need to do is install an experimental graphql-js version! GraphQL Helix allows you to ride on the bleeding edge!",
          },
          {
            title: "GraphiQL Included",
            description:
              "GraphQL helix comes with a helper function for rendering a GraphiQL instance. It will work anywhere, whether it is your local HTTP server, your production HTTP server in a container fleet, or a serverless function in the cloud! Of course, the GraphiQL is already preconfigured to work with Subscriptions, Defer and Stream over the corresponding protocols!",
          },
        ]}
      />
    </>
  );
}
