export const isHttpMethod = (
  target: "GET" | "POST",
  subject: string
): boolean => {
  return subject.toUpperCase() === target;
};
