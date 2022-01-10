import { Readable } from "stream";

export function toReadable<T>(source: AsyncGenerator<T, void>): Readable {
  const readable = new Readable({
    encoding: "utf-8",
  });

  readable._destroy = async (error, callback) => {
    try {
      await (error != null ? source.throw(error) : source.return());
    } catch (error: any) {
      return callback(error);
    }
    callback(error);
  };

  let running = false;
  readable._read = async (size) => {
    if (running) {
      return;
    }
    running = true;
    try {
      let cursor;
      do {
        cursor = await source.next(size);

        if (cursor.done) {
          return readable.push(null);
        }
        readable.push(cursor.value);
      } while (cursor.done === false);
    } catch (error) {
      process.nextTick(readable.emit.bind(readable, "error", error));
    } finally {
      running = false;
    }
    return undefined;
  };
  return readable;
}
