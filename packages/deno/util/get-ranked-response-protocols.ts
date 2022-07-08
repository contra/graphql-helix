export type ResponseProtocols =
  | "application/graphql+json"
  | /* LEGACY */ "application/json"
  | "text/event-stream"
  | "multipart/mixed";

/**
 * Object with keys of AcceptedProtocols.
 * A value smaller than 0 indicates that this protocol is not accepted by the client.
 * A value higher than -1 indicates that this protocol is accepted by the client. A protocol with a value of '0' is preferred over a protocol with a value of '1' or '2'.
 */
export type RankedResponseProtocols = Record<ResponseProtocols, number>;

function normalizeValue(str: string) {
  return str.split(";")[0].trim();
}

/**
 * parses an accept header string '"application/json, text/event-stream"' into an array of strings '["application/json", "text/event-stream"]'
 * @param acceptHeader accept header string as sent by client
 * @returns
 */
function parseAcceptHeader(acceptHeader: string) {
  return acceptHeader.split(",").map(normalizeValue);
}

/**
 * Returns a map of ranked protocols which can be used for determining teh protocol for sending a response to the client.
 * @param acceptHeader accept header string as sent by client
 * @param contentTypeHeader content-type header string as sent by client
 */
export function getRankedResponseProtocols(acceptHeader: unknown, contentTypeHeader: unknown): RankedResponseProtocols {
  const rankedProtocols: RankedResponseProtocols = {
    "application/graphql+json": -1,
    "application/json": -1 /* LEGACY */,
    "text/event-stream": -1,
    "multipart/mixed": -1,
  };

  /**
   * In case no acceptHeader has been sent by the client, the response protocol is determined by trying to mirror the incoming content-type.
   * This works for 'application/graphql+json' and 'application/json'.
   */
  if (typeof acceptHeader !== "string") {
    // if no accept is provided we rank up the content-type
    if (typeof contentTypeHeader === "string") {
      const normalizedContentType = normalizeValue(contentTypeHeader);
      if (normalizedContentType in rankedProtocols) {
        rankedProtocols[normalizedContentType as ResponseProtocols]++;
      }
    }

    return rankedProtocols;
  }

  /**
   * In case no acceptHeader has been sent by the client, we need to parse it and then create ranking of what suits the client best.
   * See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept
   */

  const supportedProtocols = parseAcceptHeader(acceptHeader);

  let index = 0;
  for (const protocol of supportedProtocols) {
    if (protocol in rankedProtocols) {
      rankedProtocols[protocol as ResponseProtocols] = index;
      index++;
    }
  }

  return rankedProtocols;
}
