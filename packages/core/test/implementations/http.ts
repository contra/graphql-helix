import { createServer } from "http";
import { getGraphQLParameters, getNodeRequest, processRequest, renderGraphiQL, sendNodeResponse, shouldRenderGraphiQL } from "../../lib";
import { schema } from "../schema";

const server = createServer(async (req, res) => {
    const request = await getNodeRequest(req);
    if (shouldRenderGraphiQL(request) || req.url.startsWith("/graphiql") && !req.url.startsWith('/graphql')) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(renderGraphiQL());
    } else {
        const { operationName, query, variables } = await getGraphQLParameters(request);
        const response = await processRequest({
            operationName,
            query,
            variables,
            request,
            schema,
        });

        await sendNodeResponse(response, res);
    }
});

export default {
    name: "http",
    start: async (port: number) => {
        return new Promise<() => Promise<void>>((resolve, reject) => {
            server.on("error", reject);
            server.listen(port, () => {
                resolve(
                    async () =>
                        new Promise((resolve) => {
                            server.close(() => resolve());
                        })
                );
            });
        });
    },
};

