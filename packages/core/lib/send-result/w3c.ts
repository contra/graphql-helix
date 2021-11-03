import { HttpError } from "..";
import { MultipartResponse, ProcessRequestResult, Push, Response as HelixResponse } from "../types";
import { DEFAULT_TRANSFORM_RESULT_FN } from "./utils";

export function getRegularResponse<TResponse extends Response>(
    responseResult: HelixResponse<any, any>,
    transformResult = DEFAULT_TRANSFORM_RESULT_FN,
    Response: { new(body: BodyInit, responseInit: ResponseInit): TResponse }
): TResponse {
    const headersInit: HeadersInit = [];
    for (const { name, value } of responseResult.headers) {
        headersInit.push([name, value]);
    }
    const responseInit: ResponseInit = {
        headers: headersInit,
        status: responseResult.status,
    };
    const transformedResult = transformResult(responseResult.payload);
    const responseBody = JSON.stringify(transformedResult);
    return new Response(responseBody, responseInit);
}

export function getMultipartResponse<TResponse extends Response, TReadableStream extends ReadableStream>(
    multipartResult: MultipartResponse<any, any>,
    transformResult = DEFAULT_TRANSFORM_RESULT_FN,
    Response: { new(readableStream: TReadableStream, responseInit: ResponseInit): TResponse },
    ReadableStream: { new(underlyingSource: UnderlyingSource): TReadableStream }
): TResponse {
    const headersInit: HeadersInit = {
        "Connection": "keep-alive",
        "Content-Type": 'multipart/mixed; boundary="-"',
        "Transfer-Encoding": "chunked",
    };
    const responseInit: ResponseInit = {
        headers: headersInit,
        status: 200,
    };
    const readableStream = new ReadableStream({
        async start(controller) {
            controller.enqueue(`---`);
            await multipartResult.subscribe(patchResult => {
                const transformedResult = transformResult(patchResult);
                const chunk = Buffer.from(JSON.stringify(transformResult(transformedResult)), "utf8");
                const data = ["", "Content-Type: application/json; charset=utf-8", "Content-Length: " + String(chunk.length), "", chunk];
                if (patchResult.hasNext) {
                    data.push("---");
                }
                controller.enqueue(data.join("\r\n"));
            })
            controller.enqueue('\r\n-----\r\n');
            controller.close();
        }
    });
    return new Response(readableStream, responseInit);
}

export function getPushResponse<TResponse extends Response, TReadableStream extends ReadableStream>(
    pushResult: Push<any, any>,
    transformResult = DEFAULT_TRANSFORM_RESULT_FN,
    Response: { new(readableStream: TReadableStream, responseInit: ResponseInit): TResponse },
    ReadableStream: { new(underlyingSource: UnderlyingSource): TReadableStream }
): TResponse {
    const headersInit: HeadersInit = {
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
    };
    const responseInit: ResponseInit = {
        headers: headersInit,
        status: 200,
    };

    const readableStream = new ReadableStream({
        async start(controller) {
            controller.enqueue(`---`);
            await pushResult.subscribe(result => {
                controller.enqueue(`data: ${JSON.stringify(transformResult(result))}\n\n`);
            })
            controller.close();
        }
    });
    return new Response(readableStream, responseInit);
}

export function getResponse<TResponse extends Response, TReadableStream extends ReadableStream>(
    result: ProcessRequestResult<any, any>,
    transformResult = DEFAULT_TRANSFORM_RESULT_FN,
    Response: { new(body: BodyInit, responseInit: ResponseInit): TResponse },
    ReadableStream: { new(underlyingSource: UnderlyingSource): TReadableStream }
): TResponse {
    switch (result.type) {
        case "RESPONSE":
            return getRegularResponse(result, transformResult, Response);
        case "MULTIPART_RESPONSE":
            return getMultipartResponse(result, transformResult, Response, ReadableStream);
        case "PUSH":
            return getPushResponse(result, transformResult, Response, ReadableStream);
        default:
            throw new HttpError(500, "Cannot process result.");
    }
}
