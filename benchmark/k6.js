/// @ts-check
import { check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import { graphql, checkNoErrors } from "./utils.js";
import { githubComment } from "./github.js";

export const options = {
  vus: 1,
  duration: "10s",
  thresholds: {
    no_errors: ["rate=1.0"],
    expected_result: ["rate=1.0"],
    http_req_duration: ["avg<=0.6"],
  },
};

export function handleSummary(data) {
  githubComment(data, {
    token: __ENV.GITHUB_TOKEN,
    commit: __ENV.GITHUB_SHA,
    pr: __ENV.GITHUB_PR,
    org: "dotansimha",
    repo: "envelop",
    renderTitle({ passes }) {
      return passes ? "✅ Benchmark Results" : "❌ Benchmark Failed";
    },
    renderMessage({ passes, checks, thresholds }) {
      const result = [];

      if (thresholds.failures) {
        result.push(
          `**Performance regression detected**: it seems like your Pull Request adds some extra latency to the GraphQL requests, or to envelop runtime.`
        );
      }

      if (checks.failures) {
        result.push(
          "**Failed assertions detected**: some GraphQL operations included in the loadtest are failing."
        );
      }

      if (!passes) {
        result.push(
          `> If the performance regression is expected, please increase the failing threshold.`
        );
      }

      return result.join("\n");
    },
  });

  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}

export default function () {
  const res = graphql({
    query: /* GraphQL */ `
      query song {
        song {
          firstVerse
        }
      }
    `,
    variables: {},
    operationName: "song",
  });

  check(res, {
    no_errors: checkNoErrors,
    expected_result: (resp) => "firstVerse" in resp.json().data.song,
  });
}
