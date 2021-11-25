import { Chance } from "chance";
import EventSource from "eventsource";
import getPort from "get-port";
import fetch from "cross-undici-fetch";
import puppeteer from "puppeteer";
import { getIntrospectionQuery } from "graphql";
import implementations from "./implementations";

const chance = Chance();

const get = async ({
  operationName,
  path,
  port,
  query,
  variables,
  contentType,
  accept,
}: {
  operationName?: string;
  path: string;
  port: number;
  query?: string;
  variables?: any;
  contentType?: string;
  accept?: string;
}) => {
  const url = new URL(`http://localhost:${port}${path}`);
  if (query) {
    url.searchParams.set("query", query);
  }
  if (variables) {
    url.searchParams.set("variables", JSON.stringify(variables));
  }
  if (operationName) {
    url.searchParams.set("operationName", operationName);
  }
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["content-type"] = contentType;
  }
  if (accept) {
    // eslint-disable-next-line dot-notation
    headers["accept"] = accept;
  }
  return fetch(url.toString(), {
    method: "GET",
    headers,
  });
};

const post = async ({
  operationName,
  path,
  port,
  query,
  variables,
  contentType = "application/json",
  accept,
}: {
  operationName?: string;
  path: string;
  port: number;
  query?: string;
  variables?: any;
  contentType?: string;
  accept?: string;
}) => {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["content-type"] = contentType;
  }
  if (accept) {
    // eslint-disable-next-line dot-notation
    headers["accept"] = accept;
  }
  return fetch(`http://localhost:${port}${path}`, {
    method: "POST",
    body: JSON.stringify({
      query,
      variables,
      operationName,
    }),
    headers,
  });
};

