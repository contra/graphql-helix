import { HeroGradient, InfoList } from "@theguild/components";
import { handlePushRoute, NPMBadge } from "@guild-docs/client";

export default function Index() {
  return (
    <>
      <HeroGradient
        title="GraphQL Helix"
        description="A highly evolved GraphQL HTTP Server"
        link={{
          href: "/docs",
          children: "Get Started",
          title: "Get started with The Guild Docs",
          onClick: (e) => handlePushRoute("/docs", e),
        }}
        version={<NPMBadge name="graphql-helix" />}
        colors={["#000000", "#03a9f4"]}
      />

      <InfoList
        title="Features"
        items={[
          {
            title: "Framework and runtime agnostic",
            description: "Use whatever HTTP library you want. GraphQL Helix works in Node, Deno and in the browser.",
          },
          {
            title: "HTTP first",
            description:
              "Allows you to create a GraphQL over HTTP specification-compliant server, while exposing a single HTTP endpoint for everything from documentation to subscriptions.",
          },
          {
            title: "Server push and client pull",
            description: "Supports real-time requests with both subscriptions and @defer and @stream directives.",
          },
          {
            title: "Flexible",
            description:
              "Abstracts away logic that's common to all GraphQL HTTP servers, while leaving the implementation to you. Implement the features you want and take full control of your transport layer.",
          },
          {
            title: "Minimal",
            description: "No bloat. No paid platform integration. Zero dependencies outside of graphql-js.",
          },
        ]}
      />
    </>
  );
}
