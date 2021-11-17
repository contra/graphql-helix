import express from "express";
import { parse, validate } from "graphql";
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  sendNodeResponse,
  shouldRenderGraphiQL,
  getNodeRequest,
} from "graphql-helix";
import { compileQuery, isCompiledQuery } from "graphql-jit";
import lru from "tiny-lru";
import { schema } from "./schema";

const cache = lru(1000, 3600000);

const app = express();

app.use(express.json());

app.use("/graphql", async (req, res) => {
  const request = await getNodeRequest(req);

  if (shouldRenderGraphiQL(request)) {
    res.send(renderGraphiQL());
  } else {
    const { operationName, query, variables } = await getGraphQLParameters(request);
    const cacheKey = query || "";
    const cached = cache.get(cacheKey);
    let compiledQuery = cached?.compiledQuery;
    let document = cached?.document;
    let validationErrors = cached?.validationErrors;
    console.log({ cached, compiledQuery, document, validationErrors });

    const response = await processRequest({
      operationName,
      query,
      variables,
      request,
      schema,
      parse: (source, options) => {
        if (!document) {
          document = parse(source, options);
          cache.set(cacheKey, { document });
        }

        return document;
      },
      validate: (schema, documentAST, rules, typeInfo, options) => {
        if (!validationErrors) {
          validationErrors = validate(schema, documentAST, rules, typeInfo, options);
          cache.set(cacheKey, { document, validationErrors });
        }

        return validationErrors;
      },
      execute: (schema, documentAst, rootValue, contextValue, variableValues, operationName) => {
        if (!compiledQuery) {
          compiledQuery = compileQuery(schema, documentAst, operationName);
          cache.set(cacheKey, { compiledQuery, document, validationErrors });
        }

        if (isCompiledQuery(compiledQuery)) {
          return compiledQuery.query(rootValue, contextValue, variableValues || {});
        } else {
          return compiledQuery;
        }
      },
    });

    await sendNodeResponse(response, res);
  }
});

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`GraphQL server is running on port ${port}.`);
});
