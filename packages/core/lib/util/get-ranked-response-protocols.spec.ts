import { getRankedResponseProtocols } from "./get-ranked-response-protocols";

it.each([
  [
    "application/json",
    undefined,
    {
      "application/graphql+json": -1,
      "application/json": 0,
      "text/event-stream": -1,
      "multipart/mixed": -1,
    },
  ],
  [
    "application/graphql+json",
    undefined,
    {
      "application/graphql+json": 0,
      "application/json": -1,
      "text/event-stream": -1,
      "multipart/mixed": -1,
    },
  ],
  [
    "application/json",
    undefined,
    {
      "application/graphql+json": -1,
      "application/json": 0,
      "text/event-stream": -1,
      "multipart/mixed": -1,
    },
  ],
  [
    undefined,
    "application/json",
    {
      "application/graphql+json": -1,
      "application/json": 0,
      "text/event-stream": -1,
      "multipart/mixed": -1,
    },
  ],
  [
    undefined,
    "   application/json   ",
    {
      "application/graphql+json": -1,
      "application/json": 0,
      "text/event-stream": -1,
      "multipart/mixed": -1,
    },
  ],
  [
    "application/graphql+json, application/json",
    "application/json",
    {
      "application/graphql+json": 0,
      "application/json": 1,
      "text/event-stream": -1,
      "multipart/mixed": -1,
    },
  ],
  [
    undefined,
    "application/graphql+json",
    {
      "application/graphql+json": 0,
      "application/json": -1,
      "text/event-stream": -1,
      "multipart/mixed": -1,
    },
  ],
  [
    "   application/graphql+json; encoding=foo  ,  application/json; encoding= what    ",
    "application/graphql+json",
    {
      "application/graphql+json": 0,
      "application/json": 1,
      "text/event-stream": -1,
      "multipart/mixed": -1,
    },
  ],
])("getRankedResponseProtocols(%s, %s)", (acceptHeader, contentTypeHeader, rankingResult) => {
  expect(getRankedResponseProtocols(acceptHeader, contentTypeHeader)).toEqual(rankingResult);
});
