import { Chance } from "chance";
import EventSource from "eventsource";
import getPort from "get-port";
import got from "got";
import { getIntrospectionQuery } from "graphql";
import implementations from "./implementations";

const chance = Chance();

const get = async ({
  operationName,
  path,
  port,
  query,
  variables,
}: {
  operationName?: string;
  path: string;
  port: number;
  query?: string;
  variables?: any;
}) => {
  return got.get<any>(`http://localhost:${port}${path}`, {
    searchParams: {
      query,
      variables: variables ? JSON.stringify(variables) : undefined,
      operationName,
    },
    responseType: "json",
    throwHttpErrors: false,
  });
};

const post = async ({
  operationName,
  path,
  port,
  query,
  variables,
}: {
  operationName?: string;
  path: string;
  port: number;
  query?: string;
  variables?: any;
}) => {
  return got.post<any>(`http://localhost:${port}${path}`, {
    json: {
      query,
      variables,
      operationName,
    },
    responseType: "json",
    throwHttpErrors: false,
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
        const {
          body: { data, errors },
        } = await post({
          path: "/graphql",
          port,
          query: getIntrospectionQuery(),
        });
        expect(errors).toBeUndefined();
        expect(data).toBeDefined();
      });

      test("POST basic query", async () => {
        const {
          body: { data, errors },
        } = await post({
          path: "/graphql",
          port,
          query: `
            query {
              echo(text: "hello world")
            }
          `,
        });
        expect(errors).toBeUndefined();
        expect(data?.echo).toBeDefined();
      });

      test("POST query with variables", async () => {
        const text = chance.word();
        const {
          body: { data, errors },
        } = await post({
          path: "/graphql",
          port,
          query: `
            query ($text: String!) {
              echo(text: $text)
            }
          `,
          variables: { text },
        });
        expect(errors).toBeUndefined();
        expect(data?.echo).toEqual(text);
      });

      test("POST query with @defer", async () => {
        const stream = got.stream.post(`http://localhost:${port}/graphql`, {
          json: {
            query: `
                query {
                  hello
                  ...QueryFragment @defer
                }

                fragment QueryFragment on Query {
                  goodbye
                }
              `,
          },
        });
        const chunks: string[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk.toString());
        }
        expect(chunks).toHaveLength(2);
        expect(
          chunks[0].includes(`{"data":{"hello":"hello"},"hasNext":true}`)
        ).toEqual(true);
        expect(
          chunks[1].includes(
            `{"data":{"goodbye":"goodbye"},"path":[],"hasNext":false}`
          )
        ).toEqual(true);
      });

      test("POST query with @stream", async () => {
        const stream = got.stream.post(`http://localhost:${port}/graphql`, {
          json: {
            query: `
                query {
                  stream @stream(initialCount: 1)
                }
              `,
          },
        });
        const chunks: string[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk.toString());
        }
        expect(chunks).toHaveLength(3);
        expect(
          chunks[0].includes(`{"data":{"stream":["A"]},"hasNext":true}`)
        ).toEqual(true);
        expect(
          chunks[1].includes(`{"data":"B","path":["stream",1],"hasNext":true}`)
        ).toEqual(true);
        expect(
          chunks[2].includes(`{"data":"C","path":["stream",2],"hasNext":true}`)
        ).toEqual(true);
        expect(
          chunks[2].includes(`{"hasNext":false}`)
        ).toEqual(true);
      });

      test("POST mutation with variables", async () => {
        const number = chance.integer({ min: 1, max: 1000 });
        const {
          body: { data, errors },
        } = await post({
          path: "/graphql",
          port,
          query: `
            mutation ($number: Int!) {
              setFavoriteNumber(number: $number)
            }
          `,
          variables: { number },
        });
        expect(errors).toBeUndefined();
        expect(data?.setFavoriteNumber).toEqual(number);
      });

      test("POST multiple operations with operationName", async () => {
        const {
          body: { data, errors },
        } = await post({
          path: "/graphql",
          port,
          query: `
            query OperationA {
              alwaysTrue
            }

            query OperationB {
              alwaysFalse
            }
          `,
          operationName: "OperationB",
        });
        expect(errors).toBeUndefined();
        expect(data?.alwaysFalse).toEqual(false);
      });

      test("POST malformed query", async () => {
        const {
          statusCode,
          body: { errors },
        } = await post({
          path: "/graphql",
          port,
          query: "query {alwaysTrue",
        });
        expect(statusCode).toEqual(400);
        expect(errors[0].message).toEqual(
          "Syntax Error: Expected Name, found <EOF>."
        );
      });

      test("POST validation errors", async () => {
        const { statusCode } = await post({
          path: "/graphql",
          port,
          query: "query {alwaysTru}",
        });
        expect(statusCode).toEqual(400);
      });

      test("POST missing query", async () => {
        const {
          statusCode,
          body: { errors },
        } = await post({
          path: "/graphql",
          port,
        });
        expect(statusCode).toEqual(400);
        expect(errors[0].message).toEqual("Must provide query string.");
      });

      test("GET introspection query", async () => {
        const {
          body: { data, errors },
        } = await get({
          path: "/graphql",
          port,
          query: getIntrospectionQuery(),
        });
        expect(errors).toBeUndefined();
        expect(data).toBeDefined();
      });

      test("GET basic query", async () => {
        const {
          body: { data, errors },
        } = await get({
          path: "/graphql",
          port,
          query: `
            query {
              echo(text: "hello world")
            }
          `,
        });
        expect(errors).toBeUndefined();
        expect(data?.echo).toBeDefined();
      });

      test("GET query with variables", async () => {
        const text = chance.word();
        const {
          body: { data, errors },
        } = await get({
          path: "/graphql",
          port,
          query: `
            query ($text: String!) {
              echo(text: $text)
            }
          `,
          variables: { text },
        });
        expect(errors).toBeUndefined();
        expect(data?.echo).toEqual(text);
      });

      test("GET multiple operations with operationName", async () => {
        const {
          body: { data, errors },
        } = await get({
          path: "/graphql",
          port,
          query: `
            query OperationA {
              alwaysTrue
            }

            query OperationB {
              alwaysFalse
            }
          `,
          operationName: "OperationB",
        });
        expect(errors).toBeUndefined();
        expect(data?.alwaysFalse).toEqual(false);
      });

      test("GET subscription", async () => {
        const eventSource = new EventSource(
          `http://localhost:${port}/graphql?query=subscription{eventEmitted}`
        );
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
        const eventSource = new EventSource(
          `http://localhost:${port}/graphql?query=subscription{eventEmitted}}`
        );
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
        const stream = got.stream.get(`http://localhost:${port}/graphql`, {
          searchParams: {
            query: `
                query {
                  hello
                  ...QueryFragment @defer
                }

                fragment QueryFragment on Query {
                  goodbye
                }
              `,
          },
        });
        const chunks: string[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk.toString());
        }
        expect(chunks).toHaveLength(2);
        expect(
          chunks[0].includes(`{"data":{"hello":"hello"},"hasNext":true}`)
        ).toEqual(true);
        expect(
          chunks[1].includes(
            `{"data":{"goodbye":"goodbye"},"path":[],"hasNext":false}`
          )
        ).toEqual(true);
      });

      test("GET query with @stream", async () => {
        const stream = got.stream.get(`http://localhost:${port}/graphql`, {
          searchParams: {
            query: `
                query {
                  stream @stream(initialCount: 1)
                }
              `,
          },
        });
        const chunks: string[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk.toString());
        }
        expect(chunks).toHaveLength(3);
        expect(
          chunks[0].includes(`{"data":{"stream":["A"]},"hasNext":true}`)
        ).toEqual(true);
        expect(
          chunks[1].includes(`{"data":"B","path":["stream",1],"hasNext":true}`)
        ).toEqual(true);
        expect(
          chunks[2].includes(`{"data":"C","path":["stream",2],"hasNext":true}`)
        ).toEqual(true);
      });

      test("GET mutation", async () => {
        const {
          statusCode,
          body: { errors },
        } = await get({
          path: "/graphql",
          port,
          query: `
            mutation {
              setFavoriteNumber(number: 42)
            }
          `,
        });
        expect(statusCode).toEqual(405);
        expect(errors[0].message).toEqual(
          "Can only perform a mutation operation from a POST request."
        );
      });

      test("GET malformed variables", async () => {
        const {
          statusCode,
          body: { errors },
        } = await got.get<any>(`http://localhost:${port}/graphql`, {
          searchParams: {
            query: `
                query($text: String!) {
                  echo(text: $text)
                }
              `,
            variables: JSON.stringify({ text: "hello" }).substring(1),
          },
          responseType: "json",
          throwHttpErrors: false,
        });
        expect(statusCode).toEqual(400);
        expect(errors[0].message).toEqual("Variables are invalid JSON.");
      });

      test("PUT unsupported method", async () => {
        const {
          statusCode,
          body: { errors },
        } = await got.put<any>(`http://localhost:${port}/graphql`, {
          searchParams: {
            query: `{ echo(text: "hello world") }`,
          },
          responseType: "json",
          throwHttpErrors: false,
        });
        expect(statusCode).toEqual(405);
        expect(errors[0].message).toEqual(
          "GraphQL only supports GET and POST requests."
        );
      });
    });

    describe("path: /graphiql", () => {
      test("GET GraphiQL interface", async () => {
        const { body } = await got.get<any>(
          `http://localhost:${port}/graphiql`,
          {
            headers: {
              accept:
                "text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
            },
            searchParams: {
              query: `
                query {
                  echo(text: "hello world")
                }
              `,
            },
          }
        );
        expect(body.includes("<!DOCTYPE html>")).toEqual(true);
      });
    });

    describe("path: /", () => {
      test("POST basic query", async () => {
        const {
          body: { data, errors },
        } = await post({
          path: "/graphql",
          port,
          query: `
            query {
              echo(text: "hello world")
            }
          `,
        });
        expect(errors).toBeUndefined();
        expect(data?.echo).toBeDefined();
      });

      test("GET basic query", async () => {
        const {
          body: { data, errors },
        } = await get({
          path: "/graphql",
          port,
          query: `
            query {
              echo(text: "hello world")
            }
          `,
        });
        expect(errors).toBeUndefined();
        expect(data?.echo).toBeDefined();
      });

      test("GET GraphiQL interface", async () => {
        const { body } = await got.get<any>(
          `http://localhost:${port}/graphiql`,
          {
            headers: {
              accept:
                "text/html, application/xhtml+xml, application/xml;q=0.9, */*;q=0.8",
            },
            searchParams: {
              query: `
                query {
                  echo(text: "hello world")
                }
              `,
            },
          }
        );
        expect(body.includes("<!DOCTYPE html>")).toEqual(true);
      });
    });
  });
});
