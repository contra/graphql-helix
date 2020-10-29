export class HttpError extends Error {
  status: number;
  headers?: { name: string; value: string }[];
  graphqlErrors?: readonly Error[];

  constructor(
    status: number,
    message: string,
    details: {
      headers?: { name: string; value: string }[];
      graphqlErrors?: readonly Error[];
    } = {}
  ) {
    super(message);
    this.status = status;
    this.headers = details.headers;
    this.graphqlErrors = details.graphqlErrors;
  }
}