implementations.forEach((implementation) => {
  describe(implementation.name, () => {
    let port: number;
    let stopServer: () => Promise<void>;

    beforeAll(async () => {
      port = await getPort();
      stopServer = await implementation.start(port);
    });

    afterAll(async () => {
      await stopServer();
    });

    describe("path: /graphql", () => {
      test("POST introspection query", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: getIntrospectionQuery(),
        });
        expect(response.status).toEqual(200);
        expect(response.headers.get("content-type")).toEqual("application/json");
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data).toBeDefined();
      });

      test("POST basic query", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              echo(text: "hello world")
            }
          `,
        });
        expect(response.status).toEqual(200);
        expect(response.headers.get("content-type")).toEqual("application/json");
        expect(response.headers.get("content-length")).toBeDefined();
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.echo).toBeDefined();
      });

      test("POST with application/graphql+json request content-type yields correct response content-type", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              echo(text: "hello world")
            }
          `,
          contentType: "application/graphql+json",
        });
        expect(response.status).toEqual(200);
        expect(response.headers.get("content-type")).toEqual("application/graphql+json");
        expect(response.headers.get("content-length")).toBeDefined();
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.echo).toBeDefined();
      });

      test("POST with content-type 'application/graphql+json' request and accept 'application/json' header yields 'application/json' content-type", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              echo(text: "hello world")
            }
          `,
          contentType: "application/graphql+json",
          accept: "application/json",
        });
        expect(response.status).toEqual(200);
        expect(response.headers.get("content-type")).toEqual("application/json");
        expect(response.headers.get("content-length")).toBeDefined();
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.echo).toBeDefined();
      });

      test("POST query with variables", async () => {
        const text = chance.word();
        const response = await post({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query ($text: String!) {
              echo(text: $text)
            }
          `,
          variables: { text },
        });
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.echo).toEqual(text);
      });

      test("POST query with @defer", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              hello
              ...QueryFragment @defer
            }

            fragment QueryFragment on Query {
              goodbye
            }
          `,
        });
        expect(response.status).toEqual(200);
        expect(response.headers.get("content-type")).toEqual('multipart/mixed; boundary="-"');
        const chunks: string[] = [];

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        for await (const value of response.body) {
          chunks.push(value.toString());
        }
        expect(chunks).toHaveLength(2);
        expect(chunks[0].includes(`{"data":{"hello":"hello"},"hasNext":true}`)).toEqual(true);
        expect(chunks[1].includes(`{"data":{"goodbye":"goodbye"},"path":[],"hasNext":false}`)).toEqual(true);
      });

      test("POST query with @stream", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              stream @stream(initialCount: 1)
            }
          `,
        });
        const chunks: string[] = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        for await (const value of response.body) {
          chunks.push(value.toString());
        }
        expect(chunks).toHaveLength(3);
        expect(chunks[0].includes(`{"data":{"stream":["A"]},"hasNext":true}`)).toEqual(true);
        expect(chunks[1].includes(`{"data":"B","path":["stream",1],"hasNext":true}`)).toEqual(true);
        expect(chunks[2].includes(`{"data":"C","path":["stream",2],"hasNext":true}`)).toEqual(true);
      });

      test("POST mutation with variables", async () => {
        const number = chance.integer({ min: 1, max: 1000 });
        const response = await post({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            mutation ($number: Int!) {
              setFavoriteNumber(number: $number)
            }
          `,
          variables: { number },
        });
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.setFavoriteNumber).toEqual(number);
      });

      test("POST multiple operations with operationName", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query OperationA {
              alwaysTrue
            }

            query OperationB {
              alwaysFalse
            }
          `,
          operationName: "OperationB",
        });
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.alwaysFalse).toEqual(false);
      });

      test("POST malformed query", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: "query {alwaysTrue",
        });
        expect(response.status).toEqual(400);
        const body = await response.json();
        expect(body.errors[0].message).toEqual("Syntax Error: Expected Name, found <EOF>.");
      });

      test("POST validation errors", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: "query {alwaysTru}",
        });
        expect(response.status).toEqual(400);
      });

      test("POST missing query", async () => {
        const response = await post({
          path: "/graphql",
          port,
        });
        expect(response.status).toEqual(400);
        const body = await response.json();
        expect(body.data).toBeUndefined();
        expect(body.errors[0].message).toEqual("Must provide query string.");
      });

      test("GET introspection query", async () => {
        const response = await get({
          path: "/graphql",
          port,
          query: getIntrospectionQuery(),
        });
        expect(response.status).toEqual(200);
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data).toBeDefined();
      });

      test("GET basic query", async () => {
        const response = await get({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              echo(text: "hello world")
            }
          `,
        });
        expect(response.status).toEqual(200);
        expect(response.headers.get("content-length")).toBeDefined();
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.echo).toBeDefined();
      });

      test("GET query with variables", async () => {
        const text = chance.word();
        const response = await get({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query ($text: String!) {
              echo(text: $text)
            }
          `,
          variables: { text },
        });
        expect(response.status).toEqual(200);
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.echo).toEqual(text);
      });

      test("GET multiple operations with operationName", async () => {
        const response = await get({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query OperationA {
              alwaysTrue
            }

            query OperationB {
              alwaysFalse
            }
          `,
          operationName: "OperationB",
        });
        expect(response.status).toEqual(200);
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.alwaysFalse).toEqual(false);
      });

      test("GET subscription", async () => {
        const eventSource = new EventSource(`http://localhost:${port}/graphql?query=subscription{eventEmitted}`);
        const payload = await new Promise<any>((resolve) => {
          eventSource.addEventListener("message", (event: any) => {
            resolve(event.data);
            eventSource.close();
          });
        });
        const { data } = JSON.parse(payload);
        expect(data.eventEmitted).toBeDefined();
      });

      test("GET malformed subscription", async () => {
        const eventSource = new EventSource(`http://localhost:${port}/graphql?query=subscription{eventEmitted}}`);
        const payload = await new Promise<any>((resolve) => {
          eventSource.addEventListener("message", (event: any) => {
            resolve(event.data);
            eventSource.close();
          });
        });
        const { data, errors } = JSON.parse(payload);
        expect(data).toBeUndefined();
        expect(errors.length).toEqual(1);
      });

      test("GET query with @defer", async () => {
        const response = await get({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              hello
              ...QueryFragment @defer
            }

            fragment QueryFragment on Query {
              goodbye
            }
          `,
        });
        const chunks: string[] = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        for await (const chunk of response.body) {
          chunks.push(chunk.toString());
        }
        expect(chunks).toHaveLength(2);
        expect(chunks[0].includes(`{"data":{"hello":"hello"},"hasNext":true}`)).toEqual(true);
        expect(chunks[1].includes(`{"data":{"goodbye":"goodbye"},"path":[],"hasNext":false}`)).toEqual(true);
      });

      test("GET query with @stream", async () => {
        const response = await get({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              stream @stream(initialCount: 1)
            }
          `,
        });
        const chunks: string[] = [];
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        for await (const chunk of response.body) {
          chunks.push(chunk.toString());
        }
        expect(chunks).toHaveLength(3);
        expect(chunks[0].includes(`{"data":{"stream":["A"]},"hasNext":true}`)).toEqual(true);
        expect(chunks[1].includes(`{"data":"B","path":["stream",1],"hasNext":true}`)).toEqual(true);
        expect(chunks[2].includes(`{"data":"C","path":["stream",2],"hasNext":true}`)).toEqual(true);
      });

      test("GET mutation", async () => {
        const response = await get({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            mutation {
              setFavoriteNumber(number: 42)
            }
          `,
        });
        expect(response.status).toEqual(405);

        const body = await response.json();
        expect(body.errors[0].message).toEqual("Can only perform a mutation operation from a POST request.");
      });

      test.only("GET malformed variables", async () => {
        const response = await get({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query ($text: String!) {
              echo(text: $text)
            }
          `,
          variables: JSON.stringify({ text: "hello" }).substring(1),
          contentType: "application/json",
        });
        expect(response.headers.get("content-type")).toEqual("application/json");

        expect(response.status).toEqual(400);
        const body = await response.json();
        expect(body.errors[0].message).toEqual("Variables are invalid JSON.");
      });

      test("PUT unsupported method", async () => {
        const url = new URL(`http://localhost:${port}/graphql`);
        url.searchParams.set(
          "query",
          /* GraphQL */ `
            {
              echo(text: "hello world")
            }
          `
        );
        const response = await fetch(url.toString(), {
          method: "PUT",
        });
        expect(response.status).toEqual(405);
        const body = await response.json();
        expect(body.errors[0].message).toEqual("GraphQL only supports GET and POST requests.");
      });

      describe("path: /graphiql", () => {
        test("GET GraphiQL interface", async () => {
          const response = await get({
            port,
            path: "/graphiql",
            accept: "text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
            query: /* GraphQL */ `
              query {
                echo(text: "hello world")
              }
            `,
          });
          expect(response.status).toEqual(200);
          const text = await response.text();
          expect(text.includes("<!DOCTYPE html>")).toEqual(true);
        });
      });
    });

    describe("path: /", () => {
      test("POST basic query", async () => {
        const response = await post({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              echo(text: "hello world")
            }
          `,
        });
        expect(response.status).toEqual(200);
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.echo).toBeDefined();
      });

      test("GET basic query", async () => {
        const response = await get({
          path: "/graphql",
          port,
          query: /* GraphQL */ `
            query {
              echo(text: "hello world")
            }
          `,
        });
        const body = await response.json();
        expect(body.errors).toBeUndefined();
        expect(body.data?.echo).toBeDefined();
      });

      test("GET GraphiQL interface", async () => {
        const response = await get({
          port,
          path: "/graphiql",
          accept: "text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
          query: /* GraphQL */ `
            query {
              echo(text: "hello world")
            }
          `,
        });
        const body = await response.json();
        expect(body.includes("<!DOCTYPE html>")).toEqual(true);
      });
    });

    describe.skip("GraphiQL functionality", () => {
      let browser: puppeteer.Browser;
      let page: puppeteer.Page | undefined;

      const playButtonSelector = `[d="M 11 9 L 24 16 L 11 23 z"]`;
      const stopButtonSelector = `[d="M 10 10 L 23 10 L 23 23 L 10 23 z"]`;

      beforeAll(async () => {
        browser = await puppeteer.launch({
          // If you wanna run tests with open browser
          // set your PUPPETEER_HEADLESS env to "false"
          headless: process.env.PUPPETEER_HEADLESS !== "false",
        });
      });
      beforeEach(async () => {
        if (page !== undefined) {
          await page.close();
          page = undefined;
        }
      });
      afterAll(async () => {
        await browser.close();
      });

      test("can execute simple query operation", async () => {
        page = await browser.newPage();
        const operation = `{ alwaysFalse }`;
        await page.goto(`http://localhost:${port}/graphiql?query=${operation}`);
        await page.click(".execute-button");
        await new Promise((resolve) => setTimeout(resolve, 300));
        const resultContents = await page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return window.g.resultComponent.viewer.getValue();
        });
        expect(resultContents).toEqual(
          JSON.stringify(
            {
              data: {
                alwaysFalse: false,
              },
            },
            null,
            2
          )
        );
      });

      test("can execute a simple mutation operation", async () => {
        page = await browser.newPage();
        const operation = `mutation { setFavoriteNumber(number: 3) }`;
        await page.goto(`http://localhost:${port}/graphiql?query=${operation}`);
        await page.click(".execute-button");
        await new Promise((resolve) => setTimeout(resolve, 300));
        const resultContents = await page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return window.g.resultComponent.viewer.getValue();
        });
        expect(resultContents).toEqual(
          JSON.stringify(
            {
              data: {
                setFavoriteNumber: 3,
              },
            },
            null,
            2
          )
        );
      });

      test("can execute a stream multi-part operation", async () => {
        page = await browser.newPage();
        const operation = `query { stream @stream(initialCount: 1) }`;
        await page.goto(`http://localhost:${port}/graphiql?query=${operation}`);
        await page.click(".execute-button");
        await new Promise((resolve) => setTimeout(resolve, 100));
        const [resultContents1, isShowingStopElement] = await page.evaluate((stopButtonSelector) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return [window.g.resultComponent.viewer.getValue(), !!window.document.querySelector(stopButtonSelector)];
        }, stopButtonSelector);
        expect(resultContents1).toEqual(
          JSON.stringify(
            {
              data: {
                stream: ["A"],
              },
            },
            null,
            2
          )
        );
        expect(isShowingStopElement).toEqual(true);

        await new Promise((resolve) => setTimeout(resolve, 2200));
        const [resultContents2, isShowingPlayButton] = await page.evaluate((playButtonSelector) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return [window.g.resultComponent.viewer.getValue(), !!window.document.querySelector(playButtonSelector)];
        }, playButtonSelector);
        expect(resultContents2).toEqual(
          JSON.stringify(
            {
              data: {
                stream: ["A", "B", "C"],
              },
            },
            null,
            2
          )
        );
        expect(isShowingPlayButton).toEqual(true);
      });

      test("can execute a SSE (subscription) operation", async () => {
        page = await browser.newPage();
        const operation = `subscription { count(to: 2) }`;
        await page.goto(`http://localhost:${port}/graphiql?query=${operation}`);
        await page.click(".execute-button");
        await new Promise((resolve) => setTimeout(resolve, 300));
        const [resultContents, isShowingStopButton] = await page.evaluate((stopButtonSelector) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return [window.g.resultComponent.viewer.getValue(), !!window.document.querySelector(stopButtonSelector)];
        }, stopButtonSelector);
        expect(JSON.parse(resultContents)).toEqual({
          data: {
            count: 1,
          },
        });
        expect(isShowingStopButton).toEqual(true);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const [resultContents1, isShowingPlayButton] = await page.evaluate((playButtonSelector) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return [window.g.resultComponent.viewer.getValue(), !!window.document.querySelector(playButtonSelector)];
        }, playButtonSelector);
        expect(JSON.parse(resultContents1)).toEqual({
          data: {
            count: 2,
          },
        });
        expect(isShowingPlayButton).toEqual(true);
      });

      test("should fail with GraphQL error as subscription response", async () => {
        page = await browser.newPage();
        const operation = `subscription { error }`;
        await page.goto(`http://localhost:${port}/graphiql?query=${operation}`);
        await page.click(".execute-button");
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const [resultContents, isShowingPlayButton] = await page.evaluate((playButtonSelector) => {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          return [window.g.resultComponent.viewer.getValue(), !!window.document.querySelector(playButtonSelector)];
        }, playButtonSelector);

        expect(JSON.parse(resultContents)).toEqual({
          errors: [{ message: "This is not okay" }],
        });
        expect(isShowingPlayButton).toEqual(true);
      });
    });
  });
});
